// Track_karo API — one serverless function, routed by path. See /API.md for the contract.
import {
  q, q1, HttpError, bad, forbidden, notFound, hashPassword, checkPassword, signToken, verifyToken, loadUser,
  USER_COLS, istDay, validDay, getSettings, saveSettings, num, validLatLng, officerStatus, minutesBetween,
} from './_lib/core.js';
import { createAlert, runLazyChecks, alertMissedAssignments } from './_lib/alerts.js';
import { ingestPoints, getOrCreateDuty, backfillVisits } from './_lib/tracking.js';
import { buildTrack, buildReport } from './_lib/report.js';
import { geocode, resolveMapsLink } from './_lib/places.js';

const routes = [];
const route = (method, path, roles, fn) => routes.push({ method, parts: path.split('/').filter(Boolean), roles, fn });
const ANY = ['admin', 'branch_manager', 'field_officer'];
const MGR = ['admin', 'branch_manager'];
const ADMIN = ['admin'];
const FO = ['field_officer'];

const isAdmin = (u) => u.role === 'admin';
// admin: optional filter; branch manager: always their own branch
const scopeBranch = (u, requested) => (isAdmin(u) ? num(requested) : (u.branch_id ?? -1));
const str = (v, max = 200) => (v === null || v === undefined ? null : String(v).trim().slice(0, max) || null);

async function officerInScope(user, officerId) {
  const o = await q1(`SELECT id, name, branch_id FROM users WHERE id = $1 AND role = 'field_officer'`, [num(officerId)]);
  if (!o) throw notFound('Field officer not found');
  if (user.role === 'field_officer' && o.id !== user.id) throw forbidden();
  if (user.role === 'branch_manager' && o.branch_id !== user.branch_id) throw forbidden('This officer is not in your branch');
  return o;
}

async function listOfficers(user, branchId, day = istDay()) {
  const settings = await getSettings();
  const rows = await q(
    `SELECT u.id, u.userid, u.name, u.phone, u.branch_id, b.name AS branch_name,
            d.started_at, d.ended_at, COALESCE(round(d.distance_m), 0)::int AS distance_m,
            d.last_lat AS lat, d.last_lng AS lng, d.last_point_at, d.battery, d.location_on,
            EXISTS (SELECT 1 FROM breaks k WHERE k.officer_id = u.id AND k.day = $1 AND k.ended_at IS NULL) AS on_lunch,
            (SELECT count(*) FROM assignment_status a WHERE a.officer_id = u.id AND a.day = $1)::int AS assignments_total,
            (SELECT count(*) FROM assignment_status a WHERE a.officer_id = u.id AND a.day = $1 AND a.visited)::int AS assignments_visited
     FROM users u LEFT JOIN branches b ON b.id = u.branch_id
     LEFT JOIN duty_days d ON d.officer_id = u.id AND d.day = $1
     WHERE u.role = 'field_officer' AND u.active AND ($2::int IS NULL OR u.branch_id = $2)
     ORDER BY u.name`, [day, scopeBranch(user, branchId)]);
  return rows.map(({ location_on, on_lunch, ...o }) => ({ ...o, status: officerStatus({ ...o, location_on, on_lunch }, settings) }));
}

// ======================= auth =======================
route('POST', '/login', null, async ({ body }) => {
  const userid = str(body.userid, 80), password = body.password;
  if (!userid || !password) throw bad('Enter user ID and password');
  // slow down password guessing: 8 wrong tries per user ID in 15 minutes locks that ID for a while
  const fails = await q1(`SELECT count(*)::int AS n FROM login_failures WHERE userid = lower($1) AND ts > now() - interval '15 minutes'`, [userid]);
  if (fails.n >= 8) throw new HttpError(429, 'Too many wrong attempts. Try again after 15 minutes.');
  const row = await q1('SELECT id, password_hash, active FROM users WHERE lower(userid) = lower($1)', [userid]);
  if (!row || !row.active || !(await checkPassword(password, row.password_hash))) {
    await q('INSERT INTO login_failures (userid) VALUES (lower($1))', [userid]);
    throw new HttpError(401, 'Wrong user ID or password');
  }
  await q('DELETE FROM login_failures WHERE userid = lower($1) OR ts < now() - interval \'1 day\'', [userid]);
  const user = await loadUser(row.id);
  return { token: signToken(user), user };
});
route('GET', '/me', ANY, async ({ user }) => ({ user, settings: await getSettings() }));

