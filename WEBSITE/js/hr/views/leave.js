// HR leave: approvals, request register, balances and holidays.
import {
  $, $$, cloneTpl, fill, setEmpty, toast, toastError, withLoading, showError,
  openDialog, closeDialog, downloadCsv, fmtDay,
} from '../../ui.js';
import {
  leaveRequests, leaveStats, leaveTypes, leaveBalance, applyLeave, decideLeave,
  holidays, employee, employees, branchName, typeName,
} from '../store.js';
import { ymd, addDays, monthKey } from '../seed.js';
import { hrScope, personCell, fillBranches, avatar, lockScope } from '../ui.js';

let tab = 'approvals';
let lastList = [];

const filters = () => ({
  status: $('hr-leave-status')?.value || '',
  type: $('hr-leave-type')?.value || '',
  branch_id: $('hr-leave-branch')?.value || hrScope() || '',
});

const typeLabel = (key) => leaveTypes()[key]?.name || key;
const statusValue = (s) => s;

function renderStats() {
  const s = leaveStats(hrScope());
  const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  set('hr-leave-stat-pending', s.pending);
  set('hr-leave-stat-onleave', s.on_leave_today);
  set('hr-leave-stat-approved', s.approved_this_month);
  const month = monthKey(new Date());
  set('hr-leave-stat-holidays', holidays().filter((h) => h.date.slice(0, 7) === month).length);
}

function chipsFor(status) {
  const map = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected', cancelled: 'Cancelled' };
  return { text: map[status] || status, value: status };
}

function renderPending() {
  const box = $('hr-leave-pending');
  if (!box) return;
  box.textContent = '';
  const list = leaveRequests({ status: 'pending', branch_id: $('hr-leave-branch')?.value || hrScope() || '' });
  for (const r of list) {
    const emp = employee(r.employee_id);
    const li = document.createElement('li');
    li.className = 'list-item leave-card';
    const av = avatar(emp);
    const main = document.createElement('div');
    main.className = 'list-item-main';
    const head = document.createElement('p');
    head.className = 'list-item-head';
    const name = document.createElement('strong');
    name.className = 'list-item-title';
    name.textContent = emp?.name || '-';
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.dataset.value = 'pending';
    chip.textContent = `${r.days} day${r.days === 1 ? '' : 's'}`;
    const typeChip = document.createElement('span');
    typeChip.className = 'chip';
    typeChip.textContent = typeLabel(r.type);
    head.append(name, chip, typeChip);
    const sub = document.createElement('p');
    sub.className = 'list-item-sub';
    const br = emp ? branchName(emp.branch_id) : '';
    sub.textContent = `${fmtDay(r.from)} - ${fmtDay(r.to)} · ${br}`;
    const body = document.createElement('p');
    body.className = 'list-item-body';
    body.textContent = `${r.reason || 'No reason given'} · contact ${r.contact || emp?.phone || '-'}`;
    main.append(head, sub, body);
    const actions = document.createElement('div');
    actions.className = 'row-actions';
    for (const [label, action, cls] of [['Approve', 'approve', 'btn-primary'], ['Reject', 'reject', '']]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `btn btn-sm ${cls}`;
      b.dataset.action = action;
      b.dataset.leaveId = r.id;
      b.textContent = label;
      actions.appendChild(b);
    }
    li.append(av, main, actions);
    box.appendChild(li);
  }
  const empty = $('hr-leave-pending-empty');
  if (empty) empty.hidden = list.length > 0;
}

function renderTable() {
  const tbody = $('hr-leave-table');
  if (!tbody) return;
  const f = filters();
  const list = leaveRequests({ status: f.status, type: f.type, branch_id: f.branch_id });
  lastList = list;
  tbody.textContent = '';
  for (const r of list) {
    const emp = employee(r.employee_id);
    const tr = cloneTpl('tpl-hr-leave-row');
    tr.dataset.leaveId = r.id;
    const person = tr.querySelector('[data-field="person"]');
    if (person) person.appendChild(personCell(emp));
    fill(tr, {
      type: typeLabel(r.type),
      dates: `${fmtDay(r.from)} - ${fmtDay(r.to)}`,
      days: r.days,
      applied: fmtDay((r.applied_at || '').slice(0, 10)),
      status: chipsFor(r.status),
      decided: r.decided_at ? fmtDay(r.decided_at.slice(0, 10)) : '-',
    });
    const approve = tr.querySelector('[data-action="approve"]');
    const reject = tr.querySelector('[data-action="reject"]');
    if (approve) approve.hidden = r.status !== 'pending';
    if (reject) reject.hidden = r.status !== 'pending';
    tbody.appendChild(tr);
  }
  setEmpty('hr-leave', list.length === 0);
}

