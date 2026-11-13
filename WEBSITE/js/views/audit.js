// Branch internal audit - UI preview.
//
// This module is a self-contained prototype: the cycles, findings, corrective
// actions, evidence and audit trail below live in memory. Nothing is sent to
// the API. By default a page reload restores the demo data; the "Keep my
// changes in this browser" switch saves them to localStorage on this device
// only, and "Reset demo data" brings the original examples back.
// The markup lives in app.html (#view-audit + modal-*) so wiring it to the real
// API later is a matter of replacing the store functions.

import {
  $, cloneTpl, fill, setEmpty, chip, label, toast, showError,
  confirmDialog, openDialog, closeDialog, debounce, todayIST, fmtDay, fmtNum, downloadCsv,
  fmtDateTime, fmtDateTimeSec,
} from '../ui.js';
import { state } from '../state.js';

// ---------------------------------------------------------------- labels

const AREA_LABELS = {
  tracking: 'Tracking', visits: 'Visits', distance_duty: 'Distance & duty',
  customer_data: 'Customer data', alert_response: 'Alert response',
};
const SEVERITY_LABELS = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };
const FINDING_STATUS = {
  open: 'Open', responded: 'Responded', resolved: 'Resolved',
  accepted_risk: 'Accepted risk', closed: 'Closed',
};
const CYCLE_STATUS = { open: 'Open', in_review: 'In review', signed_off: 'Signed off' };
const ACTION_STATUS = { open: 'Open', done: 'Done', cancelled: 'Cancelled' };
const TRAIL_EVENTS = {
  cycle_created: 'Created', scan: 'Scan', finding_added: 'Finding added', finding_deleted: 'Finding deleted',
  response: 'Response', status: 'Status', action: 'Action', evidence: 'Evidence',
  signoff: 'Sign-off', reopen: 'Reopened',
};

// ---------------------------------------------------------------- demo data

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayOffset = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };

const BRANCHES = [
  { id: 1, name: 'Mysuru Main' },
  { id: 2, name: 'Mandya Town' },
  { id: 3, name: 'Hassan North' },
];
const OFFICERS = [
  { id: 11, branch_id: 1, name: 'Ravi Kumar' },
  { id: 12, branch_id: 1, name: 'Sunita Rao' },
  { id: 13, branch_id: 1, name: 'Imran Pasha' },
  { id: 14, branch_id: 1, name: 'Deepa Shetty' },
  { id: 21, branch_id: 2, name: 'Manoj Gowda' },
  { id: 22, branch_id: 2, name: 'Kavya N' },
  { id: 23, branch_id: 2, name: 'Suresh B' },
  { id: 31, branch_id: 3, name: 'Anita Desai' },
  { id: 32, branch_id: 3, name: 'Vikram Singh' },
];

// Lowest id each sequence may hand out (seed ids stay below these).
const SEQ_FLOOR = { cycle: 4, finding: 100, action: 10, evidence: 10, trail: 1 };
let seqCycle = SEQ_FLOOR.cycle;
let seqFinding = SEQ_FLOOR.finding;
let seqAction = SEQ_FLOOR.action;
let seqEvidence = SEQ_FLOOR.evidence;
let seqTrail = SEQ_FLOOR.trail;

const seedCycles = () => [
  {
    id: 1, branch_id: 1, period_start: dayOffset(-6), period_end: dayOffset(0),
    status: 'open', auditor_id: 1, auditor_name: 'Latha M', score: null, grade: null,
    notes: 'Focus on the two officers with repeated GPS gaps.',
    signed_off_at: null,
  },
  {
    id: 2, branch_id: 2, period_start: dayOffset(-10), period_end: dayOffset(-3),
    status: 'in_review', auditor_id: 1, auditor_name: 'Latha M', score: null, grade: null,
    notes: '', signed_off_at: null,
  },
  {
    id: 3, branch_id: 1, period_start: dayOffset(-37), period_end: dayOffset(-7),
    status: 'signed_off', auditor_id: 1, auditor_name: 'Latha M', score: 84, grade: 'B',
    notes: 'Score agreed with the branch manager.',
    signed_off_at: dayOffset(-5),
  },
];

