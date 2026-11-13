// Daily reports: summary rows + expandable details, CSV export, print.
import { get } from '../api.js';
import {
  $, cloneTpl, fill, setEmpty, chip, label, toast, toastError, todayIST, fmtTime, fmtDay,
  fmtDuration, fmtNum, downloadCsv, googleMapsUrl, KIND_LABELS, hasCoords,
} from '../ui.js';
import { fillBranchSelect, fillOfficerSelect } from '../state.js';

let loaded = false;
let reports = [];
let reportDay = '';
let seq = 0;

const n0 = (v) => (v === null || v === undefined || v === '' ? 0 : Number(v) || 0);

function rowValues(r) {
  return {
    officer_name: r.officer_name,
    branch_name: r.branch_name,
    started_at: fmtTime(r.started_at),
    ended_at: fmtTime(r.ended_at),
    duty_minutes: fmtDuration(r.duty_minutes),
    distance_km: fmtNum(n0(r.distance_km), 2),
    centers_visited: n0(r.centers_visited),
    centers_assigned: n0(r.centers_assigned),
    villages_visited: n0(r.villages_visited),
    villages_assigned: n0(r.villages_assigned),
    time_at_locations_min: n0(r.time_at_locations_min),
    lunch_minutes: n0(r.lunch_minutes),
    lunch_allowed_min: n0(r.lunch_allowed_min),
    lunch_excess_min: n0(r.lunch_excess_min),
    unexplained_stop_count: (r.unexplained_stops || []).length,
    unexplained_stop_min: n0(r.unexplained_stop_min),
    customers_captured: n0(r.customers_captured),
    location_off_count: n0(r.location_off_count),
    long_break: r.long_break ? chip('Yes', 'long_break') : chip('No', 'ok'),
  };
}

function render() {
  const tbody = $('reports-table');
  tbody.textContent = '';
  reports.forEach((r, i) => {
    const tr = cloneTpl('tpl-report-row');
    tr.dataset.officerId = r.officer_id;
    tr.dataset.index = String(i);
    fill(tr, rowValues(r));
    // Highlights (CSS hooks): lunch over the allowance, long break.
    const excess = n0(r.lunch_excess_min) > 0;
    tr.toggleAttribute('data-lunch-excess', excess);
    tr.toggleAttribute('data-long-break', !!r.long_break);
    const excessCell = tr.querySelector('[data-field="lunch_excess_min"]');
    if (excessCell) excessCell.toggleAttribute('data-excess', excess);
    tbody.appendChild(tr);
  });
  setEmpty('reports', reports.length === 0);
  $('reports-day-label').textContent = fmtDay(reportDay);
}

function buildDetail(r) {
  const detail = cloneTpl('tpl-report-detail');
  const lists = {
    visit_details: (r.visit_details || []).map((v) => {
      const tr = cloneTpl('tpl-report-visit');
      fill(tr, {
        name: v.name,
        kind: chip(label(KIND_LABELS, v.kind), v.kind || ''),
        visited: v.visited ? chip('Yes', 'yes') : chip('No', 'no'),
        enter_at: fmtTime(v.enter_at),
        exit_at: fmtTime(v.exit_at),
        minutes: v.minutes ?? '-',
      });
      return tr;
    }),
    unexplained_stops: (r.unexplained_stops || []).map((s) => {
      const li = cloneTpl('tpl-report-stop');
      fill(li, {
        start: fmtTime(s.start),
        end: fmtTime(s.end),
        minutes: s.minutes ?? '-',
        map_link: hasCoords(s) ? googleMapsUrl(s.lat, s.lng) : '',
      });
      return li;
    }),
    missed: (r.missed || []).map((name) => {
      const li = cloneTpl('tpl-report-missed');
      fill(li, { name: typeof name === 'string' ? name : name?.name });
      return li;
    }),
  };
  for (const [key, nodes] of Object.entries(lists)) {
    const box = detail.querySelector(`[data-list="${key}"]`);
    nodes.forEach((n) => box.appendChild(n));
    const empty = detail.querySelector(`[data-empty="${key}"]`);
    if (empty) empty.hidden = nodes.length > 0;
  }
  return detail;
}

