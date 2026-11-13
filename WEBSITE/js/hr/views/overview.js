// HR overview: headcount, today's attendance, payroll, upcoming dates.
import { $, confirmDialog, toast } from '../../ui.js';
import {
  hrOverview, headcountByDepartment, payrollTotals,
  upcoming, leaveRequests, onboarding, employee, resetDemo,
} from '../store.js';
import { hrScope, moneyShort, barRow, avatar } from '../ui.js';
import { monthKey, monthLabel } from '../seed.js';

const DOC_SHORT = { insurance: 'Insurance', licence: 'Driving licence', contract: 'Contract', offer: 'Offer letter', police: 'Police verification', aadhaar: 'Aadhaar', pan: 'PAN' };

function renderStats(o) {
  const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  set('hr-stat-headcount', o.headcount);
  set('hr-stat-headcount-sub', `${o.probation} on probation`);
  set('hr-stat-newjoiners', o.new_joiners);
  set('hr-stat-newjoiners-sub', 'Joined in the last 30 days');
  set('hr-stat-onleave', o.on_leave);
  set('hr-stat-onleave-sub', `${o.pending_leave} request${o.pending_leave === 1 ? '' : 's'} awaiting approval`);
  set('hr-stat-present', `${o.present_today}/${o.headcount}`);
  set('hr-stat-present-sub', `${o.attendance_pct}% attendance today`);
}

function renderDepartments(branchId) {
  const box = $('hr-dept-bars');
  if (!box) return;
  box.textContent = '';
  const rows = headcountByDepartment(branchId);
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (!rows.length) {
    const p = document.createElement('p');
    p.className = 'empty-state';
    p.textContent = 'No employees yet.';
    box.appendChild(p);
    return;
  }
  for (const r of rows) box.appendChild(barRow(r.name, r.count, max));
}

function renderAttendance(o) {
  const ring = $('hr-att-ring');
  const legend = $('hr-att-legend');
  if (!ring || !legend) return;
  const pctVal = Math.max(0, Math.min(100, o.attendance_pct));
  ring.style.setProperty('--pct', pctVal);
  const label = $('hr-att-ring-label');
  if (label) label.textContent = `${pctVal}%`;
  legend.textContent = '';
  const items = [
    ['Present', o.present_today, 'present'],
    ['Absent', o.absent_today, 'absent'],
  ];
  for (const [name, value, cls] of items) {
    const li = document.createElement('li');
    li.className = 'legend-item';
    const dot = document.createElement('span');
    dot.className = `legend-dot is-${cls}`;
    const t = document.createElement('span');
    t.textContent = name;
    const v = document.createElement('strong');
    v.textContent = value;
    li.append(dot, t, v);
    legend.appendChild(li);
  }
  const foot = document.createElement('p');
  foot.className = 'legend-foot';
  foot.textContent = `${o.on_leave} on leave · ${o.docs_expiring} documents expiring soon`;
  legend.appendChild(foot);
}

function renderPayroll(branchId) {
  const month = monthKey(new Date());
  const totals = payrollTotals(month, branchId);
  const box = $('hr-pay-summary');
  const label = $('hr-pay-month-label');
  if (label) label.textContent = monthLabel(month);
  if (!box) return;
  box.textContent = '';
  const lines = [
    ['Employees', String(totals.employees)],
    ['Gross', `₹${moneyShort(totals.gross)}`],
    ['Deductions', `₹${moneyShort(totals.deductions)}`],
    ['Net payable', `₹${moneyShort(totals.net)}`],
    ['Employer PF', `₹${moneyShort(totals.employer_pf)}`],
  ];
  for (const [k, v] of lines) {
    const row = document.createElement('div');
    row.className = 'kv-row';
    const a = document.createElement('span');
    a.textContent = k;
    const b = document.createElement('strong');
    b.textContent = v;
    row.append(a, b);
    box.appendChild(row);
  }
  const status = document.createElement('p');
  status.className = 'notice-line';
  status.textContent = totals.run.status === 'paid'
    ? 'Paid for this month.'
    : totals.run.status === 'processed'
      ? 'Processed - waiting for payment.'
      : 'Draft run. Process payroll to lock the numbers.';
  box.appendChild(status);
  const link = document.createElement('button');
  link.type = 'button';
  link.className = 'btn btn-sm';
  link.dataset.viewLink = 'payroll';
  link.textContent = 'Open payroll';
  box.appendChild(link);
}