// ======================= field officer =======================
async function todayPayload(user) {
  const day = istDay();
  const settings = await getSettings();
  const [duty, breaks, assignments, customerVisits] = await Promise.all([
    q1('SELECT started_at, ended_at, round(distance_m)::int AS distance_m, location_on FROM duty_days WHERE officer_id = $1 AND day = $2', [user.id, day]),
    q('SELECT id, started_at, ended_at FROM breaks WHERE officer_id = $1 AND day = $2 ORDER BY started_at', [user.id, day]),
    q(`SELECT id, officer_id, officer_name, day, name, kind, address, lat, lng, radius_m, visited, first_enter_at,
              round(secs / 60.0)::int AS time_spent_min
       FROM assignment_status WHERE officer_id = $1 AND day = $2 ORDER BY id`, [user.id, day]),
    q(`SELECT cv.id, cv.customer_id, c.name AS customer_name, cv.ts, cv.lat, cv.lng
       FROM customer_visits cv JOIN customers c ON c.id = cv.customer_id
       WHERE cv.officer_id = $1 AND cv.day = $2 ORDER BY cv.ts DESC`, [user.id, day]),
  ]);
  const open = breaks.find((b) => !b.ended_at);
  const minutes = breaks.reduce((m, b) => m + minutesBetween(b.started_at, b.ended_at || new Date()), 0);
  return {
    day, duty,
    lunch: { active: !!open, started_at: open?.started_at || null, minutes_today: minutes, allowed_min: settings.lunch_allowed_min },
    assignments, customer_visits: customerVisits, settings,
  };
}
route('GET', '/duty/today', FO, ({ user }) => todayPayload(user));

route('POST', '/duty/start', FO, async ({ user, body }) => {
  const day = istDay();
  const has = validLatLng(body.lat, body.lng);
  const duty = await q1(
    `INSERT INTO duty_days (officer_id, day, started_at, last_lat, last_lng, last_point_at)
     VALUES ($1, $2, now(), $3, $4, CASE WHEN $3::float8 IS NULL THEN NULL ELSE now() END)
     ON CONFLICT (officer_id, day) DO UPDATE SET started_at = COALESCE(duty_days.started_at, now()), ended_at = NULL,
       location_on = true, no_signal_alerted = false, updated_at = now(),
       last_lat = COALESCE(EXCLUDED.last_lat, duty_days.last_lat), last_lng = COALESCE(EXCLUDED.last_lng, duty_days.last_lng),
       last_point_at = COALESCE(EXCLUDED.last_point_at, duty_days.last_point_at)
     RETURNING started_at, ended_at, round(distance_m)::int AS distance_m, location_on`,
    [user.id, day, has ? num(body.lat) : null, has ? num(body.lng) : null]);
  return { duty };
});

async function endDay(officerId, day) {
  const duty = await q1(
    `UPDATE duty_days SET ended_at = COALESCE(ended_at, now()), updated_at = now() WHERE officer_id = $1 AND day = $2
     RETURNING started_at, ended_at, round(distance_m)::int AS distance_m, location_on`, [officerId, day]);
  await q('UPDATE breaks SET ended_at = now() WHERE officer_id = $1 AND day = $2 AND ended_at IS NULL', [officerId, day]);
  const missed = await alertMissedAssignments(officerId, day);
  return { duty, missed };
}
route('POST', '/duty/end', FO, async ({ user }) => {
  const day = istDay();
  if (!(await q1('SELECT 1 FROM duty_days WHERE officer_id = $1 AND day = $2', [user.id, day]))) throw bad('Day was not started');
  return endDay(user.id, day);
});

route('POST', '/locations', FO, async ({ user, body }) => ({ ok: true, ...(await ingestPoints(user, body.points)) }));

