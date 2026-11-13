// Track_karo - DOM helpers, formatting (India time), toasts, confirm dialog.

export const $ = (id) => document.getElementById(id);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const TZ = 'Asia/Kolkata';
const fmtTimeF = new Intl.DateTimeFormat('en-IN', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true });
const fmtTimeSecF = new Intl.DateTimeFormat('en-IN', { timeZone: TZ, hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
const fmtDateF = new Intl.DateTimeFormat('en-IN', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' });
const fmtDateTimeF = new Intl.DateTimeFormat('en-IN', { timeZone: TZ, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
const fmtDateTimeSecF = new Intl.DateTimeFormat('en-IN', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
const ymdF = new Intl.DateTimeFormat('en-IN', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

export const DASH = '-';

function toDate(v) {
  if (v === null || v === undefined || v === '') return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** YYYY-MM-DD of a date in India time. */
export function ymdIST(v = new Date()) {
  const d = toDate(v);
  if (!d) return '';
  const p = Object.fromEntries(ymdF.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export const todayIST = () => ymdIST(new Date());

export const fmtTime = (v) => { const d = toDate(v); return d ? fmtTimeF.format(d) : DASH; };
export const fmtTimeSec = (v) => { const d = toDate(v); return d ? fmtTimeSecF.format(d) : DASH; };
export const fmtDateTime = (v) => { const d = toDate(v); return d ? fmtDateTimeF.format(d) : DASH; };
export const fmtDateTimeSec = (v) => { const d = toDate(v); return d ? fmtDateTimeSecF.format(d) : DASH; };
/** Time only if the moment is today (IST), else date + time. */
export const fmtWhen = (v) => { const d = toDate(v); if (!d) return DASH; return ymdIST(d) === todayIST() ? fmtTimeF.format(d) : fmtDateTimeF.format(d); };
/** 'YYYY-MM-DD' -> '13 Nov 2026'. */
export function fmtDay(day) {
  if (!day) return DASH;
  const d = toDate(`${day}T12:00:00+05:30`);
  return d ? fmtDateF.format(d) : day;
}
/** Minutes -> "1h 25m" / "25m". */
export function fmtDuration(min) {
  if (min === null || min === undefined || min === '' || Number.isNaN(Number(min))) return DASH;
  const m = Math.max(0, Math.round(Number(min)));
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
}
/** metres -> "12.34" (km, 2 decimals). */
export function fmtKm(m, digits = 2) {
  const n = Number(m);
  return Number.isFinite(n) ? (n / 1000).toFixed(digits) : (0).toFixed(digits);
}
export function fmtNum(v, digits) {
  if (v === null || v === undefined || v === '') return DASH;
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return digits === undefined ? String(n) : n.toFixed(digits);
}

// ---------- labels ----------
export const STATUS_LABELS = {
  off_duty: 'Off duty', on_duty: 'On duty', on_lunch: 'On lunch',
  location_off: 'Location off', no_signal: 'No signal', day_ended: 'Day ended',
};
export const ALERT_LABELS = {
  location_off: 'Location off', no_signal: 'No signal', geofence_missed: 'Geofence missed',
  meeting: 'Meeting', long_break: 'Long break',
};
export const ALERT_ICONS = {
  location_off: '#i-location-off', no_signal: '#i-no-signal', geofence_missed: '#i-geofence-missed',
  meeting: '#i-meeting', long_break: '#i-long-break',
};
export const ROLE_LABELS = { admin: 'Admin', branch_manager: 'Branch manager', field_officer: 'Field officer', recovery_manager: 'Recovery manager' };
export const KIND_LABELS = { center: 'Center', village: 'Village', visit: 'Visit', lunch: 'Lunch', unexplained: 'Unexplained stop', customer: 'Customer' };
export const KIND_ICONS = { visit: '#i-visit', lunch: '#i-lunch', unexplained: '#i-unexplained', customer: '#i-customer' };

export const label = (map, v) => (v === null || v === undefined || v === '' ? DASH : (map[v] || String(v).replace(/_/g, ' ')));
/** Chip value object: fill() puts text in textContent and the raw value in data-value. */
export const chip = (text, value) => ({ text, value });

// ---------- templates ----------
export function cloneTpl(id) {
  const tpl = document.getElementById(id);
  return tpl.content.firstElementChild.cloneNode(true);
}

export function setIcon(svg, href) {
  if (!svg || !href) return;
  let use = svg.querySelector('use');
  if (!use) { use = document.createElementNS('http://www.w3.org/2000/svg', 'use'); svg.appendChild(use); }
  use.setAttribute('href', href);
}

/**
 * Fill every [data-field] inside root (and root itself) from `values`.
 * - value may be a primitive, or {text, value} for chips (raw value -> data-value + data-<field>).
 * - <svg> gets its <use href> swapped; <a> gets its href.
 */
export function fill(root, values) {
  const nodes = root.querySelectorAll('[data-field]');
  const list = root.hasAttribute && root.hasAttribute('data-field') ? [root, ...nodes] : nodes;
  for (const el of list) {
    const key = el.getAttribute('data-field');
    if (!(key in values)) continue;
    let v = values[key];
    let raw;
    if (v && typeof v === 'object' && !Array.isArray(v) && 'text' in v) { raw = v.value; v = v.text; }
    const tag = el.tagName.toLowerCase();
    if (tag === 'svg') { setIcon(el, v); continue; }
    if (tag === 'a') {
      if (v) { el.setAttribute('href', v); el.removeAttribute('aria-disabled'); el.hidden = false; }
      else { el.removeAttribute('href'); el.setAttribute('aria-disabled', 'true'); el.hidden = true; }
      continue;
    }
    el.textContent = v === null || v === undefined || v === '' ? DASH : String(v);
    if (el.classList.contains('chip')) {
      const rv = raw === undefined || raw === null ? String(v ?? '') : String(raw);
      el.dataset.value = rv;
      el.setAttribute('data-' + key.replace(/_/g, '-'), rv);
    }
  }
  return root;
}

/** Show the empty state `#<listId>-empty` when count is 0. */
export function setEmpty(listId, isEmpty) {
  const el = document.getElementById(listId + '-empty');
  if (el) el.hidden = !isEmpty;
}

export function setLoading(el, on) {
  if (!el) return;
  el.classList.toggle('is-loading', !!on);
  if (el.tagName === 'BUTTON') el.disabled = !!on;
  el.setAttribute('aria-busy', on ? 'true' : 'false');
}

export async function withLoading(el, fn) {
  setLoading(el, true);
  try { return await fn(); } finally { setLoading(el, false); }
}

export function showError(el, msg) {
  if (!el) return;
  el.textContent = msg || '';
  el.hidden = !msg;
}

export function debounce(fn, ms = 300) {
  let t;
  const d = (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  d.cancel = () => clearTimeout(t);
  return d;
}

// ---------- toasts ----------
export function toast(title, body = '', type = 'info', ms) {
  const box = $('toasts');
  if (!box) return null;
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.setAttribute('role', type === 'error' || type === 'alert' ? 'alert' : 'status');
  const t = document.createElement('div');
  t.className = 'toast__title';
  t.textContent = title;
  el.appendChild(t);
  if (body) {
    const b = document.createElement('div');
    b.className = 'toast__body';
    b.textContent = body;
    el.appendChild(b);
  }
  el.addEventListener('click', () => el.remove());
  box.appendChild(el);
  while (box.children.length > 5) box.firstElementChild.remove();
  setTimeout(() => el.remove(), ms ?? (type === 'alert' ? 10000 : 5000));
  return el;
}
export const toastError = (err, title = 'Something went wrong') => toast(title, err?.message || String(err || ''), 'error');

// ---------- dialogs ----------
export function openDialog(dlg) {
  if (!dlg) return;
  if (typeof dlg.showModal === 'function') { if (!dlg.open) dlg.showModal(); }
  else dlg.setAttribute('open', '');
}
export function closeDialog(dlg) {
  if (!dlg) return;
  if (typeof dlg.close === 'function') { if (dlg.open) dlg.close(); }
  else dlg.removeAttribute('open');
}

/** Generic [data-close] buttons + click on the backdrop close the parent <dialog>. */
export function initDialogs() {
  document.addEventListener('click', (e) => {
    const closer = e.target.closest('[data-close]');
    if (closer) {
      const dlg = closer.closest('dialog');
      if (dlg) { e.preventDefault(); closeDialog(dlg); }
      return;
    }
    if (e.target instanceof HTMLDialogElement && e.target.classList.contains('modal')) {
      const r = e.target.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) closeDialog(e.target);
    }
  });
}

let confirmResolve = null;
/** Promise-based confirm using #modal-confirm. Resolves true/false. */
export function confirmDialog({ title = 'Are you sure?', message = '', okText = 'Confirm' } = {}) {
  const dlg = $('modal-confirm');
  if (!dlg) return Promise.resolve(window.confirm(message || title));
  if (confirmResolve) { confirmResolve(false); confirmResolve = null; }
  $('confirm-title').textContent = title;
  $('confirm-message').textContent = message;
  $('btn-confirm-ok').textContent = okText;
  return new Promise((resolve) => {
    confirmResolve = resolve;
    openDialog(dlg);
    $('btn-confirm-ok').focus();
  });
}
export function initConfirm() {
  const dlg = $('modal-confirm');
  if (!dlg) return;
  $('btn-confirm-ok').addEventListener('click', () => {
    const r = confirmResolve; confirmResolve = null;
    closeDialog(dlg);
    if (r) r(true);
  });
  dlg.addEventListener('close', () => {
    const r = confirmResolve; confirmResolve = null;
    if (r) r(false);
  });
}

// ---------- selects ----------
/** Replace all options except a leading placeholder (value=""). */
export function setOptions(select, items, { keepPlaceholder = true } = {}) {
  if (!select) return;
  const prev = select.value;
  const placeholder = keepPlaceholder ? Array.from(select.options).find((o) => o.value === '') : null;
  select.textContent = '';
  if (placeholder) select.appendChild(placeholder);
  for (const it of items) {
    const o = document.createElement('option');
    o.value = String(it.value);
    o.textContent = it.label;
    select.appendChild(o);
  }
  if (Array.from(select.options).some((o) => o.value === prev)) select.value = prev;
}

// ---------- CSV ----------
export function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
export function downloadCsv(filename, rows) {
  const text = '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/** Parse CSV text into rows of trimmed cells (handles quotes). */
export function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  const s = String(text || '').replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',' || c === '\t') { row.push(cell.trim()); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cell.trim()); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  row.push(cell.trim()); rows.push(row);
  return rows.filter((r) => r.some((x) => x !== ''));
}

export function googleMapsUrl(lat, lng) {
  return `https://www.google.com/maps?q=${encodeURIComponent(lat)},${encodeURIComponent(lng)}`;
}

export const num = (v) => {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
export const hasCoords = (o) => o && num(o.lat) !== null && num(o.lng) !== null;
