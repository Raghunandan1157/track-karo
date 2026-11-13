// HRMS - small presentation helpers shared by the HR views.
import { hash } from './seed.js';
import { state } from '../state.js';
import { setOptions, chip } from '../ui.js';
import { branches as hrBranches, departments as hrDepartments } from './store.js';

/** Branch id a manager is limited to; null for admin/HR. */
export const hrScope = () =>
  state.user?.role === 'branch_manager' ? state.user.branch_id ?? null : null;

export const canSeeAllBranches = () => !hrScope();

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export function money(v) {
  const n = Number(v);
  return Number.isFinite(n) ? inr.format(n) : '-';
}

/** 1250000 -> "12.5 L", 48000000 -> "4.8 Cr". Handy in stat cards. */
export function moneyShort(v) {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1e7) return `${(n / 1e7).toFixed(2)} Cr`;
  if (Math.abs(n) >= 1e5) return `${(n / 1e5).toFixed(1)} L`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(0)} K`;
  return String(n);
}

export function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

const AVATAR_COLOURS = ['#2F6DB5', '#1E8E4E', '#B26A00', '#6D3FC0', '#C62828', '#0E7490', '#7C3AED', '#2563EB'];

/** Initials avatar element (no photo uploads yet). */
export function avatar(emp, cls = 'avatar') {
  const el = document.createElement('span');
  el.className = cls;
  el.textContent = initials(emp?.name);
  el.style.setProperty('--avatar', AVATAR_COLOURS[hash(emp?.name || 'x') % AVATAR_COLOURS.length]);
  el.setAttribute('aria-hidden', 'true');
  return el;
}

/** Name + code stacked cell content. */
export function personCell(emp) {
  const wrap = document.createElement('div');
  wrap.className = 'person';
  wrap.appendChild(avatar(emp));
  const box = document.createElement('span');
  box.className = 'person-text';
  const n = document.createElement('span');
  n.className = 'person-name';
  n.textContent = emp?.name || '-';
  const c = document.createElement('span');
  c.className = 'person-code';
  c.textContent = [emp?.emp_code, emp?.designation].filter(Boolean).join(' · ');
  box.append(n, c);
  wrap.appendChild(box);
  return wrap;
}

export const hrChip = (text, value) => chip(text, value);

export function stars(rating) {
  const n = Math.round(Number(rating) || 0);
  return n ? '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n)) : '-';
}

export function fillBranches(select, { includeAll = true, allLabel = 'All branches' } = {}) {
  if (!select) return;
  const scope = hrScope();
  const list = (state.branches?.length ? state.branches : hrBranches())
    .filter((b) => scope === null || String(b.id) === String(scope));
  const items = list.map((b) => ({ value: b.id, label: b.name }));
  setOptions(select, includeAll ? [{ value: '', label: allLabel }, ...items] : items, { keepPlaceholder: false });
}

export function fillDepartments(select, { includeAll = true, allLabel = 'All departments' } = {}) {
  if (!select) return;
  const items = hrDepartments().map((d) => ({ value: d.key, label: d.name }));
  setOptions(select, includeAll ? [{ value: '', label: allLabel }, ...items] : items, { keepPlaceholder: false });
}

/** Pin a branch filter to the manager's branch and stop them changing it. */
export function lockScope(select) {
  const scope = hrScope();
  if (scope === null || !select) return;
  if (!Array.from(select.options).some((o) => String(o.value) === String(scope))) {
    const o = document.createElement('option');
    o.value = String(scope);
    o.textContent = state.user?.branch_name || 'My branch';
    select.appendChild(o);
  }
  select.value = String(scope);
  select.disabled = true;
}

/** Last n months as {value:'YYYY-MM', label:'November 2026'}, newest first. */
export function monthChoices(n = 13) {
  const out = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push({ value, label: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) });
  }
  return out;
}

export function pct(part, whole) {
  return whole ? Math.round((Number(part) / Number(whole)) * 100) : 0;
}

/** One bar row used by department headcount / rating distribution. */
export function barRow(label, value, max, { suffix = '', tone = '', display } = {}) {
  const row = document.createElement('div');
  row.className = 'bar-row';
  const l = document.createElement('span');
  l.className = 'bar-label';
  l.textContent = label;
  const track = document.createElement('span');
  track.className = 'bar-track';
  const fill = document.createElement('span');
  fill.className = 'bar-fill' + (tone ? ` is-${tone}` : '');
  fill.style.width = `${max ? Math.max(3, Math.round((Number(value) / Number(max)) * 100)) : 0}%`;
  track.appendChild(fill);
  const v = document.createElement('span');
  v.className = 'bar-value';
  v.textContent = display !== undefined ? display : `${value}${suffix}`;
  row.append(l, track, v);
  return row;
}

export function emptyRow(tbody, cols, text = 'Nothing to show.') {
  const tr = document.createElement('tr');
  const td = document.createElement('td');
  td.colSpan = cols;
  td.className = 'table-empty';
  td.textContent = text;
  tr.appendChild(td);
  tbody.appendChild(tr);
}