route('POST', '/events', FO, async ({ user, body }) => {
  const type = body.type;
  if (!['location_off', 'location_on', 'permission_denied'].includes(type)) throw bad('Unknown event type');
  const day = istDay();
  const duty = await q1('SELECT * FROM duty_days WHERE officer_id = $1 AND day = $2', [user.id, day]);
  if (!duty || !duty.started_at || duty.ended_at) return { ok: true, ignored: 'not on duty' };
  const has = validLatLng(body.lat, body.lng);
  await q('INSERT INTO officer_events (officer_id, day, type, lat, lng) VALUES ($1,$2,$3,$4,$5)',
    [user.id, day, type, has ? num(body.lat) : null, has ? num(body.lng) : null]);
  if (type === 'location_on') {
    await q('UPDATE duty_days SET location_on = true, no_signal_alerted = false, updated_at = now() WHERE id = $1', [duty.id]);
    return { ok: true };
  }
  await q('UPDATE duty_days SET location_on = false, updated_at = now() WHERE id = $1', [duty.id]);
  const recent = await q1(
    `SELECT 1 FROM alerts WHERE officer_id = $1 AND type = 'location_off' AND created_at > now() - interval '2 minutes'`, [user.id]);
  if (!recent) {
    await createAlert({
      type: 'location_off', target_role: 'branch_manager', officer_id: user.id, branch_id: user.branch_id,
      title: `${user.name} turned off location`,
      body: type === 'permission_denied'
        ? 'Location permission was removed from the Track_karo app during the work day.'
        : 'Location (GPS) was switched off on the phone during the work day.',
      data: { lat: duty.last_lat, lng: duty.last_lng, last_point_at: duty.last_point_at },
    });
  }
  return { ok: true };
});

route('POST', '/breaks/start', FO, async ({ user, body }) => {
  const day = istDay();
  const duty = await getOrCreateDuty(user.id, day, new Date().toISOString());
  if (duty.ended_at) throw bad('Day has already ended');
  let br = await q1('SELECT id, started_at FROM breaks WHERE officer_id = $1 AND day = $2 AND ended_at IS NULL', [user.id, day]);
  if (!br) {
    const has = validLatLng(body.lat, body.lng);
    br = await q1('INSERT INTO breaks (officer_id, day, lat, lng) VALUES ($1,$2,$3,$4) RETURNING id, started_at',
      [user.id, day, has ? num(body.lat) : duty.last_lat, has ? num(body.lng) : duty.last_lng]);
    await q('UPDATE duty_days SET updated_at = now() WHERE id = $1', [duty.id]);
  }
  return { break: br };
});
route('POST', '/breaks/end', FO, async ({ user }) => {
  const day = istDay();
  const br = await q1(
    `UPDATE breaks SET ended_at = now() WHERE officer_id = $1 AND day = $2 AND ended_at IS NULL RETURNING id, started_at, ended_at`,
    [user.id, day]);
  if (!br) throw bad('No lunch break is running');
  await q('UPDATE duty_days SET updated_at = now() WHERE officer_id = $1 AND day = $2', [user.id, day]);
  return { break: { ...br, minutes: minutesBetween(br.started_at, br.ended_at) } };
});

route('GET', '/customers/search', ANY, async ({ user, query }) => {
  const term = str(query.q, 80);
  if (!term) return { customers: [] };
  const branch = isAdmin(user) ? null : (user.branch_id ?? -1);
  const like = term.replace(/[\\%_]/g, '\\$&');
  const customers = await q(
    `SELECT id, name, village, phone FROM customers c
     WHERE lower(c.name) LIKE '%' || lower($1) || '%'
       AND ($2::int IS NULL OR c.branch_id = $2 OR c.branch_id IS NULL)
     ORDER BY (lower(c.name) LIKE lower($1) || '%') DESC, c.name LIMIT 20`, [like, branch]);
  return { customers };
});

route('POST', '/customer-visits', FO, async ({ user, body }) => {
  if (!validLatLng(body.lat, body.lng)) throw bad('Live location is missing');
  const c = await q1('SELECT id, name, branch_id FROM customers WHERE id = $1', [num(body.customer_id)]);
  if (!c) throw bad('Choose an existing customer from the list');
  if (c.branch_id !== null && c.branch_id !== user.branch_id) throw forbidden('This customer belongs to another branch');
  const day = istDay();
  const v = await q1(
    `INSERT INTO customer_visits (customer_id, officer_id, day, lat, lng, accuracy) VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id, customer_id, ts, lat, lng`, [c.id, user.id, day, num(body.lat), num(body.lng), num(body.accuracy)]);
  // this update makes the database push the yellow dot to the website
  await q('UPDATE customers SET lat = $2, lng = $3, located_at = now(), located_by = $4 WHERE id = $1',
    [c.id, num(body.lat), num(body.lng), user.id]);
  return { visit: { ...v, customer_name: c.name } };
});