function renderUpcoming(branchId) {
  const list = $('hr-upcoming');
  if (!list) return;
  list.textContent = '';
  const rows = upcoming(30, branchId);
  if (!rows.length) {
    const li = document.createElement('li');
    li.className = 'empty-state';
    li.textContent = 'Nothing in the next 30 days.';
    list.appendChild(li);
    return;
  }
  for (const r of rows) {
    const li = document.createElement('li');
    li.className = 'list-item upcoming-item';
    const when = document.createElement('span');
    when.className = 'upcoming-date';
    when.textContent = new Date(r.date + 'T12:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    const main = document.createElement('div');
    main.className = 'list-item-main';
    const title = document.createElement('p');
    title.className = 'list-item-title';
    title.textContent = r.label;
    const sub = document.createElement('p');
    sub.className = 'list-item-sub';
    sub.textContent = r.employee ? `${r.employee.name} · ${r.employee.emp_code}` : 'Company holiday';
    main.append(title, sub);
    li.append(when, main);
    list.appendChild(li);
  }
}

function renderPending(branchId) {
  const list = $('hr-pending-leaves');
  if (!list) return;
  list.textContent = '';
  const rows = leaveRequests({ status: 'pending', branch_id: branchId }).slice(0, 5);
  if (!rows.length) {
    const li = document.createElement('li');
    li.className = 'empty-state';
    li.textContent = 'No pending leave requests.';
    list.appendChild(li);
    return;
  }
  for (const r of rows) {
    const emp = employee(r.employee_id);
    const li = document.createElement('li');
    li.className = 'list-item';
    const av = avatar(emp);
    const main = document.createElement('div');
    main.className = 'list-item-main';
    const head = document.createElement('p');
    head.className = 'list-item-head';
    const name = document.createElement('strong');
    name.className = 'list-item-title';
    name.textContent = emp?.name || '-';
    const chipEl = document.createElement('span');
    chipEl.className = 'chip';
    chipEl.dataset.value = 'pending';
    chipEl.textContent = `${r.days}d ${r.type.replace('_', ' ')}`;
    head.append(name, chipEl);
    const sub = document.createElement('p');
    sub.className = 'list-item-sub';
    sub.textContent = `${r.from} to ${r.to} · ${r.reason}`;
    main.append(head, sub);
    li.append(av, main);
    list.appendChild(li);
  }
  const more = document.createElement('button');
  more.type = 'button';
  more.className = 'btn btn-sm btn-link';
  more.dataset.viewLink = 'leave';
  more.textContent = 'Review all requests';
  list.appendChild(more);
}

function renderOnboarding() {
  const list = $('hr-onboarding');
  if (!list) return;
  list.textContent = '';
  const rows = onboarding().slice(0, 4);
  if (!rows.length) {
    const li = document.createElement('li');
    li.className = 'empty-state';
    li.textContent = 'No new joiners in onboarding.';
    list.appendChild(li);
    return;
  }
  for (const o of rows) {
    const li = document.createElement('li');
    li.className = 'onboarding-item';
    const top = document.createElement('div');
    top.className = 'onboarding-top';
    const name = document.createElement('strong');
    name.textContent = o.employee?.name || '-';
    const pct = document.createElement('span');
    pct.className = 'onboarding-pct';
    pct.textContent = `${o.done}/${o.total}`;
    top.append(name, pct);
    const track = document.createElement('span');
    track.className = 'progress-track';
    const fill = document.createElement('span');
    fill.className = 'progress-fill';
    fill.style.width = `${o.pct}%`;
    track.appendChild(fill);
    li.append(top, track);
    list.appendChild(li);
  }
  const more = document.createElement('button');
  more.type = 'button';
  more.className = 'btn btn-sm btn-link';
  more.dataset.viewLink = 'recruitment';
  more.textContent = 'Open onboarding';
  list.appendChild(more);
}

function render() {
  const branchId = hrScope();
  const o = hrOverview(branchId);
  renderStats(o);
  renderDepartments(branchId);
  renderAttendance(o);
  renderPayroll(branchId);
  renderUpcoming(branchId);
  renderPending(branchId);
  renderOnboarding();
  const note = $('hr-scope-note');
  if (note) {
    note.hidden = branchId === null;
    note.textContent = branchId === null ? '' : 'Showing your branch only.';
  }
}

function init() {
  $('btn-hr-reset')?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Reset demo data?',
      message: 'Employees, attendance, leave, payroll and documents go back to the original sample data. This cannot be undone.',
      okText: 'Reset demo data',
    });
    if (!ok) return;
    resetDemo();
    toast('Demo data reset', 'The sample HR data has been restored.', 'success');
    render();
  });
}

export default {
  init,
  show: render,
};