const seedFindings = () => [
  // --- open cycle, branch 1 ---
  {
    id: 1, cycle_id: 1, branch_id: 1, officer_id: 11, area: 'tracking', source: 'auto',
    rule: 'location_off_repeat', ref_key: '11', severity: 'high', day: dayOffset(-2), status: 'open',
    title: 'Ravi Kumar switched location off 5 times',
    detail: 'GPS or the location permission was turned off repeatedly while on duty. Three of the incidents lasted more than 20 minutes.',
    response: '', created_at: dayOffset(-2),
  },
  {
    id: 2, cycle_id: 1, branch_id: 1, officer_id: 12, area: 'visits', source: 'auto',
    rule: 'missed_assignment', ref_key: '12:' + dayOffset(-3), severity: 'medium', day: dayOffset(-3),
    status: 'responded',
    title: 'Sunita Rao missed 2 assigned locations',
    detail: 'Not visited (fewer than 2 minutes inside the geofence): Nanjangud Center, Kadakola Village.',
    response: 'Both locations were closed for a festival. The route was changed by phone - I have asked for written approval next time.',
    responded_at: dayOffset(-2), created_at: dayOffset(-3),
  },
  {
    id: 3, cycle_id: 1, branch_id: 1, officer_id: 13, area: 'distance_duty', source: 'auto',
    rule: 'distance_without_points', ref_key: '13:' + dayOffset(-1), severity: 'medium', day: dayOffset(-1),
    status: 'open',
    title: 'Imran Pasha recorded 47 km from only 4 GPS points',
    detail: 'Distance is hard to verify when almost no GPS points were received that day.',
    response: '', created_at: dayOffset(-1),
  },
  {
    id: 4, cycle_id: 1, branch_id: 1, officer_id: 14, area: 'tracking', source: 'auto',
    rule: 'unexplained_stop', ref_key: '14:' + dayOffset(-2), severity: 'medium', day: dayOffset(-2),
    status: 'open',
    title: 'Deepa Shetty had 2 unexplained stops (58 min)',
    detail: 'Time was spent at a place that is neither an assigned location nor a declared lunch break.',
    response: '', created_at: dayOffset(-2),
  },
  {
    id: 5, cycle_id: 1, branch_id: 1, officer_id: null, area: 'customer_data', source: 'auto',
    rule: 'customer_incomplete', ref_key: 'branch', severity: 'low', day: null, status: 'open',
    title: '38 customer records are incomplete',
    detail: '21 without a phone; 9 without a village; 3 without a branch; 5 never located on the map (out of 412 records).',
    response: '', created_at: dayOffset(-5),
  },
  {
    id: 6, cycle_id: 1, branch_id: 1, officer_id: null, area: 'alert_response', source: 'auto',
    rule: 'alert_unread', ref_key: 'branch', severity: 'medium', day: dayOffset(-4), status: 'open',
    title: '4 alerts were never read',
    detail: 'Alerts raised for this branch are still unread more than a day after they were created.',
    response: '', created_at: dayOffset(-4),
  },
  {
    id: 7, cycle_id: 1, branch_id: 1, officer_id: 13, area: 'visits', source: 'manual',
    rule: null, ref_key: 'manual-1', severity: 'high', day: dayOffset(-1), status: 'resolved',
    title: 'Customer "Gowda Traders" was located 120 km from the branch',
    detail: 'The coordinates captured during the customer visit are far outside the branch area. The officer explained that the shop was closed and he captured it later from home.',
    response: 'Visit re-done at the correct shop on ' + fmtDay(dayOffset(0)) + '. Coordinates corrected.',
    responded_at: dayOffset(-1), created_at: dayOffset(-1),
  },

  // --- signed-off cycle, branch 1 ---
  {
    id: 8, cycle_id: 3, branch_id: 1, officer_id: 12, area: 'tracking', source: 'auto',
    rule: 'no_gps_day', ref_key: '12:' + dayOffset(-20), severity: 'high', day: dayOffset(-20),
    status: 'closed',
    title: 'Sunita Rao started the day but sent no GPS points',
    detail: 'The work day was started, yet not one location point reached the server for that day.',
    response: 'Phone battery died; day re-created manually with the manager present.',
    responded_at: dayOffset(-19), created_at: dayOffset(-20),
  },
  {
    id: 9, cycle_id: 3, branch_id: 1, officer_id: 13, area: 'tracking', source: 'auto',
    rule: 'long_break', ref_key: '13:' + dayOffset(-24), severity: 'medium', day: dayOffset(-24),
    status: 'closed',
    title: 'Imran Pasha took 96 minutes of breaks',
    detail: 'Declared breaks total 96 minutes; the allowed lunch is 60 minutes.',
    response: 'Approved by the branch manager that day.',
    responded_at: dayOffset(-23), created_at: dayOffset(-24),
  },
  {
    id: 10, cycle_id: 3, branch_id: 1, officer_id: null, area: 'customer_data', source: 'auto',
    rule: 'customer_incomplete', ref_key: 'branch', severity: 'low', day: null, status: 'accepted_risk',
    title: '52 customer records are incomplete',
    detail: 'Legacy records imported before the phone number was mandatory.',
    response: 'Clean-up planned with the data entry team next quarter.',
    responded_at: dayOffset(-8), created_at: dayOffset(-30),
  },
  {
    id: 11, cycle_id: 3, branch_id: 1, officer_id: 11, area: 'distance_duty', source: 'manual',
    rule: null, ref_key: 'manual-2', severity: 'critical', day: dayOffset(-15), status: 'closed',
    title: 'Fuel claim did not match the recorded route',
    detail: 'The claim covered 210 km while the tracked route was 96 km. The difference was refunded.',
    response: 'Claim revised and resubmitted with the correct distance.',
    responded_at: dayOffset(-14), created_at: dayOffset(-15),
  },

  // --- in-review cycle, branch 2 ---
  {
    id: 12, cycle_id: 2, branch_id: 2, officer_id: 21, area: 'visits', source: 'auto',
    rule: 'short_visit', ref_key: '21:' + dayOffset(-6), severity: 'low', day: dayOffset(-6),
    status: 'open',
    title: 'Manoj Gowda had 3 visits under 5 minutes',
    detail: 'A geofence visit shorter than 5 minutes may mean the officer only passed by.',
    response: '', created_at: dayOffset(-6),
  },
  {
    id: 13, cycle_id: 2, branch_id: 2, officer_id: null, area: 'alert_response', source: 'auto',
    rule: 'alert_slow', ref_key: 'branch', severity: 'low', day: null, status: 'open',
    title: '3 alerts took more than a day to read',
    detail: 'Alert response time is part of the branch audit score.',
    response: '', created_at: dayOffset(-5),
  },
];

const seedActions = () => [
  {
    id: 1, finding_id: 2, title: 'Send the revised route plan for approval', status: 'open',
    due_date: dayOffset(3), owner_name: 'Branch manager', completion_note: '',
  },
  {
    id: 2, finding_id: 2, title: 'Brief all officers on geofence rules', status: 'done',
    due_date: dayOffset(-1), owner_name: 'Branch manager',
    completion_note: 'Toolbox talk held on ' + fmtDay(dayOffset(-2)) + '.',
  },
  {
    id: 3, finding_id: 1, title: 'Collect the location-off explanation in writing', status: 'open',
    due_date: dayOffset(2), owner_name: 'Branch manager', completion_note: '',
  },
];

const seedEvidence = () => [
  {
    id: 1, finding_id: 2, kind: 'note',
    note: 'Manager confirmed the route change by phone on ' + fmtDay(dayOffset(-2)) + '.',
    added_by: 2, added_by_name: 'Nagesh (manager)', created_at: dayOffset(-2),
  },
  {
    id: 2, finding_id: 7, kind: 'link',
    url: 'https://www.google.com/maps?q=12.2958,76.6394',
    note: 'Corrected shop location',
    added_by: 1, added_by_name: 'Latha M', created_at: dayOffset(-1),
  },
];

// ---------------------------------------------------------------- audit trail seed

/** ISO timestamp for `n` days from today at hh:mm India time (seed data uses n < 0). */
const stamp = (n, hh, mm) => new Date(
  `${dayOffset(n)}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+05:30`,
).toISOString();

const AUDITOR = 'Latha M (Auditor)';
const MANAGER = 'Nagesh (Branch manager)';
const RESPONDED_TO_CLOSED = 'Status changed from Responded to Closed';