route('POST', '/device-token', ANY, async ({ user, body }) => {
  const token = str(body.token, 4096);
  if (!token) throw bad('token is required');
  await q(`INSERT INTO device_tokens (user_id, kind, token) VALUES ($1,$2,$3)
           ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, kind = EXCLUDED.kind`,
    [user.id, str(body.kind, 20) || 'fcm', token]);
  return { ok: true };
});
route('DELETE', '/device-token', ANY, async ({ user, body }) => {
  await q('DELETE FROM device_tokens WHERE user_id = $1 AND token = $2', [user.id, str(body.token, 4096)]);
  return { ok: true };
});

// ======================= branch manager / admin =======================
route('GET', '/dashboard', MGR, async ({ user }) => {
  await runLazyChecks().catch(() => {});
  const officers = await listOfficers(user);
  const count = (s) => officers.filter((o) => o.status === s).length;
  const branch = scopeBranch(user, null);
  const cust = await q1(
    `SELECT count(*)::int AS total, count(lat)::int AS located FROM customers WHERE ($1::int IS NULL OR branch_id = $1)`, [branch]);
  const unread = await unreadCount(user);
  return {
    officers_total: officers.length,
    on_duty: officers.filter((o) => ['on_duty', 'on_lunch', 'location_off', 'no_signal'].includes(o.status)).length,
    on_lunch: count('on_lunch'), location_off: count('location_off') + count('no_signal'), day_ended: count('day_ended'),
    distance_km_today: Math.round(officers.reduce((m, o) => m + o.distance_m, 0) / 10) / 100,
    assignments_total: officers.reduce((m, o) => m + o.assignments_total, 0),
    assignments_visited: officers.reduce((m, o) => m + o.assignments_visited, 0),
    customers_total: cust.total, customers_located: cust.located, unread_alerts: unread,
  };
});

route('GET', '/officers', MGR, async ({ user, query }) => {
  await runLazyChecks().catch(() => {});
  return { officers: await listOfficers(user, query.branch_id) };
});

route('GET', '/live', MGR, async ({ user }) => {
  await runLazyChecks().catch(() => {});
  const branch = scopeBranch(user, null);
  const [officers, branches, customers] = await Promise.all([
    listOfficers(user),
    q(`SELECT b.id, b.name, b.address, b.lat, b.lng,
              (SELECT string_agg(u.name, ', ' ORDER BY u.name) FROM users u WHERE u.branch_id = b.id AND u.role = 'branch_manager' AND u.active) AS manager_names
       FROM branches b WHERE b.lat IS NOT NULL AND b.lng IS NOT NULL AND ($1::int IS NULL OR b.id = $1) ORDER BY b.name`, [branch]),
    q(`SELECT id, name, village, lat, lng, located_at, branch_id FROM customers
       WHERE lat IS NOT NULL AND lng IS NOT NULL AND ($1::int IS NULL OR branch_id = $1)
       ORDER BY located_at DESC NULLS LAST LIMIT 5000`, [branch]),
  ]);
  return { officers, branches, customers };
});

route('GET', '/track', MGR, async ({ user, query }) => {
  const o = await officerInScope(user, query.officer_id);
  const t = await buildTrack(o.id, validDay(query.day), await getSettings());
  return {
    officer: { id: o.id, name: o.name }, day: t.day, distance_m: t.distance_m,
    started_at: t.duty?.started_at || null, ended_at: t.duty?.ended_at || null,
    points: t.points, assignments: t.assignments, visits: t.visits, stops: t.stops, breaks: t.breaks,
    customer_visits: t.customer_visits,
  };
});

// ---- assignments (daily locations + geofence) ----
const ASSIGN_COLS = `id, officer_id, officer_name, day, name, kind, address, lat, lng, radius_m, visited, first_enter_at,
                     round(secs / 60.0)::int AS time_spent_min`;