function toggleDetail(btn) {
  const tr = btn.closest('tr.report-row');
  if (!tr) return;
  const next = tr.nextElementSibling;
  if (next && next.classList.contains('report-detail-row')) {
    next.remove();
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'Show details');
    btn.classList.remove('is-active');
    tr.classList.remove('is-selected');
    return;
  }
  const r = reports[Number(tr.dataset.index)];
  if (!r) return;
  tr.after(buildDetail(r));
  btn.setAttribute('aria-expanded', 'true');
  btn.setAttribute('aria-label', 'Hide details');
  btn.classList.add('is-active');
  tr.classList.add('is-selected');
}

async function load() {
  const my = ++seq;
  const tbody = $('reports-table');
  tbody.classList.add('is-loading');
  const day = $('reports-day').value || todayIST();
  try {
    const r = await get('/reports/daily', {
      day,
      branch_id: $('reports-branch').value,
      officer_id: $('reports-officer').value,
    });
    if (my !== seq) return;
    reports = r.reports || [];
    reportDay = r.day || day;
    loaded = true;
    render();
  } catch (err) {
    if (my === seq) toastError(err, 'Could not load reports');
  } finally {
    if (my === seq) tbody.classList.remove('is-loading');
  }
}

function exportCsv() {
  if (!reports.length) { toast('Nothing to export', 'There are no report rows for this selection.', 'info'); return; }
  const header = ['Officer', 'Branch', 'Start', 'End', 'Duty time', 'Duty minutes', 'Distance (km)',
    'Centers visited', 'Centers assigned', 'Villages visited', 'Villages assigned', 'Time at locations (min)',
    'Lunch (min)', 'Lunch allowed (min)', 'Lunch excess (min)', 'Unexplained stops', 'Unexplained stop (min)',
    'Customers captured', 'Location-off count', 'Long break', 'Missed locations'];
  const rows = reports.map((r) => [
    r.officer_name, r.branch_name, fmtTime(r.started_at), fmtTime(r.ended_at), fmtDuration(r.duty_minutes), n0(r.duty_minutes),
    n0(r.distance_km).toFixed(2), n0(r.centers_visited), n0(r.centers_assigned), n0(r.villages_visited), n0(r.villages_assigned),
    n0(r.time_at_locations_min), n0(r.lunch_minutes), n0(r.lunch_allowed_min), n0(r.lunch_excess_min),
    (r.unexplained_stops || []).length, n0(r.unexplained_stop_min), n0(r.customers_captured), n0(r.location_off_count),
    r.long_break ? 'Yes' : 'No', (r.missed || []).map((m) => (typeof m === 'string' ? m : m?.name)).join('; '),
  ]);
  downloadCsv(`track_karo_report_${reportDay || $('reports-day').value || todayIST()}.csv`, [header, ...rows]);
}

async function refreshOfficerOptions() {
  try { await fillOfficerSelect($('reports-officer'), $('reports-branch').value); } catch { /* ignore */ }
}

function init() {
  $('reports-day').value = todayIST();
  $('reports-day').max = todayIST();
  $('reports-day').addEventListener('change', load);
  $('reports-branch').addEventListener('change', async () => {
    await refreshOfficerOptions();
    load();
  });
  $('reports-officer').addEventListener('change', load);
  $('btn-reports-csv').addEventListener('click', exportCsv);
  $('btn-reports-print').addEventListener('click', () => window.print());
  $('reports-table').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="toggle-detail"]');
    if (btn) toggleDetail(btn);
  });
}

export default {
  init,
  async show() {
    if (loaded) return;
    loaded = true;
    try { await fillBranchSelect($('reports-branch')); } catch { /* ignore */ }
    await refreshOfficerOptions();
    await load();
  },
  refresh: load,
};