function renderBalances() {
  const tbody = $('hr-leave-balance-table');
  if (!tbody) return;
  const list = employees({ branch_id: $('hr-leave-branch')?.value || hrScope() || '' }).filter((e) => e.status !== 'inactive');
  tbody.textContent = '';
  for (const emp of list) {
    const balances = leaveBalance(emp.id);
    const tr = cloneTpl('tpl-hr-leave-balance-row');
    const person = tr.querySelector('[data-field="person"]');
    if (person) person.appendChild(personCell(emp));
    const box = tr.querySelector('[data-field="balance"]');
    if (box) {
      box.textContent = '';
      for (const b of balances.filter((x) => x.key !== 'comp_off')) {
        const row = document.createElement('div');
        row.className = 'leave-balance';
        const label = document.createElement('span');
        label.className = 'leave-balance-label';
        label.textContent = b.name.replace(' leave', '');
        const track = document.createElement('span');
        track.className = 'progress-track';
        const fillEl = document.createElement('span');
        fillEl.className = 'progress-fill';
        fillEl.style.width = `${b.total ? Math.min(100, Math.round((b.used / b.total) * 100)) : 0}%`;
        track.appendChild(fillEl);
        const value = document.createElement('span');
        value.className = 'leave-balance-value';
        value.textContent = `${b.left}/${b.total}`;
        row.append(label, track, value);
        box.appendChild(row);
      }
    }
    tbody.appendChild(tr);
  }
  setEmpty('hr-leave-balance', list.length === 0);
}