const seedTrail = () => {
  let id = 0;
  const t = (cycle_id, n, hh, mm, event, message, actor, finding_id = null) => (
    { id: ++id, cycle_id, finding_id, event, message, actor, at: stamp(n, hh, mm) }
  );
  return [
    // cycle 1: Mysuru Main, open
    t(1, -5, 10, 15, 'cycle_created', 'Audit created for Mysuru Main', AUDITOR),
    t(1, -5, 10, 20, 'scan', 'Scan raised 6 findings from the tracking data', AUDITOR),
    t(1, -2, 16, 40, 'response', 'Branch response recorded', MANAGER, 2),
    t(1, -2, 16, 41, 'status', 'Status changed from Open to Responded', MANAGER, 2),
    t(1, -2, 16, 50, 'action', 'Corrective action added: Send the revised route plan for approval', AUDITOR, 2),
    t(1, -2, 16, 52, 'action', 'Corrective action added: Brief all officers on geofence rules', AUDITOR, 2),
    t(1, -2, 16, 55, 'evidence', 'Evidence added (note)', MANAGER, 2),
    t(1, -2, 17, 30, 'action', 'Corrective action marked done: Brief all officers on geofence rules', MANAGER, 2),
    t(1, -1, 10, 5, 'finding_added', 'Finding added: Customer "Gowda Traders" was located 120 km from the branch', AUDITOR, 7),
    t(1, -1, 11, 0, 'action', 'Corrective action added: Collect the location-off explanation in writing', AUDITOR, 1),
    t(1, -1, 14, 30, 'response', 'Branch response recorded', MANAGER, 7),
    t(1, -1, 15, 0, 'status', 'Status changed from Responded to Resolved', AUDITOR, 7),
    t(1, -1, 15, 10, 'evidence', 'Evidence added (link)', AUDITOR, 7),

    // cycle 2: Mandya Town, in review
    t(2, -8, 9, 40, 'cycle_created', 'Audit created for Mandya Town', AUDITOR),
    t(2, -6, 11, 0, 'scan', 'Scan raised 1 finding from the tracking data', AUDITOR, 12),
    t(2, -5, 11, 0, 'scan', 'Scan raised 1 finding from the tracking data', AUDITOR, 13),

    // cycle 3: Mysuru Main, signed off
    t(3, -36, 10, 0, 'cycle_created', 'Audit created for Mysuru Main', AUDITOR),
    t(3, -30, 11, 20, 'scan', 'Scan raised 1 finding from the tracking data', AUDITOR, 10),
    t(3, -24, 11, 5, 'scan', 'Scan raised 1 finding from the tracking data', AUDITOR, 9),
    t(3, -23, 15, 30, 'response', 'Branch response recorded', MANAGER, 9),
    t(3, -22, 10, 0, 'status', RESPONDED_TO_CLOSED, AUDITOR, 9),
    t(3, -20, 11, 10, 'scan', 'Scan raised 1 finding from the tracking data', AUDITOR, 8),
    t(3, -19, 12, 15, 'response', 'Branch response recorded', MANAGER, 8),
    t(3, -18, 10, 30, 'status', RESPONDED_TO_CLOSED, AUDITOR, 8),
    t(3, -15, 16, 0, 'finding_added', 'Finding added: Fuel claim did not match the recorded route', AUDITOR, 11),
    t(3, -14, 12, 0, 'response', 'Branch response recorded', MANAGER, 11),
    t(3, -13, 9, 45, 'status', RESPONDED_TO_CLOSED, AUDITOR, 11),
    t(3, -8, 14, 20, 'response', 'Branch response recorded', MANAGER, 10),
    t(3, -8, 14, 40, 'status', 'Status changed from Responded to Accepted risk', AUDITOR, 10),
    t(3, -5, 11, 30, 'signoff', 'Signed off with score 84 (B)', AUDITOR),
  ];
};

// ---------------------------------------------------------------- live store

const cycles = [];
const findings = [];
const actions = [];
const evidence = [];
const trail = [];

const seedData = () => ({
  cycles: seedCycles(), findings: seedFindings(), actions: seedActions(),
  evidence: seedEvidence(), trail: seedTrail(),
});

const nextId = (list, floor) => list.reduce((m, x) => Math.max(m, Number(x.id) + 1), floor);

/** Replace the store contents (seed data, a reset, or data restored from localStorage). */
function applyData(d) {
  cycles.splice(0, cycles.length, ...d.cycles);
  findings.splice(0, findings.length, ...d.findings);
  actions.splice(0, actions.length, ...d.actions);
  evidence.splice(0, evidence.length, ...d.evidence);
  trail.splice(0, trail.length, ...d.trail);
  seqCycle = nextId(cycles, SEQ_FLOOR.cycle);
  seqFinding = nextId(findings, SEQ_FLOOR.finding);
  seqAction = nextId(actions, SEQ_FLOOR.action);
  seqEvidence = nextId(evidence, SEQ_FLOOR.evidence);
  seqTrail = nextId(trail, SEQ_FLOOR.trail);
}
applyData(seedData());

// ---------------------------------------------------------------- optional persistence

const STORE_KEY = 'trackkaro.audit.preview.v1';
const PERSIST_KEY = 'trackkaro.audit.preview.persist';
let persistOn = false;
let lastSaved = null;

// Browser storage can be missing or throw (private mode, blocked cookies): never let it break the view.
function readStore(key) { try { return window.localStorage.getItem(key); } catch { return null; } }
function writeStore(key, value) { try { window.localStorage.setItem(key, value); return true; } catch { return false; } }
function dropStore(key) { try { window.localStorage.removeItem(key); } catch { /* nothing to do */ } }

function loadSaved() {
  const raw = readStore(STORE_KEY);
  if (!raw) return null;
  try {
    const d = JSON.parse(raw);
    const ok = d && d.v === 1 && ['cycles', 'findings', 'actions', 'evidence', 'trail']
      .every((k) => Array.isArray(d[k]) && d[k].every((x) => x && Number.isFinite(Number(x.id))));
    return ok ? d : null;
  } catch { return null; }
}

function renderDemoStatus() {
  $('audit-persist').checked = persistOn;
  $('audit-demo-status').textContent = persistOn
    ? `Changes are saved in this browser only${lastSaved ? ` (last saved ${fmtDay(lastSaved)})` : ''}.`
    : 'Changes are kept in memory and lost when you reload.';
}

function persist() {
  if (!persistOn) return;
  const day = todayIST();
  const ok = writeStore(STORE_KEY, JSON.stringify({
    v: 1, saved_on: day, cycles, findings, actions, evidence, trail,
  }));
  if (ok) { lastSaved = day; renderDemoStatus(); return; }
  persistOn = false;
  dropStore(PERSIST_KEY);
  renderDemoStatus();
  toast('Could not save', 'Browser storage is unavailable, so changes will be lost on reload.', 'error');
}