route('GET', '/assignments', MGR, async ({ user, query }) => {
  const assignments = await q(
    `SELECT ${ASSIGN_COLS} FROM assignment_status a
     WHERE a.day = $1 AND ($2::int IS NULL OR a.officer_id = $2)
       AND ($3::int IS NULL OR EXISTS (SELECT 1 FROM users u WHERE u.id = a.officer_id AND u.branch_id = $3))
     ORDER BY a.officer_name, a.id`, [validDay(query.day), num(query.officer_id), scopeBranch(user, query.branch_id)]);
  return { assignments };
});
route('POST', '/assignments', MGR, async ({ user, body }) => {
  const o = await officerInScope(user, body.officer_id);
  const name = str(body.name, 120);
  if (!name) throw bad('Enter a name for the location');
  if (!validLatLng(body.lat, body.lng)) throw bad('Choose the location on the map or search for it');
  const kind = body.kind === 'village' ? 'village' : 'center';
  const settings = await getSettings();
  const radius = Math.min(100000, Math.max(10, Math.round(num(body.radius_m) || settings.geofence_radius_m)));
  const row = await q1(
    `INSERT INTO assignments (officer_id, branch_id, day, name, kind, address, lat, lng, radius_m, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [o.id, o.branch_id, validDay(body.day), name, kind, str(body.address, 400), num(body.lat), num(body.lng), radius, user.id]);
  await backfillVisits(row.id).catch(() => {}); // the officer may already have been there today
  return { assignment: await q1(`SELECT ${ASSIGN_COLS} FROM assignment_status WHERE id = $1`, [row.id]) };
});
route('DELETE', '/assignments/:id', MGR, async ({ user, params }) => {
  const a = await q1('SELECT id, officer_id FROM assignments WHERE id = $1', [num(params.id)]);
  if (!a) throw notFound();
  await officerInScope(user, a.officer_id);
  await q('DELETE FROM assignments WHERE id = $1', [a.id]);
  return { ok: true };
});

route('GET', '/geocode', MGR, async ({ query }) => ({ results: await geocode(str(query.q, 200) || '') }));
route('POST', '/resolve-link', MGR, async ({ body }) => resolveMapsLink(str(body.url, 2000) || ''));

// ---- alerts ----
// admin sees everything (meeting alerts are admin-only); a branch manager sees their branch's alerts
const alertScope = (user) => (isAdmin(user)
  ? { sql: 'TRUE', params: [] }
  : { sql: `a.target_role = 'branch_manager' AND a.branch_id = $1`, params: [user.branch_id ?? -1] });
async function unreadCount(user) {
  const s = alertScope(user);
  return (await q1(`SELECT count(*)::int AS n FROM alerts a WHERE ${s.sql} AND a.read_at IS NULL`, s.params)).n;
}
route('GET', '/alerts', MGR, async ({ user, query }) => {
  await runLazyChecks().catch(() => {});
  const s = alertScope(user);
  const p = [...s.params];
  let where = s.sql;
  if (query.unread === '1' || query.unread === 'true') where += ' AND a.read_at IS NULL';
  if (query.type) { p.push(String(query.type)); where += ` AND a.type = $${p.length}`; }
  p.push(Math.min(200, Math.max(1, num(query.limit) || 50)));
  const alerts = await q(
    `SELECT a.id, a.type, a.title, a.body, a.officer_id, u.name AS officer_name, a.branch_id, b.name AS branch_name,
            a.data, a.created_at, a.read_at
     FROM alerts a LEFT JOIN users u ON u.id = a.officer_id LEFT JOIN branches b ON b.id = a.branch_id
     WHERE ${where} ORDER BY a.created_at DESC LIMIT $${p.length}`, p);
  return { alerts, unread_count: await unreadCount(user) };
});
route('POST', '/alerts/read-all', MGR, async ({ user }) => {
  const s = alertScope(user);
  await q(`UPDATE alerts a SET read_at = now() WHERE ${s.sql} AND a.read_at IS NULL`, s.params);
  return { ok: true };
});
route('POST', '/alerts/:id/read', MGR, async ({ user, params }) => {
  const s = alertScope(user);
  await q(`UPDATE alerts a SET read_at = COALESCE(a.read_at, now()) WHERE ${s.sql} AND a.id = $${s.params.length + 1}`,
    [...s.params, num(params.id)]);
  return { ok: true };
});

// ---- reports ----
route('GET', '/reports/daily', MGR, async ({ user, query }) => {
  const day = validDay(query.day);
  const settings = await getSettings();
  const officers = await q(
    `SELECT id FROM users u WHERE role = 'field_officer' AND ($1::int IS NULL OR branch_id = $1) AND ($2::int IS NULL OR id = $2)
       AND (active OR EXISTS (SELECT 1 FROM duty_days d WHERE d.officer_id = u.id AND d.day = $3))
     ORDER BY name`, [scopeBranch(user, query.branch_id), num(query.officer_id), day]);
  const reports = [];
  for (let i = 0; i < officers.length; i += 4) { // 4 at a time keeps the connection pool small
    reports.push(...await Promise.all(officers.slice(i, i + 4).map((o) => buildReport(o.id, day, settings))));
  }
  return { day, reports };
});

route('GET', '/customer-visits', MGR, async ({ user, query }) => {
  const visits = await q(
    `SELECT cv.id, cv.customer_id, c.name AS customer_name, cv.officer_id, u.name AS officer_name, cv.ts, cv.lat, cv.lng
     FROM customer_visits cv JOIN customers c ON c.id = cv.customer_id JOIN users u ON u.id = cv.officer_id
     WHERE cv.day = $1 AND ($2::int IS NULL OR cv.officer_id = $2) AND ($3::int IS NULL OR u.branch_id = $3)
     ORDER BY cv.ts DESC`, [validDay(query.day), num(query.officer_id), scopeBranch(user, null)]);
  return { visits };
});

// ---- customers ----
const CUST_SELECT = `SELECT c.id, c.name, c.village, c.phone, c.branch_id, b.name AS branch_name, c.lat, c.lng, c.located_at,
                            lu.name AS located_by_name
                     FROM customers c LEFT JOIN branches b ON b.id = c.branch_id LEFT JOIN users lu ON lu.id = c.located_by`;
route('GET', '/customers', MGR, async ({ user, query }) => {
  const branch = scopeBranch(user, query.branch_id);
  const term = str(query.q, 80);
  const like = term ? `%${term.replace(/[\\%_]/g, '\\$&')}%` : null;
  const limit = Math.min(500, Math.max(1, num(query.limit) || 50)), offset = Math.max(0, num(query.offset) || 0);
  const where = `($1::int IS NULL OR c.branch_id = $1) AND ($2::text IS NULL OR c.name ILIKE $2 OR c.village ILIKE $2 OR c.phone ILIKE $2)`;
  const [customers, total] = await Promise.all([
    q(`${CUST_SELECT} WHERE ${where} ORDER BY c.name, c.id LIMIT $3 OFFSET $4`, [branch, like, limit, offset]),
    q1(`SELECT count(*)::int AS n FROM customers c WHERE ${where}`, [branch, like]),
  ]);
  return { customers, total: total.n };
});
const custBranch = (user, requested) => (isAdmin(user) ? num(requested) : user.branch_id);
route('POST', '/customers', MGR, async ({ user, body }) => {
  const name = str(body.name, 120);
  if (!name) throw bad('Customer name is required');
  const row = await q1('INSERT INTO customers (name, village, phone, branch_id) VALUES ($1,$2,$3,$4) RETURNING id',
    [name, str(body.village, 120), str(body.phone, 30), custBranch(user, body.branch_id)]);
  return { customer: await q1(`${CUST_SELECT} WHERE c.id = $1`, [row.id]) };
});
route('POST', '/customers/import', MGR, async ({ user, body }) => {
  const list = (Array.isArray(body.customers) ? body.customers : []).slice(0, 5000)
    .map((c) => ({ name: str(c.name, 120), village: str(c.village, 120), phone: str(c.phone, 30) })).filter((c) => c.name);
  if (!list.length) throw bad('No customers to import');
  const r = await q(
    `INSERT INTO customers (name, village, phone, branch_id)
     SELECT n, v, p, $4 FROM unnest($1::text[], $2::text[], $3::text[]) AS x(n, v, p) RETURNING id`,
    [list.map((c) => c.name), list.map((c) => c.village), list.map((c) => c.phone), custBranch(user, body.branch_id)]);
  return { inserted: r.length };
});
async function customerInScope(user, id) {
  const c = await q1('SELECT id, branch_id FROM customers WHERE id = $1', [num(id)]);
  if (!c) throw notFound('Customer not found');
  if (!isAdmin(user) && c.branch_id !== user.branch_id) throw forbidden();
  return c;
}
route('PUT', '/customers/:id', MGR, async ({ user, params, body }) => {
  const c = await customerInScope(user, params.id);
  const name = str(body.name, 120);
  if (!name) throw bad('Customer name is required');
  await q('UPDATE customers SET name = $2, village = $3, phone = $4, branch_id = $5 WHERE id = $1',
    [c.id, name, str(body.village, 120), str(body.phone, 30), custBranch(user, body.branch_id ?? c.branch_id)]);
  return { customer: await q1(`${CUST_SELECT} WHERE c.id = $1`, [c.id]) };
});
route('DELETE', '/customers/:id', MGR, async ({ user, params }) => {
  const c = await customerInScope(user, params.id);
  await q('DELETE FROM customers WHERE id = $1', [c.id]);
  return { ok: true };
});

// ---- users ----
route('GET', '/users', MGR, async ({ user, query }) => {
  const role = isAdmin(user) ? str(query.role, 30) : 'field_officer';
  const users = await q(
    `SELECT ${USER_COLS}, u.created_at FROM users u LEFT JOIN branches b ON b.id = u.branch_id
     WHERE ($1::text IS NULL OR u.role = $1) AND ($2::int IS NULL OR u.branch_id = $2)
     ORDER BY u.active DESC, u.role, u.name`, [role, scopeBranch(user, query.branch_id)]);
  return { users };
});
route('POST', '/users', MGR, async ({ user, body }) => {
  const userid = str(body.userid, 60), name = str(body.name, 120), password = body.password;
  let role = body.role, branchId = num(body.branch_id);
  if (!isAdmin(user)) { role = 'field_officer'; branchId = user.branch_id; }
  if (!userid || !name) throw bad('User ID and name are required');
  if (!password || String(password).length < 3) throw bad('Password must be at least 3 characters');
  if (!['admin', 'branch_manager', 'field_officer'].includes(role)) throw bad('Choose a role');
  if (role !== 'admin' && !branchId) throw bad('Choose a branch');
  if (await q1('SELECT 1 FROM users WHERE lower(userid) = lower($1)', [userid])) throw new HttpError(409, 'This user ID is already taken');
  const row = await q1(
    'INSERT INTO users (userid, name, password_hash, role, branch_id, phone) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
    [userid, name, await hashPassword(password), role, role === 'admin' ? null : branchId, str(body.phone, 30)]);
  return { user: await q1(`SELECT ${USER_COLS} FROM users u LEFT JOIN branches b ON b.id = u.branch_id WHERE u.id = $1`, [row.id]) };
});
async function userInScope(user, id) {
  const t = await q1('SELECT id, role, branch_id FROM users WHERE id = $1', [num(id)]);
  if (!t) throw notFound('User not found');
  if (!isAdmin(user) && (t.role !== 'field_officer' || t.branch_id !== user.branch_id)) throw forbidden();
  return t;
}
route('PUT', '/users/:id', MGR, async ({ user, params, body }) => {
  const t = await userInScope(user, params.id);
  if (body.active === false && t.id === user.id) throw bad('You cannot deactivate your own login');
  const sets = [], p = [t.id];
  const add = (col, val) => { p.push(val); sets.push(`${col} = $${p.length}`); };
  if (body.name !== undefined && str(body.name, 120)) add('name', str(body.name, 120));
  if (body.phone !== undefined) add('phone', str(body.phone, 30));
  if (body.active !== undefined) add('active', !!body.active);
  if (body.password) {
    if (String(body.password).length < 3) throw bad('Password must be at least 3 characters');
    add('password_hash', await hashPassword(body.password));
  }
  if (isAdmin(user) && body.branch_id !== undefined && t.role !== 'admin') add('branch_id', num(body.branch_id));
  if (sets.length) await q(`UPDATE users SET ${sets.join(', ')} WHERE id = $1`, p);
  return { user: await q1(`SELECT ${USER_COLS} FROM users u LEFT JOIN branches b ON b.id = u.branch_id WHERE u.id = $1`, [t.id]) };
});
route('DELETE', '/users/:id', MGR, async ({ user, params }) => {
  const t = await userInScope(user, params.id);
  if (t.id === user.id) throw bad('You cannot deactivate your own login');
  await q('UPDATE users SET active = false WHERE id = $1', [t.id]);
  return { ok: true };
});

// ---- branches ----
route('GET', '/branches', MGR, async ({ user }) => ({
  branches: await q(
    `SELECT b.id, b.name, b.address, b.lat, b.lng,
            (SELECT string_agg(u.name, ', ' ORDER BY u.name) FROM users u WHERE u.branch_id = b.id AND u.role = 'branch_manager' AND u.active) AS manager_names,
            (SELECT count(*) FROM users u WHERE u.branch_id = b.id AND u.role = 'field_officer' AND u.active)::int AS officer_count
     FROM branches b WHERE ($1::int IS NULL OR b.id = $1) ORDER BY b.name`, [scopeBranch(user, null)]),
}));
const branchFields = (body) => {
  const name = str(body.name, 120);
  if (!name) throw bad('Branch name is required');
  const has = validLatLng(body.lat, body.lng);
  return [name, str(body.address, 400), has ? num(body.lat) : null, has ? num(body.lng) : null];
};
route('POST', '/branches', ADMIN, async ({ body }) => ({
  branch: await q1('INSERT INTO branches (name, address, lat, lng) VALUES ($1,$2,$3,$4) RETURNING id, name, address, lat, lng', branchFields(body)),
}));
route('PUT', '/branches/:id', ADMIN, async ({ params, body }) => {
  const branch = await q1('UPDATE branches SET name = $2, address = $3, lat = $4, lng = $5 WHERE id = $1 RETURNING id, name, address, lat, lng',
    [num(params.id), ...branchFields(body)]);
  if (!branch) throw notFound('Branch not found');
  return { branch };
});
route('DELETE', '/branches/:id', ADMIN, async ({ params }) => {
  const id = num(params.id);
  const used = await q1('SELECT count(*)::int AS n FROM users WHERE branch_id = $1 AND active', [id]);
  if (used.n > 0) throw bad(`This branch still has ${used.n} active user(s). Move or deactivate them first.`);
  await q('DELETE FROM branches WHERE id = $1', [id]);
  return { ok: true };
});

// ---- settings ----
route('GET', '/settings', ANY, () => getSettings(true));
route('PUT', '/settings', ADMIN, ({ body }) => saveSettings(body));

// ---- daily job (Vercel cron, about 9 pm India time): close days left open, raise missed-location alerts ----
async function nightlyClose() {
  const day = istDay();
  const open = await q('SELECT officer_id FROM duty_days WHERE day = $1 AND started_at IS NOT NULL AND ended_at IS NULL', [day]);
  for (const d of open) await endDay(d.officer_id, day);
  return { closed: open.length };
}

// ======================= dispatcher =======================
function match(method, parts) {
  for (const r of routes) {
    if (r.method !== method || r.parts.length !== parts.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < parts.length; i++) {
      if (r.parts[i].startsWith(':')) params[r.parts[i].slice(1)] = decodeURIComponent(parts[i]);
      else if (r.parts[i] !== parts[i]) { ok = false; break; }
    }
    if (ok) return { r, params };
  }
  return null;
}

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') { try { return JSON.parse(req.body || '{}'); } catch { throw bad('Invalid JSON'); } }
    if (Buffer.isBuffer(req.body)) { try { return JSON.parse(req.body.toString() || '{}'); } catch { throw bad('Invalid JSON'); } }
    return req.body;
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const text = Buffer.concat(chunks).toString();
  if (!text) return {};
  try { return JSON.parse(text); } catch { throw bad('Invalid JSON'); }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  const send = (status, obj) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(obj)); };
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  try {
    const url = new URL(req.url, 'http://x');
    const query = Object.fromEntries(url.searchParams);
    const parts = url.pathname.replace(/^\/api/, '').split('/').filter(Boolean);

    if (parts[0] === 'cron') {
      if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) throw new HttpError(401, 'Unauthorized');
      await runLazyChecks(true);
      return send(200, { ok: true, ...(await nightlyClose()) });
    }

    const m = match(req.method, parts);
    if (!m) throw notFound('Unknown API path');
    let user = null;
    if (m.r.roles) {
      const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      const claims = token && verifyToken(token);
      user = claims && await loadUser(claims.id);
      if (!user) throw new HttpError(401, 'Please log in again');
      if (!m.r.roles.includes(user.role)) throw forbidden('Your role cannot do this');
    }
    const body = ['POST', 'PUT', 'DELETE'].includes(req.method) ? await readBody(req) : {};
    send(200, await m.r.fn({ user, query, params: m.params, body: body || {} }));
  } catch (e) {
    if (e instanceof HttpError) return send(e.status, { error: e.message });
    console.error(e);
    send(500, { error: 'Something went wrong on the server' });
  }
}
