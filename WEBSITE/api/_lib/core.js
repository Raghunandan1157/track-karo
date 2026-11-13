// Shared helpers: database, auth, settings, geo maths.
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const { Pool } = pg;
// timestamps come back as ISO strings instead of Date objects
pg.types.setTypeParser(1184, (v) => new Date(v.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00')).toISOString());
pg.types.setTypeParser(1082, (v) => v); // date stays 'YYYY-MM-DD'
pg.types.setTypeParser(20, (v) => Number(v)); // bigint/count

let pool;
export function db() {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 10000 });
    pool.on('error', () => {});
  }
  return pool;
}
export async function q(text, params = []) {
  const r = await db().query(text, params);
  return r.rows;
}
export async function q1(text, params = []) {
  const rows = await q(text, params);
  return rows[0] || null;
}

// ---------- errors ----------
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const bad = (m) => new HttpError(400, m);
export const forbidden = (m = 'Not allowed') => new HttpError(403, m);
export const notFound = (m = 'Not found') => new HttpError(404, m);

// ---------- auth ----------
const secret = () => process.env.JWT_SECRET || 'dev-secret-change-me';
export const hashPassword = (p) => bcrypt.hash(String(p), 10);
export const checkPassword = (p, h) => bcrypt.compare(String(p), h);
export const signToken = (u) => jwt.sign({ id: u.id, role: u.role }, secret(), { expiresIn: '30d' });
export function verifyToken(token) {
  try { return jwt.verify(token, secret()); } catch { return null; }
}
export const USER_COLS = `u.id, u.userid, u.name, u.role, u.branch_id, b.name AS branch_name, u.phone, u.active`;
export async function loadUser(id) {
  return q1(`SELECT ${USER_COLS} FROM users u LEFT JOIN branches b ON b.id = u.branch_id WHERE u.id = $1 AND u.active`, [id]);
}

// ---------- time (India) ----------
export const TZ = 'Asia/Kolkata';
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const hmFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
export const istDay = (d = new Date()) => dayFmt.format(d);
export function istMinutes(d = new Date()) {
  const [h, m] = hmFmt.format(d).split(':').map(Number);
  return (h % 24) * 60 + m;
}
const hm = (s) => { const [h, m] = String(s).split(':').map(Number); return h * 60 + (m || 0); };
export function inOfficeHours(settings, d = new Date()) {
  const now = istMinutes(d);
  return now >= hm(settings.office_start) && now <= hm(settings.office_end);
}
export const validDay = (s) => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : istDay());
export const minutesBetween = (a, b) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 60000));

// ---------- settings ----------
export const DEFAULT_SETTINGS = {
  office_start: '09:30', office_end: '18:30', lunch_allowed_min: 60, stop_min: 20, geofence_radius_m: 60,
  meeting_min_officers: 3, meeting_radius_m: 50, meeting_min_minutes: 15, no_signal_min: 10,
};
let settingsCache = null, settingsAt = 0;
export async function getSettings(force = false) {
  if (!force && settingsCache && Date.now() - settingsAt < 30000) return settingsCache;
  const rows = await q('SELECT key, value FROM settings');
  const s = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (r.key in s) s[r.key] = r.value;
  settingsCache = s; settingsAt = Date.now();
  return s;
}
export async function saveSettings(patch) {
  for (const [k, v] of Object.entries(patch)) {
    if (!(k in DEFAULT_SETTINGS)) continue;
    let val = v;
    if (typeof DEFAULT_SETTINGS[k] === 'number') {
      val = Number(v);
      if (!Number.isFinite(val) || val < 0) throw bad(`Invalid value for ${k}`);
    } else if (!/^\d{1,2}:\d{2}$/.test(String(v))) throw bad(`Invalid time for ${k}`);
    await q(`INSERT INTO settings (key, value) VALUES ($1, $2::jsonb)
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [k, JSON.stringify(val)]);
  }
  return getSettings(true);
}

// ---------- geo ----------
export function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000, toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad, dLng = (lng2 - lng1) * toRad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
export const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
export function validLatLng(lat, lng) {
  const a = num(lat), b = num(lng);
  return a !== null && b !== null && Math.abs(a) <= 90 && Math.abs(b) <= 180 && !(a === 0 && b === 0);
}

// ---------- officer status ----------
export function officerStatus(o, settings, now = Date.now()) {
  if (!o.started_at) return 'off_duty';
  if (o.ended_at) return 'day_ended';
  if (o.location_on === false) return 'location_off';
  if (o.on_lunch) return 'on_lunch';
  const last = o.last_point_at ? new Date(o.last_point_at).getTime() : new Date(o.started_at).getTime();
  if (now - last > settings.no_signal_min * 60000) return 'no_signal';
  return 'on_duty';
}