// ---------------------------------------------------------------- derived data

const WEIGHT = { critical: 12, high: 8, medium: 4, low: 1 };
const DAMPING = { open: 1, responded: 1, resolved: 0.25, accepted_risk: 0.5, closed: 0 };

const officerName = (id) => OFFICERS.find((o) => o.id === id)?.name || '';
const branchName = (id) => BRANCHES.find((b) => b.id === id)?.name || '';
const findingsFor = (cycleId) => findings.filter((f) => f.cycle_id === cycleId);

function scoreFor(cycleId) {
  const rows = findingsFor(cycleId);
  const penalty = rows.reduce((s, f) => s + (WEIGHT[f.severity] || 0) * (DAMPING[f.status] ?? 1), 0);
  const score = Math.max(0, Math.min(100, Math.round(100 - penalty)));
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'E';
  return { score, grade };
}

function summaryFor(cycleId) {
  const rows = findingsFor(cycleId);
  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
  const byArea = { tracking: 0, visits: 0, distance_duty: 0, customer_data: 0, alert_response: 0 };
  for (const f of rows) {
    bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
    byArea[f.area] = (byArea[f.area] || 0) + 1;
  }
  return {
    total: rows.length,
    open: rows.filter((f) => f.status === 'open' || f.status === 'responded').length,
    by_severity: bySeverity,
    by_area: byArea,
  };
}

function cycleRow(c) {
  const s = summaryFor(c.id);
  return {
    ...c,
    branch_name: branchName(c.branch_id),
    findings_total: s.total,
    findings_open: s.open,
    critical_open: findingsFor(c.id).filter((f) => f.severity === 'critical' && (f.status === 'open' || f.status === 'responded')).length,
  };
}

// ---------------------------------------------------------------- state

let loaded = false;
let selected = null;       // cycle id
let detail = null;         // finding id
let previewRole = 'auditor';

const canEdit = () => previewRole === 'auditor';
const selectedCycle = () => cycles.find((c) => String(c.id) === String(selected)) || null;
const locked = () => selectedCycle()?.status === 'signed_off';
/** The auditor, and only while the cycle is not signed off. */
const mayEdit = () => canEdit() && !locked();

const actorName = () => `${state.user?.name || 'You'} (${canEdit() ? 'Auditor' : 'Branch manager'})`;

/** Append an audit-trail entry (call after the change itself) and save if saving is on. */
function logEvent(cycleId, event, message, findingId = null) {
  if (cycleId === null || cycleId === undefined) return;
  trail.push({
    id: seqTrail++, cycle_id: Number(cycleId), finding_id: findingId, event, message,
    actor: actorName(), at: new Date().toISOString(),
  });
  persist();
}
const logForFinding = (findingId, event, message) => {
  const f = findings.find((x) => x.id === findingId);
  if (f) logEvent(f.cycle_id, event, message, f.id);
};

/** Toolbar + buttons that only the auditor may use. */
function applyRoleUi() {
  $('btn-audit-new').hidden = !canEdit();
}

// ---------------------------------------------------------------- cycles

function cycleValues(c) {
  return {
    branch_name: c.branch_name,
    period: `${fmtDay(c.period_start)} - ${fmtDay(c.period_end)}`,
    status: chip(label(CYCLE_STATUS, c.status), c.status || ''),
    auditor_name: c.auditor_name,
    findings: `${c.findings_open} / ${c.findings_total}`,
    score: c.status === 'signed_off' && c.score !== null ? c.score : '-',
    grade: c.status === 'signed_off' ? (c.grade || '-') : '-',
  };
}

function visibleCycles() {
  const branch = $('audit-branch').value;
  const status = $('audit-status').value;
  return cycles
    .map(cycleRow)
    .filter((c) => (!branch || String(c.branch_id) === branch) && (!status || c.status === status))
    .sort((a, b) => (a.period_end < b.period_end ? 1 : a.period_end > b.period_end ? -1 : b.id - a.id));
}

function renderCycles() {
  const tbody = $('audit-cycles-table');
  tbody.textContent = '';
  const list = visibleCycles();
  for (const c of list) {
    const tr = cloneTpl('tpl-audit-cycle');
    tr.dataset.cycleId = c.id;
    if (String(selected) === String(c.id)) tr.classList.add('is-selected');
    fill(tr, cycleValues(c));
    tbody.appendChild(tr);
  }
  setEmpty('audit-cycles', list.length === 0);
}

function renderCycle() {
  const panel = $('audit-cycle-panel');
  const c = selectedCycle();
  applyRoleUi();
  if (!c) { panel.hidden = true; return; }
  const row = cycleRow(c);
  const summary = summaryFor(c.id);
  const projected = scoreFor(c.id);
  panel.hidden = false;

  $('audit-cycle-title').textContent = `${row.branch_name} · ${fmtDay(c.period_start)} – ${fmtDay(c.period_end)}`;
  const statusEl = $('audit-cycle-status');
  statusEl.textContent = label(CYCLE_STATUS, c.status);
  statusEl.dataset.value = c.status;
  $('audit-cycle-auditor').textContent = c.auditor_name ? `Auditor: ${c.auditor_name}` : 'Not assigned';
  $('audit-score').textContent = c.status === 'signed_off' ? String(c.score ?? '-') : String(projected.score);
  $('audit-grade').textContent = c.status === 'signed_off' ? (c.grade || '-') : projected.grade;
  $('audit-sum-total').textContent = String(summary.total);
  $('audit-sum-open').textContent = String(summary.open);
  for (const sev of ['critical', 'high', 'medium', 'low']) {
    $('audit-sum-' + sev).textContent = String(summary.by_severity[sev]);
  }
  $('audit-cycle-notes').textContent = locked()
    ? `${c.notes || 'No notes.'} Signed off ${fmtDay(c.signed_off_at || todayIST())} - read only.`
    : (c.notes || 'No notes.');

  applyRoleUi();
  for (const id of ['btn-audit-scan', 'btn-audit-add-finding', 'btn-audit-signoff']) {
    $(id).hidden = !canEdit();
  }
  $('btn-audit-scan').hidden = !mayEdit();
  $('btn-audit-add-finding').hidden = !mayEdit();
  const signoff = $('btn-audit-signoff');
  if (c.status === 'signed_off') {
    signoff.textContent = 'Reopen';
    signoff.disabled = false;
    signoff.title = 'Reopen this audit for changes';
  } else {
    signoff.textContent = 'Sign off';
    signoff.disabled = summary.open > 0;
    signoff.title = summary.open > 0
      ? 'Close or accept every finding before signing off'
      : 'Freeze the score and sign off';
  }
  renderTrail();
}

