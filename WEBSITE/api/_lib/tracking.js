// Location ingestion: distance, geofence visits, "officers meeting" detection.
import { q, q1, getSettings, istDay, haversine, num, validLatLng, inOfficeHours } from './core.js';
import { createAlert, runLazyChecks } from './alerts.js';

const MOVE_THRESHOLD_M = 20;   // ignore GPS jitter smaller than this when adding up distance
const MAX_SPEED_MS = 45;       // ~160 km/h: faster jumps are GPS glitches
const MAX_ACCURACY_M = 100;    // drop very poor fixes
const VISIT_GAP_MS = 10 * 60000; // re-entering within 10 min continues the same visit

export async function getOrCreateDuty(officerId, day, startedAt = null) {
  let d = await q1('SELECT * FROM duty_days WHERE officer_id = $1 AND day = $2', [officerId, day]);
  if (!d) {
    d = await q1(
      `INSERT INTO duty_days (officer_id, day, started_at) VALUES ($1,$2,$3)
       ON CONFLICT (officer_id, day) DO UPDATE SET updated_at = now() RETURNING *`,
      [officerId, day, startedAt]);
  }
  return d;
}

export async function ingestPoints(user, rawPoints) {
  const now = Date.now();
  let points = (Array.isArray(rawPoints) ? rawPoints : []).slice(0, 500).map((p) => ({
    ts: new Date(p.ts).getTime(), lat: num(p.lat), lng: num(p.lng), accuracy: num(p.accuracy),
    speed: num(p.speed), heading: num(p.heading), battery: num(p.battery),
  })).filter((p) => Number.isFinite(p.ts) && p.ts <= now + 5 * 60000 && validLatLng(p.lat, p.lng)
    && (p.accuracy === null || p.accuracy <= MAX_ACCURACY_M));
  points.sort((a, b) => a.ts - b.ts);
  if (!points.length) return { accepted: 0, distance_m: 0 };

  const day = istDay(new Date(points[points.length - 1].ts));
  points = points.filter((p) => istDay(new Date(p.ts)) === day);
  const duty = await getOrCreateDuty(user.id, day, new Date(points[0].ts).toISOString());
  if (duty.ended_at) return { accepted: 0, distance_m: Math.round(duty.distance_m) };

  // a retried batch must not be counted twice
  const lastTs = duty.last_point_at ? new Date(duty.last_point_at).getTime() : 0;
  points = points.filter((p) => p.ts > lastTs);
  if (!points.length) return { accepted: 0, distance_m: Math.round(duty.distance_m) };

  let { distance_m: distance, anchor_lat: aLat, anchor_lng: aLng } = duty;
  let prevTs = lastTs;
  const kept = [];
  for (const p of points) {
    if (aLat === null || aLat === undefined) { aLat = p.lat; aLng = p.lng; kept.push(p); prevTs = p.ts; continue; }
    const d = haversine(aLat, aLng, p.lat, p.lng);
    const dt = Math.max(1, (p.ts - prevTs) / 1000);
    if (d / dt > MAX_SPEED_MS && d > 200) continue; // glitch: skip the point entirely
    if (d >= Math.max(MOVE_THRESHOLD_M, Math.min(p.accuracy || 0, 40))) { distance += d; aLat = p.lat; aLng = p.lng; }
    kept.push(p); prevTs = p.ts;
  }
  if (!kept.length) return { accepted: 0, distance_m: Math.round(distance) };

  await q(
    `INSERT INTO location_points (officer_id, day, ts, lat, lng, accuracy, speed, heading, battery)
     SELECT $1, $2, to_timestamp(t / 1000.0), la, ln, ac, sp, hd, bt
     FROM unnest($3::float8[], $4::float8[], $5::float8[], $6::real[], $7::real[], $8::real[], $9::smallint[])
       AS x(t, la, ln, ac, sp, hd, bt)
     ON CONFLICT (officer_id, ts) DO NOTHING`,
    [user.id, day, kept.map((p) => p.ts), kept.map((p) => p.lat), kept.map((p) => p.lng),
      kept.map((p) => p.accuracy), kept.map((p) => p.speed), kept.map((p) => p.heading),
      kept.map((p) => (p.battery === null ? null : Math.round(p.battery)))]);

  const last = kept[kept.length - 1];
  await q(
    `UPDATE duty_days SET distance_m = $3, anchor_lat = $4, anchor_lng = $5, last_lat = $6, last_lng = $7,
       last_point_at = to_timestamp($8 / 1000.0), battery = COALESCE($9, battery), location_on = true,
       no_signal_alerted = false, started_at = COALESCE(started_at, to_timestamp($10 / 1000.0)), updated_at = now()
     WHERE officer_id = $1 AND day = $2`,
    [user.id, day, distance, aLat, aLng, last.lat, last.lng, last.ts,
      last.battery === null ? null : Math.round(last.battery), kept[0].ts]);

  await updateVisits(user.id, day, kept);
  const settings = await getSettings();
  // only a fresh position can be part of a live meeting
  if (now - last.ts < 3 * 60000 && inOfficeHours(settings)) {
    await detectMeeting(user, last, day, settings).catch((e) => console.error('meeting check failed', e.message));
  }
  await runLazyChecks().catch((e) => console.error('lazy checks failed', e.message));
  return { accepted: kept.length, distance_m: Math.round(distance) };
}

