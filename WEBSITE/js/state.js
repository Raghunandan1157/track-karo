// Track_karo - shared in-memory state, event bus and cached lookups.
import { get } from './api.js';
import { setOptions } from './ui.js';

export const DEFAULT_SETTINGS = {
  office_start: '09:30', office_end: '18:30', lunch_allowed_min: 60, stop_min: 20,
  geofence_radius_m: 60, meeting_min_officers: 3, meeting_radius_m: 50,
  meeting_min_minutes: 15, no_signal_min: 10,
};

export const state = {
  user: null,
  settings: { ...DEFAULT_SETTINGS },
  /** officer id -> officer object (from /officers or /live, kept fresh by the stream) */
  officers: new Map(),
  officersLoaded: false,
  branches: null,
  unread: 0,
  currentView: null,
};

// ---------- event bus ----------
const bus = new EventTarget();
export function on(name, fn) {
  const h = (e) => fn(e.detail);
  bus.addEventListener(name, h);
  return () => bus.removeEventListener(name, h);
}
export function emit(name, detail) {
  bus.dispatchEvent(new CustomEvent(name, { detail }));
}

// ---------- roles ----------
export const isAdmin = () => state.user?.role === 'admin';
export const isManager = () => state.user?.role === 'branch_manager';
export const isRecoveryManager = () => state.user?.role === 'recovery_manager';
export const ownBranchId = () => (isManager() ? state.user?.branch_id ?? null : null);

// ---------- branches ----------
let branchesPromise = null;
export function getBranches(force = false) {
  if (force) branchesPromise = null;
  if (!branchesPromise) {
    branchesPromise = get('/branches')
      .then((r) => {
        let list = r.branches || [];
        const own = ownBranchId();
        if (own !== null && own !== undefined) list = list.filter((b) => String(b.id) === String(own));
        state.branches = list;
        return list;
      })
      .catch((err) => { branchesPromise = null; throw err; });
  }
  return branchesPromise;
}
export const branchName = (id) => state.branches?.find((b) => String(b.id) === String(id))?.name || '';

/**
 * Fill a branch <select> (keeps its "" placeholder). For a branch manager the
 * own branch is preselected and the select locked.
 */
export async function fillBranchSelect(select) {
  if (!select) return;
  const list = await getBranches();
  setOptions(select, list.map((b) => ({ value: b.id, label: b.name })));
  lockBranchSelect(select);
}
export function lockBranchSelect(select) {
  const own = ownBranchId();
  if (own === null || own === undefined || !select) return;
  if (!Array.from(select.options).some((o) => o.value === String(own))) {
    const o = document.createElement('option');
    o.value = String(own);
    o.textContent = state.user?.branch_name || 'My branch';
    select.appendChild(o);
  }
  select.value = String(own);
  select.disabled = true;
}

// ---------- officers ----------
let officersPromise = null;
export function mergeOfficer(o) {
  if (!o || o.id === undefined || o.id === null) return null;
  const key = String(o.id);
  const prev = state.officers.get(key);
  const merged = prev ? Object.assign(prev, o) : { ...o };
  state.officers.set(key, merged);
  return merged;
}
export function getOfficer(id) { return state.officers.get(String(id)) || null; }

export function loadOfficers(force = false) {
  if (force) officersPromise = null;
  if (!officersPromise) {
    officersPromise = get('/officers')
      .then((r) => {
        const list = r.officers || [];
        const ids = new Set(list.map((o) => String(o.id)));
        for (const k of Array.from(state.officers.keys())) if (!ids.has(k)) state.officers.delete(k);
        list.forEach(mergeOfficer);
        state.officersLoaded = true;
        return officersList();
      })
      .catch((err) => { officersPromise = null; throw err; });
  }
  return officersPromise;
}
export function officersList(branchId) {
  let list = Array.from(state.officers.values());
  if (branchId) list = list.filter((o) => String(o.branch_id) === String(branchId));
  return list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}
export async function fillOfficerSelect(select, branchId) {
  if (!select) return;
  await loadOfficers();
  setOptions(select, officersList(branchId).map((o) => ({
    value: o.id,
    label: o.branch_name && isAdmin() ? `${o.name} (${o.branch_name})` : o.name,
  })));
}

/** Apply a stream `location` event to the officer store; returns the merged officer. */
export function applyLocation(ev) {
  if (!ev || ev.officer_id === undefined) return null;
  const patch = { id: ev.officer_id };
  if (ev.name) patch.name = ev.name;
  if (ev.lat !== undefined && ev.lat !== null) patch.lat = ev.lat;
  if (ev.lng !== undefined && ev.lng !== null) patch.lng = ev.lng;
  if (ev.ts) patch.last_point_at = ev.ts;
  if (ev.status) patch.status = ev.status;
  if (ev.distance_m !== undefined && ev.distance_m !== null) patch.distance_m = ev.distance_m;
  if (ev.branch_id !== undefined && ev.branch_id !== null) patch.branch_id = ev.branch_id;
  return mergeOfficer(patch);
}

// ---------- unread alerts ----------
export function setUnread(n) {
  state.unread = Math.max(0, Number(n) || 0);
  const txt = state.unread > 99 ? '99+' : String(state.unread);
  for (const id of ['bell-badge', 'nav-alerts-badge']) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.textContent = txt;
    el.hidden = state.unread === 0;
  }
  const stat = document.getElementById('stat-unread_alerts');
  if (stat) stat.textContent = String(state.unread);
}
export const bumpUnread = (d = 1) => setUnread(state.unread + d);