// ---------------------------------------------------------------- audit trail

function trailRows() {
  if (!selected) return [];
  return trail
    .filter((t) => t.cycle_id === Number(selected))
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : b.id - a.id));
}

function renderTrail() {
  const list = $('audit-trail');
  list.textContent = '';
  const rows = trailRows();
  for (const t of rows) {
    const li = cloneTpl('tpl-audit-trail');
    li.dataset.trailId = t.id;
    fill(li, {
      event: chip(label(TRAIL_EVENTS, t.event), t.event),
      message: t.message,
      actor: t.actor,
      when: fmtDateTime(t.at),
    });
    li.querySelector('[data-field="when"]').title = fmtDateTimeSec(t.at);
    // Offer a shortcut only while the finding still exists (a deleted one leaves just the history line).
    const exists = t.finding_id && findings.some((f) => f.id === t.finding_id);
    const open = li.querySelector('[data-action="open-trail-finding"]');
    open.hidden = !exists;
    if (exists) open.dataset.findingId = t.finding_id;
    list.appendChild(li);
  }
  setEmpty('audit-trail', rows.length === 0);
  $('audit-trail-count').textContent = String(rows.length);
}

function openCycle(id) {
  selected = Number(id);
  for (const el of ['audit-area', 'audit-severity', 'audit-finding-status', 'audit-search']) {
    $(el).value = '';
  }
  renderCycles();
  renderCycle();
  renderFindings();
  $('audit-cycle-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------------------------------------------------------------- findings

function visibleFindings() {
  if (!selected) return [];
  const area = $('audit-area').value;
  const severity = $('audit-severity').value;
  const status = $('audit-finding-status').value;
  const term = $('audit-search').value.trim().toLowerCase();
  return findingsFor(selected)
    .filter((f) => (!area || f.area === area)
      && (!severity || f.severity === severity)
      && (!status || f.status === status)
      && (!term || `${f.title} ${f.detail} ${officerName(f.officer_id)}`.toLowerCase().includes(term)))
    .sort((a, b) => {
      const rank = { critical: 0, high: 1, medium: 2, low: 3 };
      if (rank[a.severity] !== rank[b.severity]) return rank[a.severity] - rank[b.severity];
      return String(b.day || '').localeCompare(String(a.day || '')) || b.id - a.id;
    });
}

function findingValues(f) {
  return {
    severity: chip(label(SEVERITY_LABELS, f.severity), f.severity),
    area: chip(label(AREA_LABELS, f.area), f.area),
    officer_name: f.officer_id ? officerName(f.officer_id) : 'Branch',
    day: f.day ? fmtDay(f.day) : '-',
    title: f.title,
    status: chip(label(FINDING_STATUS, f.status), f.status),
  };
}

function renderFindings() {
  const tbody = $('audit-findings-table');
  tbody.textContent = '';
  const list = visibleFindings();
  for (const f of list) {
    const tr = cloneTpl('tpl-audit-finding');
    tr.dataset.findingId = f.id;
    fill(tr, findingValues(f));
    tbody.appendChild(tr);
  }
  setEmpty('audit-findings', list.length === 0);
  $('audit-findings-count').textContent = String(list.length);
}

// ---------------------------------------------------------------- finding detail

function chipNode(text, value) {
  const el = document.createElement('span');
  el.className = 'chip';
  el.dataset.value = value;
  el.textContent = text;
  return el;
}

function renderDetail() {
  const f = findings.find((x) => String(x.id) === String(detail));
  if (!f) return;
  const c = selectedCycle();

  $('fd-title').textContent = f.title;
  $('fd-detail').textContent = f.detail || 'No extra detail was recorded.';

  const meta = $('fd-meta');
  meta.textContent = '';
  meta.appendChild(chipNode(label(SEVERITY_LABELS, f.severity), f.severity));
  meta.appendChild(chipNode(label(AREA_LABELS, f.area), f.area));
  meta.appendChild(chipNode(label(FINDING_STATUS, f.status), f.status));
  meta.appendChild(chipNode(f.source === 'auto' ? 'Automatic' : 'Manual', f.source));
  const where = document.createElement('span');
  where.className = 'muted';
  where.textContent = [
    f.officer_id ? officerName(f.officer_id) : null,
    f.day ? fmtDay(f.day) : null,
    c ? `${branchName(c.branch_id)} · ${fmtDay(c.period_start)} – ${fmtDay(c.period_end)}` : null,
  ].filter(Boolean).join(' · ');
  meta.appendChild(where);

  $('fd-response').value = f.response || '';
  $('fd-response-info').textContent = f.responded_at
    ? `Answered ${fmtDay(f.responded_at)}` : 'No response from the branch yet.';

  $('fd-status-wrap').hidden = !mayEdit();
  $('fd-status').value = f.status;
  $('fd-delete').hidden = !(mayEdit() && f.source === 'manual');
  $('fd-response').disabled = locked();
  $('btn-fd-save').hidden = locked();

  const list = $('fd-actions');
  list.textContent = '';
  for (const a of actions.filter((x) => x.finding_id === f.id)) {
    const li = cloneTpl('tpl-audit-action');
    li.dataset.actionId = a.id;
    fill(li, {
      title: a.title,
      meta: [a.due_date ? `Due ${fmtDay(a.due_date)}` : null, a.owner_name || null, a.completion_note || null]
        .filter(Boolean).join(' · ') || '-',
      status: chip(label(ACTION_STATUS, a.status), a.status),
    });
    const done = li.querySelector('[data-action="toggle-action"]');
    if (done) {
      done.hidden = locked() || a.status === 'cancelled';
      done.textContent = a.status === 'done' ? 'Reopen' : 'Mark done';
      done.dataset.next = a.status === 'done' ? 'open' : 'done';
    }
    li.querySelector('[data-action="delete-action"]').hidden = !mayEdit();
    list.appendChild(li);
  }
  $('fd-actions-empty').hidden = actions.some((x) => x.finding_id === f.id);

  const evList = $('fd-evidence');
  evList.textContent = '';
  for (const e of evidence.filter((x) => x.finding_id === f.id)) {
    const li = cloneTpl('tpl-audit-evidence');
    li.dataset.evidenceId = e.id;
    fill(li, {
      kind: e.kind === 'link' ? 'Link' : 'Note',
      text: e.note || e.url || '',
      link: e.kind === 'link' ? e.url : '',
      meta: [e.added_by_name || null, e.created_at ? fmtDay(e.created_at) : null].filter(Boolean).join(' · '),
    });
    li.querySelector('[data-action="delete-evidence"]').hidden = !mayEdit();
    evList.appendChild(li);
  }
  $('fd-evidence-empty').hidden = evidence.some((x) => x.finding_id === f.id);

  $('form-add-action').hidden = !mayEdit();
  $('form-add-evidence').hidden = locked();
}

function openFinding(id) {
  detail = id;
  renderDetail();
  openDialog($('modal-finding-detail'));
}

function afterFindingChange() {
  renderCycles();
  renderCycle();
  renderFindings();
  if (detail) renderDetail();
}

// ---------------------------------------------------------------- flows

function openNewCycle() {
  $('form-cycle').reset();
  showError($('cycle-error'), '');
  $('cycle-start').value = dayOffset(-6);
  $('cycle-end').value = dayOffset(0);
  $('cycle-start').max = todayIST();
  $('cycle-end').max = todayIST();
  const sel = $('cycle-branch');
  sel.textContent = '';
  for (const b of BRANCHES) {
    const o = document.createElement('option');
    o.value = String(b.id);
    o.textContent = b.name;
    sel.appendChild(o);
  }
  if ($('audit-branch').value) sel.value = $('audit-branch').value;
  openDialog($('modal-cycle'));
}

function saveCycle(e) {
  e.preventDefault();
  const err = $('cycle-error');
  showError(err, '');
  const branchId = Number($('cycle-branch').value);
  const start = $('cycle-start').value;
  const end = $('cycle-end').value;
  if (!branchId) { showError(err, 'Choose the branch.'); return; }
  if (!start || !end) { showError(err, 'Choose the period start and end.'); return; }
  if (end < start) { showError(err, 'The end date must be on or after the start.'); return; }
  if ((Date.parse(end) - Date.parse(start)) / 86400000 > 92) {
    showError(err, 'An audit period can be at most 92 days.'); return;
  }
  const duplicate = cycles.find((c) => c.branch_id === branchId && c.period_start === start && c.period_end === end);
  if (duplicate) { showError(err, 'An audit already exists for this branch and period.'); return; }

  const cycle = {
    id: seqCycle++, branch_id: branchId, period_start: start, period_end: end, status: 'open',
    auditor_id: 1, auditor_name: state.user?.name || 'Latha M', score: null, grade: null,
    notes: '', signed_off_at: null,
  };
  cycles.unshift(cycle);
  logEvent(cycle.id, 'cycle_created', `Audit created for ${branchName(branchId)}`);
  closeDialog($('modal-cycle'));
  toast('Audit created', `${branchName(branchId)} · ${fmtDay(start)} – ${fmtDay(end)}`, 'success');
  renderCycles();
  openCycle(cycle.id);
}

function openFindingForm() {
  if (!selected) return;
  if (locked()) { toast('Signed off', 'Reopen the audit to add findings.', 'info'); return; }
  const c = selectedCycle();
  $('form-finding').reset();
  showError($('finding-error'), '');
  $('finding-day').min = c.period_start;
  $('finding-day').max = c.period_end;
  $('finding-severity').value = 'medium';
  const sel = $('finding-officer');
  sel.textContent = '';
  const none = document.createElement('option');
  none.value = '';
  none.textContent = 'Branch-level (no officer)';
  sel.appendChild(none);
  for (const o of OFFICERS.filter((x) => x.branch_id === c.branch_id)) {
    const opt = document.createElement('option');
    opt.value = String(o.id);
    opt.textContent = o.name;
    sel.appendChild(opt);
  }
  openDialog($('modal-finding'));
}

function saveFindingForm(e) {
  e.preventDefault();
  if (locked()) return;
  const err = $('finding-error');
  showError(err, '');
  const c = selectedCycle();
  const title = $('finding-title').value.trim();
  const area = $('finding-area').value;
  if (!area) { showError(err, 'Choose the audit area.'); return; }
  if (!title) { showError(err, 'Write a short title.'); return; }
  const officerId = Number($('finding-officer').value) || null;
  const id = seqFinding++;
  findings.unshift({
    id, cycle_id: c.id, branch_id: c.branch_id, officer_id: officerId,
    area, source: 'manual', rule: null, ref_key: `manual-${id}`,
    severity: $('finding-severity').value, title,
    detail: $('finding-detail').value.trim(), day: $('finding-day').value || null,
    status: 'open', response: '', created_at: todayIST(),
  });
  logEvent(c.id, 'finding_added', `Finding added: ${title}`, id);
  closeDialog($('modal-finding'));
  toast('Finding added', title, 'success');
  afterFindingChange();
}

// One click simulates a scan of the tracking data.
const SCAN_POOL = [
  {
    rule: 'no_gps_day', area: 'tracking', severity: 'high', officer_id: 14,
    title: 'Deepa Shetty started the day but sent no GPS points',
    detail: 'The work day was started, yet not one location point reached the server for that day.',
  },
  {
    rule: 'long_break', area: 'tracking', severity: 'medium', officer_id: 11,
    title: 'Ravi Kumar took 92 minutes of breaks',
    detail: 'Declared breaks total 92 minutes; the allowed lunch is 60 minutes.',
  },
  {
    rule: 'customer_duplicate', area: 'customer_data', severity: 'low', officer_id: null,
    title: '3 customer records share the name "Gowda Traders"',
    detail: 'Possible duplicate records; merge or add a distinguishing village/phone.',
  },
];

function scanNow() {
  const c = selectedCycle();
  if (!c) return;
  if (locked()) { toast('Signed off', 'Reopen the audit to scan again.', 'info'); return; }
  let added = 0;
  for (const item of SCAN_POOL) {
    const refKey = item.officer_id ? `${item.officer_id}:scan` : 'scan';
    const exists = findingsFor(c.id).some((f) => f.rule === item.rule && f.ref_key === refKey);
    if (exists) continue;
    findings.unshift({
      ...item, id: seqFinding++, cycle_id: c.id, branch_id: c.branch_id,
      source: 'auto', ref_key: refKey, day: dayOffset(-1), status: 'open',
      response: '', created_at: todayIST(),
    });
    added++;
  }
  logEvent(c.id, 'scan', added
    ? `Scan raised ${added} new finding${added === 1 ? '' : 's'} from the tracking data`
    : 'Scan found nothing new');
  toast(
    added ? 'Scan complete' : 'Nothing new',
    added ? `${added} new finding${added === 1 ? '' : 's'} raised from the tracking data.` : 'Every rule already has a finding in this period.',
    'success',
  );
  afterFindingChange();
}

function signOffOrReopen() {
  const c = selectedCycle();
  if (!c) return;
  if (c.status === 'signed_off') {
    c.status = 'in_review';
    c.score = null;
    c.grade = null;
    c.signed_off_at = null;
    logEvent(c.id, 'reopen', 'Audit reopened for changes');
    toast('Audit reopened', 'You can edit findings again.', 'success');
    afterFindingChange();
    return;
  }
  const summary = summaryFor(c.id);
  if (summary.open > 0) {
    toast('Still open', `${summary.open} finding${summary.open === 1 ? '' : 's'} need a response or a decision.`, 'info');
    return;
  }
  const s = scoreFor(c.id);
  c.status = 'signed_off';
  c.score = s.score;
  c.grade = s.grade;
  c.signed_off_at = todayIST();
  logEvent(c.id, 'signoff', `Signed off with score ${s.score} (${s.grade})`);
  afterFindingChange();
  toast('Audit signed off', `Score ${s.score} (${s.grade}). The cycle is now read-only.`, 'success');
}

// ---------------------------------------------------------------- scorecard

function scorecardRows() {
  const from = $('scorecard-from').value;
  const to = $('scorecard-to').value;
  const branch = $('audit-branch').value;
  const inRange = cycles.filter((c) => (!from || c.period_end >= from) && (!to || c.period_start <= to)
    && (!branch || String(c.branch_id) === branch));
  return BRANCHES.filter((b) => !branch || String(b.id) === branch).map((b) => {
    const list = inRange.filter((c) => c.branch_id === b.id);
    const signed = list.filter((c) => c.status === 'signed_off' && c.score !== null);
    const avg = signed.length ? signed.reduce((s, c) => s + c.score, 0) / signed.length : null;
    const sev = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const c of list) for (const f of findingsFor(c.id)) sev[f.severity]++;
    return {
      branch_name: b.name,
      cycles: list.length,
      signed_off: signed.length,
      avg_score: avg === null ? '-' : fmtNum(avg, 1),
      min_score: signed.length ? Math.min(...signed.map((c) => c.score)) : '-',
      max_score: signed.length ? Math.max(...signed.map((c) => c.score)) : '-',
      critical: sev.critical, high: sev.high, medium: sev.medium, low: sev.low,
    };
  });
}

function renderScorecard() {
  const tbody = $('scorecard-table');
  tbody.textContent = '';
  const rows = scorecardRows();
  for (const r of rows) {
    const tr = cloneTpl('tpl-audit-score');
    fill(tr, r);
    tbody.appendChild(tr);
  }
  setEmpty('scorecard', rows.length === 0);
}

function openScorecard() {
  $('scorecard-from').value = dayOffset(-90);
  $('scorecard-to').value = dayOffset(0);
  renderScorecard();
  openDialog($('modal-scorecard'));
}

// ---------------------------------------------------------------- CSV

function exportCsv() {
  if (!selected) {
    toast('Open a cycle first', 'Choose an audit cycle, then export its findings.', 'info');
    return;
  }
  const list = visibleFindings();
  if (!list.length) {
    toast('Nothing to export', 'There are no findings for this selection.', 'info');
    return;
  }
  const c = selectedCycle();
  const header = ['Severity', 'Area', 'Officer', 'Day', 'Title', 'Status', 'Source', 'Detail', 'Response'];
  const rows = list.map((f) => [
    SEVERITY_LABELS[f.severity], AREA_LABELS[f.area], f.officer_id ? officerName(f.officer_id) : 'Branch',
    f.day || '', f.title, FINDING_STATUS[f.status], f.source, f.detail || '', f.response || '',
  ]);
  const name = `audit_${branchName(c.branch_id)}_${c.period_start}_${c.period_end}.csv`
    .replace(/[^a-z0-9_.-]+/gi, '_');
  downloadCsv(name, [header, ...rows]);
}

// ---------------------------------------------------------------- wiring

function init() {
  // Restore saved changes first, if the visitor switched saving on earlier.
  persistOn = readStore(PERSIST_KEY) === '1';
  if (persistOn) {
    const saved = loadSaved();
    if (saved) { applyData(saved); lastSaved = saved.saved_on || null; } else persist();
  }
  renderDemoStatus();

  // Branch filter (demo branches only - this module never calls /branches).
  const branchSel = $('audit-branch');
  for (const b of BRANCHES) {
    const o = document.createElement('option');
    o.value = String(b.id);
    o.textContent = b.name;
    branchSel.appendChild(o);
  }

  const roleSel = $('audit-preview-role');
  previewRole = state.user?.role === 'admin' ? 'auditor' : 'manager';
  roleSel.value = previewRole;
  applyRoleUi();
  roleSel.addEventListener('change', () => {
    previewRole = roleSel.value;
    renderCycle();
    if (detail) renderDetail();
  });

  branchSel.addEventListener('change', () => {
    renderCycles();
    if ($('scorecard-table')) renderScorecard();
  });
  $('audit-status').addEventListener('change', renderCycles);
  $('btn-audit-new').addEventListener('click', openNewCycle);
  $('btn-audit-scorecard').addEventListener('click', openScorecard);
  $('btn-audit-csv').addEventListener('click', exportCsv);

  $('form-cycle').addEventListener('submit', saveCycle);
  $('form-finding').addEventListener('submit', saveFindingForm);

  $('audit-cycles-table').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-cycle-id]');
    if (tr) openCycle(tr.dataset.cycleId);
  });
  $('audit-findings-table').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-finding-id]');
    if (tr) openFinding(Number(tr.dataset.findingId));
  });

  $('btn-audit-back').addEventListener('click', () => {
    selected = null;
    renderCycle();
    renderCycles();
  });
  $('btn-audit-scan').addEventListener('click', scanNow);
  $('btn-audit-signoff').addEventListener('click', signOffOrReopen);
  $('btn-audit-add-finding').addEventListener('click', openFindingForm);

  const debounced = debounce(renderFindings, 250);
  $('audit-search').addEventListener('input', debounced);
  for (const id of ['audit-area', 'audit-severity', 'audit-finding-status']) {
    $(id).addEventListener('change', renderFindings);
  }

  $('btn-fd-save').addEventListener('click', () => {
    const f = findings.find((x) => String(x.id) === String(detail));
    if (!f) return;
    if (locked()) { toast('Signed off', 'Reopen the audit to change this finding.', 'info'); return; }
    const response = $('fd-response').value.trim();
    if (!canEdit() && !response) {
      toast('Write your response', 'Explain the finding before saving.', 'info');
      $('fd-response').focus();
      return;
    }
    const before = { response: f.response || '', status: f.status };
    f.response = response;
    if (response && response !== before.response) f.responded_at = todayIST();
    if (canEdit()) f.status = $('fd-status').value;
    else if (response && f.status === 'open') f.status = 'responded';
    if (['resolved', 'accepted_risk', 'closed'].includes(f.status)) f.closed_at = todayIST();
    if (response !== before.response) {
      logEvent(f.cycle_id, 'response', !response ? 'Branch response cleared'
        : before.response ? 'Branch response updated' : 'Branch response recorded', f.id);
    }
    if (f.status !== before.status) {
      logEvent(f.cycle_id, 'status',
        `Status changed from ${label(FINDING_STATUS, before.status)} to ${label(FINDING_STATUS, f.status)}`, f.id);
    }
    toast('Finding saved', f.title, 'success');
    afterFindingChange();
  });

  $('fd-delete').addEventListener('click', async () => {
    const i = findings.findIndex((x) => String(x.id) === String(detail));
    if (i < 0) return;
    const ok = await confirmDialog({
      title: 'Delete this finding?', message: findings[i].title, okText: 'Delete',
    });
    if (!ok) return;
    const [removed] = findings.splice(i, 1);
    for (const list of [actions, evidence]) {
      for (let j = list.length - 1; j >= 0; j--) if (list[j].finding_id === removed.id) list.splice(j, 1);
    }
    logEvent(removed.cycle_id, 'finding_deleted', `Finding deleted: ${removed.title}`);
    closeDialog($('modal-finding-detail'));
    detail = null;
    toast('Finding deleted', '', 'success');
    afterFindingChange();
  });

  $('form-add-action').addEventListener('submit', (e) => {
    e.preventDefault();
    if (locked()) return;
    const f = findings.find((x) => String(x.id) === String(detail));
    if (!f) return;
    const title = $('fd-action-title').value.trim();
    if (!title) { $('fd-action-title').focus(); return; }
    actions.push({
      id: seqAction++, finding_id: f.id, title, status: 'open',
      due_date: $('fd-action-due').value || null, owner_name: 'Branch manager', completion_note: '',
    });
    logEvent(f.cycle_id, 'action', `Corrective action added: ${title}`, f.id);
    $('form-add-action').reset();
    afterFindingChange();
    toast('Corrective action added', title, 'success');
  });

  $('fd-actions').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    const li = btn?.closest('[data-action-id]');
    if (!li) return;
    const id = Number(li.dataset.actionId);
    const a = actions.find((x) => x.id === id);
    if (!a) return;
    if (btn.dataset.action === 'toggle-action') {
      a.status = btn.dataset.next;
      a.completed_at = a.status === 'done' ? todayIST() : null;
      logForFinding(a.finding_id, 'action',
        `Corrective action ${a.status === 'done' ? 'marked done' : 'reopened'}: ${a.title}`);
    } else if (btn.dataset.action === 'delete-action') {
      actions.splice(actions.indexOf(a), 1);
      logForFinding(a.finding_id, 'action', `Corrective action removed: ${a.title}`);
    } else return;
    afterFindingChange();
  });

  $('form-add-evidence').addEventListener('submit', (e) => {
    e.preventDefault();
    if (locked()) return;
    const f = findings.find((x) => String(x.id) === String(detail));
    if (!f) return;
    const kind = $('fd-evidence-kind').value;
    const url = $('fd-evidence-url').value.trim();
    const note = $('fd-evidence-note').value.trim();
    if (kind === 'link' && !url) { $('fd-evidence-url').focus(); return; }
    if (kind === 'note' && !note) { $('fd-evidence-note').focus(); return; }
    evidence.push({
      id: seqEvidence++, finding_id: f.id, kind, url: kind === 'link' ? url : null, note,
      added_by: 1, added_by_name: state.user?.name || 'You', created_at: todayIST(),
    });
    logEvent(f.cycle_id, 'evidence', `Evidence added (${kind === 'link' ? 'link' : 'note'})`, f.id);
    $('form-add-evidence').reset();
    afterFindingChange();
  });

  $('fd-evidence').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="delete-evidence"]');
    const li = btn?.closest('[data-evidence-id]');
    if (!li) return;
    const id = Number(li.dataset.evidenceId);
    const i = evidence.findIndex((x) => x.id === id);
    if (i >= 0) {
      const [removed] = evidence.splice(i, 1);
      logForFinding(removed.finding_id, 'evidence', 'Evidence removed');
    }
    afterFindingChange();
  });

  $('btn-scorecard-load').addEventListener('click', renderScorecard);

  $('audit-trail').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="open-trail-finding"]');
    if (btn) openFinding(Number(btn.dataset.findingId));
  });

  $('audit-persist').addEventListener('change', (e) => {
    if (e.target.checked) {
      if (!writeStore(PERSIST_KEY, '1')) {
        e.target.checked = false;
        toast('Storage unavailable', 'This browser does not allow saving, so changes stay in memory.', 'error');
        return;
      }
      persistOn = true;
      persist();
    } else {
      persistOn = false;
      lastSaved = null;
      dropStore(PERSIST_KEY);
      dropStore(STORE_KEY);
    }
    renderDemoStatus();
  });

  $('btn-audit-reset').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Reset demo data?',
      message: 'Every change made in this preview, including anything saved in this browser, is replaced by the original examples.',
      okText: 'Reset',
    });
    if (!ok) return;
    applyData(seedData());
    selected = null;
    detail = null;
    persist();
    renderCycles();
    renderCycle();
    renderFindings();
    toast('Demo data reset', 'The original example audits are back.', 'success');
  });
}

export default {
  init,
  show() {
    if (!loaded) {
      loaded = true;
      renderCycles();
    }
  },
  refresh() {
    renderCycles();
    renderCycle();
  },
};