function renderHolidays() {
  const box = $('hr-holiday-list');
  if (!box) return;
  box.textContent = '';
  let currentMonth = '';
  for (const h of holidays()) {
    const month = h.date.slice(0, 7);
    if (month !== currentMonth) {
      currentMonth = month;
      const heading = document.createElement('h3');
      heading.className = 'holiday-month';
      heading.textContent = new Date(h.date + 'T12:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      box.appendChild(heading);
    }
    const row = document.createElement('div');
    row.className = 'holiday-row';
    const date = document.createElement('span');
    date.className = 'holiday-date';
    date.textContent = new Date(h.date + 'T12:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    const main = document.createElement('div');
    main.className = 'holiday-main';
    const name = document.createElement('strong');
    name.textContent = h.name;
    const day = document.createElement('span');
    day.className = 'muted';
    day.textContent = new Date(h.date + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'long' });
    main.append(name, day);
    const type = document.createElement('span');
    type.className = 'chip';
    type.textContent = h.type;
    row.append(date, main, type);
    box.appendChild(row);
  }
}

function switchTab(next) {
  tab = next;
  for (const btn of $$('[data-hr-leave-tab]')) btn.setAttribute('aria-selected', String(btn.dataset.hrLeaveTab === next));
  const panels = {
    approvals: $('hr-leave-approvals'),
    requests: $('hr-leave-requests'),
    balances: $('hr-leave-balances'),
    holidays: $('hr-leave-holidays'),
  };
  for (const [key, el] of Object.entries(panels)) if (el) el.hidden = key !== next;
  if (next === 'approvals') renderPending();
  if (next === 'requests') renderTable();
  if (next === 'balances') renderBalances();
  if (next === 'holidays') renderHolidays();
}

async function decide(id, status) {
  try {
    decideLeave(id, status);
    toast(status === 'approved' ? 'Leave approved' : 'Leave rejected', employee(leaveRequests().find((l) => l.id === id)?.employee_id)?.name || '', 'success');
    renderPending();
    renderTable();
    renderStats();
  } catch (err) {
    toastError(err, 'Could not update the request');
  }
}

function openApply() {
  const sel = $('hr-leave-employee');
  sel.textContent = '';
  for (const e of employees({ branch_id: hrScope() || '' }).filter((x) => x.status !== 'inactive')) {
    const o = document.createElement('option');
    o.value = String(e.id);
    o.textContent = `${e.name} (${e.emp_code})`;
    sel.appendChild(o);
  }
  const typeSel = $('hr-leave-type-input');
  typeSel.textContent = '';
  for (const [key, def] of Object.entries(leaveTypes())) {
    const o = document.createElement('option');
    o.value = key;
    o.textContent = def.name;
    typeSel.appendChild(o);
  }
  $('form-hr-leave').reset();
  $('hr-leave-from').value = ymd(new Date());
  $('hr-leave-to').value = ymd(new Date());
  showError($('hr-leave-error'), '');
  openDialog($('modal-hr-leave'));
}

async function saveApply(e) {
  e.preventDefault();
  const err = $('hr-leave-error');
  showError(err, '');
  const from = $('hr-leave-from').value;
  const to = $('hr-leave-to').value;
  if (!from || !to) { showError(err, 'Pick both dates.'); return; }
  if (to < from) { showError(err, 'The end date cannot be before the start date.'); $('hr-leave-to').focus(); return; }
  if (!$('hr-leave-reason').value.trim()) { showError(err, 'Enter a short reason.'); $('hr-leave-reason').focus(); return; }
  await withLoading($('btn-hr-save-leave'), async () => {
    try {
      applyLeave({
        employee_id: $('hr-leave-employee').value,
        type: $('hr-leave-type-input').value,
        from,
        to,
        reason: $('hr-leave-reason').value.trim(),
        contact: $('hr-leave-contact').value.trim(),
      });
      closeDialog($('modal-hr-leave'));
      toast('Leave request submitted', `${fmtDay(from)} - ${fmtDay(to)}`, 'success');
      renderPending();
      switchTab('requests');
      renderStats();
    } catch (ex) {
      showError(err, ex.message);
    }
  });
}

function exportCsv() {
  const rows = leaveRequests(filters()).map((r) => {
    const e = employee(r.employee_id);
    return [e?.emp_code || '', e?.name || '', typeLabel(r.type), r.from, r.to, r.days, r.reason, r.status, r.decided_at ? r.decided_at.slice(0, 10) : ''];
  });
  downloadCsv(`leave-${ymd(new Date())}.csv`, [['Code', 'Name', 'Type', 'From', 'To', 'Days', 'Reason', 'Status', 'Decided'], ...rows]);
}

function init() {
  fillBranches($('hr-leave-branch'));
  lockScope($('hr-leave-branch'));
  const typeSel = $('hr-leave-type');
  if (typeSel) {
    for (const [key, def] of Object.entries(leaveTypes())) {
      const o = document.createElement('option');
      o.value = key;
      o.textContent = def.name;
      typeSel.appendChild(o);
    }
  }
  $('hr-leave-status').addEventListener('change', () => { if (tab === 'requests') renderTable(); });
  $('hr-leave-type').addEventListener('change', () => { if (tab === 'requests') renderTable(); });
  $('hr-leave-branch').addEventListener('change', () => { renderStats(); switchTab(tab); });
  $('btn-hr-apply-leave').addEventListener('click', openApply);
  $('btn-hr-leave-export').addEventListener('click', exportCsv);
  $('form-hr-leave').addEventListener('submit', saveApply);
  for (const btn of $$('[data-hr-leave-tab]')) btn.addEventListener('click', () => switchTab(btn.dataset.hrLeaveTab));
  $('hr-leave-pending').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-leave-id]');
    if (btn) decide(btn.dataset.leaveId, btn.dataset.action === 'approve' ? 'approved' : 'rejected');
  });
  $('hr-leave-table').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const tr = btn.closest('tr[data-leave-id]');
    if (!tr) return;
    decide(tr.dataset.leaveId, btn.dataset.action === 'approve' ? 'approved' : 'rejected');
  });
}

export default {
  init,
  show() {
    fillBranches($('hr-leave-branch'));
    lockScope($('hr-leave-branch'));
    renderStats();
    switchTab(tab);
  },
};