// Geofence: time spent inside each of today's given locations.
async function updateVisits(officerId, day, points, only = null) {
  const assignments = only || await q('SELECT id, lat, lng, radius_m FROM assignments WHERE officer_id = $1 AND day = $2', [officerId, day]);
  if (!assignments.length) return;
  for (const a of assignments) {
    const inside = points.filter((p) => haversine(a.lat, a.lng, p.lat, p.lng) <= a.radius_m + Math.min(p.accuracy || 0, 20));
    if (!inside.length) continue;
    let open = await q1('SELECT id, enter_at, exit_at FROM visits WHERE assignment_id = $1 ORDER BY exit_at DESC LIMIT 1', [a.id]);
    let cur = open ? { id: open.id, exit: new Date(open.exit_at).getTime(), dirty: false } : null;
    for (const p of inside) {
      if (cur && p.ts - cur.exit <= VISIT_GAP_MS) {
        if (p.ts > cur.exit) { cur.exit = p.ts; cur.dirty = true; }
      } else {
        if (cur && cur.dirty) await q('UPDATE visits SET exit_at = to_timestamp($2 / 1000.0) WHERE id = $1', [cur.id, cur.exit]);
        const v = await q1(
          `INSERT INTO visits (assignment_id, officer_id, day, enter_at, exit_at)
           VALUES ($1,$2,$3,to_timestamp($4 / 1000.0),to_timestamp($4 / 1000.0)) RETURNING id`,
          [a.id, officerId, day, p.ts]);
        cur = { id: v.id, exit: p.ts, dirty: false };
      }
    }
    if (cur && cur.dirty) await q('UPDATE visits SET exit_at = to_timestamp($2 / 1000.0) WHERE id = $1', [cur.id, cur.exit]);
  }
}

// 3 or more field officers standing together during office hours -> alert the ADMIN only.
async function detectMeeting(user, pos, day, s) {
  const others = await q(
    `SELECT d.officer_id, u.name, d.last_lat AS lat, d.last_lng AS lng
     FROM duty_days d JOIN users u ON u.id = d.officer_id
     WHERE d.day = $1 AND d.ended_at IS NULL AND d.officer_id <> $2 AND d.last_lat IS NOT NULL
       AND d.last_point_at > now() - interval '5 minutes' AND u.active AND u.role = 'field_officer'`,
    [day, user.id]);
  const near = others.filter((o) => haversine(pos.lat, pos.lng, o.lat, o.lng) <= s.meeting_radius_m);
  if (near.length + 1 < s.meeting_min_officers) return;

  // officers gathering at their own branch office is normal, not a "meeting"
  const branches = await q('SELECT lat, lng FROM branches WHERE lat IS NOT NULL AND lng IS NOT NULL');
  if (branches.some((b) => haversine(pos.lat, pos.lng, b.lat, b.lng) <= 150)) return;

  const ids = [user.id, ...near.map((o) => o.officer_id)].sort((a, b) => a - b);
  const names = [user.name, ...near.map((o) => o.name)];
  const open = await q1(
    `SELECT * FROM meetings WHERE day = $1 AND last_seen_at > now() - interval '6 minutes' AND officer_ids && $2::int[]
     ORDER BY started_at LIMIT 1`, [day, ids]);
  if (!open || haversine(pos.lat, pos.lng, open.lat, open.lng) > s.meeting_radius_m * 4) {
    await q('INSERT INTO meetings (day, lat, lng, officer_ids, started_at, last_seen_at) VALUES ($1,$2,$3,$4::int[],now(),now())',
      [day, pos.lat, pos.lng, ids]);
    return;
  }
  const merged = [...new Set([...open.officer_ids, ...ids])].sort((a, b) => a - b);
  const minutes = (Date.now() - new Date(open.started_at).getTime()) / 60000;
  const shouldAlert = !open.alerted && minutes >= s.meeting_min_minutes;
  const upd = await q1(
    `UPDATE meetings SET last_seen_at = now(), officer_ids = $2::int[], alerted = alerted OR $3
     WHERE id = $1 AND (alerted = false OR $3 = false) RETURNING id`, [open.id, merged, shouldAlert]);
  if (shouldAlert && upd) {
    const all = await q('SELECT name FROM users WHERE id = ANY($1::int[]) ORDER BY name', [merged]);
    const list = all.length ? all.map((r) => r.name) : names;
    await createAlert({
      type: 'meeting', target_role: 'admin', officer_id: null, branch_id: null,
      title: `${list.length} field officers are together at one place`,
      body: `${list.join(', ')} have been at the same location for ${Math.round(minutes)} minutes during office hours.`,
      data: { lat: open.lat, lng: open.lng, officer_ids: merged, names: list, started_at: open.started_at },
    });
  }
}

// A location given after the officer has already been there: work out the visit from the saved points.
export async function backfillVisits(assignmentId) {
  const a = await q1('SELECT id, officer_id, day, lat, lng, radius_m FROM assignments WHERE id = $1', [assignmentId]);
  if (!a) return;
  const rows = await q('SELECT ts, lat, lng, accuracy FROM location_points WHERE officer_id = $1 AND day = $2 ORDER BY ts', [a.officer_id, a.day]);
  if (!rows.length) return;
  await updateVisits(a.officer_id, a.day, rows.map((p) => ({ ...p, ts: new Date(p.ts).getTime() })), [a]);
}
