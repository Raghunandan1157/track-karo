// Dashboard: stat cards, officers table, recent alerts. Updated live from the stream.
import { get } from '../api.js';
import { $, cloneTpl, fill, setEmpty, chip, label, fmtKm, fmtWhen, STATUS_LABELS, ALERT_LABELS, ALERT_ICONS, toastError, todayIST } from '../ui.js';
import { state, on, loadOfficers, officersList, setUnread } from '../state.js';
import { openReplay } from './replay.js';

const RECENT_ALERTS = 8;
let loaded = false;
let loading = null;
let stats = {};

const STAT_FIELDS = ['officers_total', 'on_duty', 'on_lunch', 'location_off', 'day_ended', 'distance_km_today',
  'assignments_total', 'assignments_visited', 'customers_total', 'customers_located', 'unread_alerts'];

function renderStats() {
  for (const f of STAT_FIELDS) {
    const el = $('stat-' + f);
    if (!el || stats[f] === undefined) continue;
    el.textContent = f === 'distance_km_today' ? Number(stats[f] || 0).toFixed(1) : String(stats[f] ?? 0);
  }
}

/** Recompute status counters + distance from the live officer store. */
function recomputeFromOfficers() {
  const list = officersList();
  if (!list.length) return;
  const count = (s) => list.filter((o) => o.status === s).length;
  stats.officers_total = list.length;
  stats.on_duty = count('on_duty');
  stats.on_lunch = count('on_lunch');
  stats.location_off = count('location_off');
  stats.day_ended = count('day_ended');
  stats.distance_km_today = list.reduce((s, o) => s + (Number(o.distance_m) || 0), 0) / 1000;
  stats.assignments_total = list.reduce((s, o) => s + (Number(o.assignments_total) || 0), 0) || stats.assignments_total;
  stats.assignments_visited = list.reduce((s, o) => s + (Number(o.assignments_visited) || 0), 0) || stats.assignments_visited;
  renderStats();
}

function officerValues(o) {
  return {
    name: o.name,
    branch_name: o.branch_name,
    status: chip(label(STATUS_LABELS, o.status), o.status || ''),
    distance_km: fmtKm(o.distance_m),
    assignments_visited: o.assignments_visited ?? 0,
    assignments_total: o.assignments_total ?? 0,
    last_point_at: fmtWhen(o.last_point_at),
  };
}

function renderOfficers() {
  const tbody = $('dash-officers');
  tbody.textContent = '';
  const list = officersList();
  for (const o of list) {
    const tr = cloneTpl('tpl-dash-officer');
    tr.dataset.officerId = o.id;
    fill(tr, officerValues(o));
    tbody.appendChild(tr);
  }
  setEmpty('dash-officers', list.length === 0);
}

function updateOfficerRow(o) {
  const tr = $('dash-officers').querySelector(`tr[data-officer-id="${CSS.escape(String(o.id))}"]`);
  if (tr) fill(tr, officerValues(o));
  else renderOfficers();
}

function alertItem(a) {
  const li = cloneTpl('tpl-dash-alert');
  li.dataset.alertId = a.id;
  li.classList.toggle('is-unread', !a.read_at);
  fill(li, {
    type_icon: ALERT_ICONS[a.type] || '#i-bell',
    title: a.title,
    officer_name: a.officer_name,
    created_at: fmtWhen(a.created_at),
    type: chip(label(ALERT_LABELS, a.type), a.type || ''),
  });
  return li;
}

function renderAlerts(alerts) {
  const ul = $('dash-alerts');
  ul.textContent = '';
  alerts.slice(0, RECENT_ALERTS).forEach((a) => ul.appendChild(alertItem(a)));
  setEmpty('dash-alerts', ul.children.length === 0);
}

async function load() {
  if (loading) return loading;
  const tbody = $('dash-officers');
  tbody.classList.add('is-loading');
  loading = (async () => {
    try {
      const [dash, , alerts] = await Promise.all([
        get('/dashboard'),
        loadOfficers(true),
        get('/alerts', { limit: RECENT_ALERTS }),
      ]);
      stats = { ...dash };
      renderStats();
      setUnread(dash.unread_alerts ?? alerts.unread_count ?? state.unread);
      renderOfficers();
      renderAlerts(alerts.alerts || []);
      loaded = true;
    } catch (err) {
      toastError(err, 'Could not load the dashboard');
    } finally {
      tbody.classList.remove('is-loading');
      loading = null;
    }
  })();
  return loading;
}

function init() {
  $('dash-officers').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="replay"]');
    if (!btn) return;
    const tr = btn.closest('tr[data-officer-id]');
    if (tr) openReplay(tr.dataset.officerId, todayIST());
  });

  on('location', ({ officer }) => {
    if (!loaded || !officer) return;
    updateOfficerRow(officer);
    recomputeFromOfficers();
  });
  on('alert', (a) => {
    if (!loaded) return;
    const ul = $('dash-alerts');
    ul.prepend(alertItem(a));
    while (ul.children.length > RECENT_ALERTS) ul.lastElementChild.remove();
    setEmpty('dash-alerts', false);
  });
  on('customer', () => {
    if (!loaded) return;
    // Located count is an approximation until the next load (a re-located customer is counted again).
    stats.customers_located = Math.min((stats.customers_located || 0) + 1, stats.customers_total || Infinity);
    renderStats();
  });
  on('alert:read', ({ id, all }) => {
    const ul = $('dash-alerts');
    if (all) ul.querySelectorAll('.is-unread').forEach((li) => li.classList.remove('is-unread'));
    else ul.querySelector(`[data-alert-id="${CSS.escape(String(id))}"]`)?.classList.remove('is-unread');
  });
}

export default {
  init,
  show() { if (!loaded) load(); },
  refresh: load,
};
