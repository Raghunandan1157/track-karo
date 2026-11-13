// Alerts: saved in the database (which pushes them to the website/app stream) and,
// when Firebase is configured, also sent as a phone push notification.
import jwt from 'jsonwebtoken';
import { q, q1, getSettings, istDay } from './core.js';

export async function createAlert({ type, target_role, officer_id = null, branch_id = null, title, body = '', data = null }) {
  const alert = await q1(
    `INSERT INTO alerts (type, target_role, officer_id, branch_id, title, body, data)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [type, target_role, officer_id, branch_id, title, body, data ? JSON.stringify(data) : null]);
  // phone push must never break the request
  sendPush(alert).catch((e) => console.error('push failed', e.message));
  return alert;
}

// ---------- Firebase Cloud Messaging (only when FIREBASE_SERVICE_ACCOUNT is set) ----------
let fcmToken = null, fcmTokenExp = 0;
async function fcmAccessToken(sa) {
  if (fcmToken && Date.now() < fcmTokenExp - 60000) return fcmToken;
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    { iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 },
    sa.private_key, { algorithm: 'RS256' });
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('FCM auth failed');
  fcmToken = j.access_token; fcmTokenExp = Date.now() + (j.expires_in || 3600) * 1000;
  return fcmToken;
}

async function sendPush(alert) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return;
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  const tokens = alert.target_role === 'admin'
    ? await q(`SELECT t.token FROM device_tokens t JOIN users u ON u.id = t.user_id
               WHERE t.kind = 'fcm' AND u.active AND u.role = 'admin'`)
    : await q(`SELECT t.token FROM device_tokens t JOIN users u ON u.id = t.user_id
               WHERE t.kind = 'fcm' AND u.active AND u.role = 'branch_manager' AND u.branch_id = $1`, [alert.branch_id]);
  if (!tokens.length) return;
  const access = await fcmAccessToken(sa);
  await Promise.all(tokens.map(async ({ token }) => {
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${access}`, 'content-type': 'application/json' },
      body: JSON.stringify({ message: {
        token,
        notification: { title: alert.title, body: alert.body || '' },
        data: { type: alert.type, alert_id: String(alert.id) },
        android: { priority: 'HIGH' },
      } }),
    });
    if (r.status === 404 || r.status === 400) await q('DELETE FROM device_tokens WHERE token = $1', [token]);
  }));
}

// ---------- checks that have no incoming request of their own ----------
// (phone switched off / app killed, lunch running too long). They run whenever any
// officer uploads points or a manager/admin opens a screen, at most once every 45 s.
let lastChecks = 0;
export async function runLazyChecks(force = false) {
  if (!force && Date.now() - lastChecks < 45000) return;
  lastChecks = Date.now();
  const s = await getSettings();
  const day = istDay();

  const silent = await q(
    `UPDATE duty_days d SET no_signal_alerted = true
     FROM users u
     WHERE u.id = d.officer_id AND d.day = $1 AND d.started_at IS NOT NULL AND d.ended_at IS NULL
       AND d.location_on AND NOT d.no_signal_alerted
       AND COALESCE(d.last_point_at, d.started_at) < now() - make_interval(mins => $2::int)
     RETURNING d.officer_id, u.name, u.branch_id, d.last_lat, d.last_lng, d.last_point_at`,
    [day, s.no_signal_min]);
  for (const o of silent) {
    await createAlert({
      type: 'no_signal', target_role: 'branch_manager', officer_id: o.officer_id, branch_id: o.branch_id,
      title: `No signal from ${o.name}`,
      body: `No location received for ${s.no_signal_min} minutes. The phone may be switched off, the app closed, or there is no network.`,
      data: { lat: o.last_lat, lng: o.last_lng, last_point_at: o.last_point_at },
    });
  }

  const longLunch = await q(
    `UPDATE breaks k SET alerted = true
     FROM users u
     WHERE u.id = k.officer_id AND k.day = $1 AND k.ended_at IS NULL AND NOT k.alerted
       AND k.started_at < now() - make_interval(mins => $2::int)
     RETURNING k.officer_id, u.name, u.branch_id, k.started_at, k.lat, k.lng`,
    [day, s.lunch_allowed_min]);
  for (const o of longLunch) {
    await createAlert({
      type: 'long_break', target_role: 'branch_manager', officer_id: o.officer_id, branch_id: o.branch_id,
      title: `${o.name} is on a long break`,
      body: `Lunch break has crossed the allowed ${s.lunch_allowed_min} minutes.`,
      data: { lat: o.lat, lng: o.lng, started_at: o.started_at },
    });
  }
}

// When a day ends: tell the branch manager which given locations were not visited.
export async function alertMissedAssignments(officerId, day) {
  const missed = await q(
    `SELECT id, name, kind FROM assignment_status WHERE officer_id = $1 AND day = $2 AND NOT visited AND NOT missed_alerted`,
    [officerId, day]);
  if (!missed.length) return [];
  await q('UPDATE assignments SET missed_alerted = true WHERE id = ANY($1::int[])', [missed.map((m) => m.id)]);
  const u = await q1('SELECT name, branch_id FROM users WHERE id = $1', [officerId]);
  await createAlert({
    type: 'geofence_missed', target_role: 'branch_manager', officer_id: officerId, branch_id: u.branch_id,
    title: `${u.name} did not visit ${missed.length} location${missed.length > 1 ? 's' : ''}`,
    body: `Not visited: ${missed.map((m) => m.name).join(', ')}`,
    data: { day, missed: missed.map((m) => m.name) },
  });
  return missed.map((m) => m.name);
}
