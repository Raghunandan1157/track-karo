// HR attendance: daily register, monthly summary, shifts, manual marking.
import {
  $, $$, cloneTpl, fill, setEmpty, toast, toastError, withLoading, showError,
  openDialog, closeDialog, downloadCsv, fmtDay, fmtDuration,
} from '../../ui.js';
import {
  attendanceFor, attendanceStats, monthSummary, markAttendance, attendanceLabels,
  employees, employee, shifts, shiftOf, shiftName, departments, branches,
} from '../store.js';
import { ymd, monthKey, monthLabel, monthDays } from '../seed.js';
import { hrScope, personCell, fillBranches, fillDepartments, hrChip, lockScope } from '../ui.js';

let mode = 'daily';
let lastRows = [];

const filters = () => ({
  branch_id: $('hr-att-branch')?.value || hrScope() || '',
  department: $('hr-att-dept')?.value || '',
});

const selDate = () => $('hr-att-date')?.value || ymd(new Date());
const selMonth = () => $('hr-att-month')?.value || monthKey(new Date());

const labelOf = (status) => attendanceLabels()[status] || String(status || '').replace('_', ' ');

function renderStats(date) {
  const s = attendanceStats(date, filters().branch_id);
  const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  set('hr-att-stat-present', s.present);
  set('hr-att-stat-late', s.late);
  set('hr-att-stat-absent', s.absent);
  set('hr-att-stat-leave', s.leave);
  set('hr-att-stat-notmarked', s.not_marked);
  const pctEl = $('hr-att-stat-pct');
  if (pctEl) pctEl.textContent = `${s.marked ? Math.round((s.present / Math.max(1, s.marked)) * 100) : 0}%`;
}

function renderDaily() {
  const date = selDate();
  const tbody = $('hr-att-table');
  if (!tbody) return;
  const rows = attendanceFor(date, filters());
  lastRows = rows;
  tbody.textContent = '';
  for (const { employee: emp, record } of rows) {
    const tr = cloneTpl('tpl-hr-att-row');
    tr.dataset.empId = emp.id;
    const person = tr.querySelector('[data-field="person"]');
    if (person) person.appendChild(personCell(emp));
    fill(tr, {
      shift: shiftName(emp.shift_id),
      in: record?.in || '-',
      out: record?.out || '-',
      worked: record?.worked_min ? fmtDuration(record.worked_min) : '-',
      ot: record?.ot_min ? fmtDuration(record.ot_min) : '-',
      status: hrChip(labelOf(record?.status || 'not_marked'), record?.status || 'not_marked'),
      note: record?.note || '',
    });
    const markBtn = tr.querySelector('[data-action="mark"]');
    if (markBtn) markBtn.dataset.date = date;
    tbody.appendChild(tr);
  }
  setEmpty('hr-att', rows.length === 0);
  const dayLabel = $('hr-att-day-label');
  if (dayLabel) dayLabel.textContent = fmtDay(date);
  renderStats(date);
}

function renderMonthly() {
  const month = selMonth();
  const tbody = $('hr-att-month-table');
  if (!tbody) return;
  const rows = monthSummary(month, filters());
  tbody.textContent = '';
  for (const r of rows) {
    const tr = cloneTpl('tpl-hr-att-month-row');
    const person = tr.querySelector('[data-field="person"]');
    if (person) person.appendChild(personCell(r.employee));
    fill(tr, {
      working: r.working,
      present: r.present,
      late: r.late,
      half_day: r.half_day,
      leave: r.leave,
      absent: r.absent,
      ot: r.ot_min ? `${(r.ot_min / 60).toFixed(1)}h` : '-',
      pct: hrChip(`${r.attendance_pct}%`, r.attendance_pct >= 95 ? 'valid' : r.attendance_pct >= 85 ? 'expiring' : 'expired'),
    });
    tbody.appendChild(tr);
  }
  setEmpty('hr-att-month', rows.length === 0);
  const label = $('hr-att-month-label');
  if (label) label.textContent = `${monthLabel(month)} · ${monthDays(month)} days`;
}

function renderShifts() {
  const box = $('hr-shift-list');
  if (!box) return;
  box.textContent = '';
  const staff = employees({ branch_id: filters().branch_id }).filter((e) => e.status !== 'inactive');
  for (const s of shifts()) {
    const card = document.createElement('div');
    card.className = 'shift-card';
    const top = document.createElement('div');
    top.className = 'shift-top';
    const name = document.createElement('strong');
    name.textContent = s.name;
    const count = document.createElement('span');
    count.className = 'chip';
    count.textContent = `${staff.filter((e) => String(e.shift_id) === String(s.id)).length} people`;
    top.append(name, count);
    const time = document.createElement('p');
    time.className = 'shift-time';
    time.textContent = `${s.start} - ${s.end} · ${s.days} · ${s.grace_min} min grace`;
    const bar = document.createElement('div');
    bar.className = 'avatar-stack';
    for (const e of staff.filter((x) => String(x.shift_id) === String(s.id)).slice(0, 6)) {
      const a = document.createElement('span');
      a.className = 'avatar avatar-xs';
      a.textContent = e.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
      a.title = e.name;
      a.style.setProperty('--avatar', '#2F6DB5');
      bar.appendChild(a);
    }
    card.append(top, time, bar);
    box.appendChild(card);
  }
}

function fillAttendanceForm(empId) {
  const sel = $('hr-att-employee');
  if (!sel) return;
  sel.textContent = '';
  for (const e of employees({ branch_id: filters().branch_id }).filter((x) => x.status !== 'inactive')) {
    const o = document.createElement('option');
    o.value = String(e.id);
    o.textContent = `${e.name} (${e.emp_code})`;
    sel.appendChild(o);
  }
  if (empId) sel.value = String(empId);
  $('hr-att-date-input').value = selDate();
  $('hr-att-status').value = 'present';
  $('hr-att-in').value = '';
  $('hr-att-out').value = '';
  $('hr-att-note').value = '';
  showError($('hr-att-error'), '');
}

function openMark(empId) {
  fillAttendanceForm(empId);
  openDialog($('modal-hr-attendance'));
}

async function saveMark(e) {
  e.preventDefault();
  const err = $('hr-att-error');
  showError(err, '');
  const employee_id = $('hr-att-employee').value;
  const date = $('hr-att-date-input').value;
  const status = $('hr-att-status').value;
  if (!employee_id) { showError(err, 'Pick an employee.'); return; }
  if (!date) { showError(err, 'Pick a date.'); return; }
  if (date > ymd(new Date())) { showError(err, 'Attendance cannot be marked for a future date.'); return; }
  await withLoading($('btn-hr-save-att'), async () => {
    try {
      markAttendance({
        employee_id, date, status,
        in: $('hr-att-in').value,
        out: $('hr-att-out').value,
        note: $('hr-att-note').value.trim(),
      });
      closeDialog($('modal-hr-attendance'));
      toast('Attendance saved', `${employee(employee_id)?.name || ''} · ${fmtDay(date)}`, 'success');
      $('hr-att-date').value = date;
      renderDaily();
    } catch (ex) {
      showError(err, ex.message);
    }
  });
}

function switchMode(next) {
  mode = next;
  for (const btn of $$('[data-hr-att-mode]')) btn.setAttribute('aria-selected', String(btn.dataset.hrAttMode === next));
  const daily = $('hr-att-daily-card');
  const monthly = $('hr-att-monthly-card');
  if (daily) daily.hidden = next !== 'daily';
  if (monthly) monthly.hidden = next !== 'monthly';
  if (next === 'monthly') renderMonthly();
  else renderDaily();
}

function exportCsv() {
  if (mode === 'monthly') {
    const rows = monthSummary(selMonth(), filters());
    downloadCsv(`attendance-${selMonth()}.csv`, [
      ['Code', 'Name', 'Working days', 'Present', 'Late', 'Half day', 'Leave', 'Absent', 'OT', 'Attendance %'],
      ...rows.map((r) => [r.employee.emp_code, r.employee.name, r.working, r.present, r.late, r.half_day, r.leave, r.absent, `${Math.round(r.ot_min / 60)}h`, `${r.attendance_pct}%`]),
    ]);
    return;
  }
  downloadCsv(`attendance-${selDate()}.csv`, [
    ['Code', 'Name', 'Shift', 'Status', 'In', 'Out', 'Worked', 'OT', 'Note'],
    ...lastRows.map(({ employee: e, record }) => [e.emp_code, e.name, shiftName(e.shift_id), labelOf(record?.status), record?.in || '', record?.out || '', record?.worked_min || 0, record?.ot_min || 0, record?.note || '']),
  ]);
}

function init() {
  fillBranches($('hr-att-branch'));
  lockScope($('hr-att-branch'));
  fillDepartments($('hr-att-dept'));
  if (!$('hr-att-date').value) $('hr-att-date').value = ymd(new Date());
  $('hr-att-month').value = monthKey(new Date());
  $('hr-att-date').addEventListener('change', () => {
    $('hr-att-month').value = $('hr-att-date').value.slice(0, 7);
    if (mode === 'daily') renderDaily();
  });
  $('hr-att-month').addEventListener('change', () => {
    if (mode === 'monthly') renderMonthly();
    else {
      const d = $('hr-att-date').value;
      if (!d || d.slice(0, 7) !== selMonth()) $('hr-att-date').value = `${selMonth()}-01`;
      renderDaily();
    }
  });
  for (const id of ['hr-att-branch', 'hr-att-dept']) {
    $(id).addEventListener('change', () => { if (mode === 'monthly') renderMonthly(); else renderDaily(); renderShifts(); });
  }
  $('btn-hr-mark-att').addEventListener('click', () => openMark());
  $('btn-hr-att-export').addEventListener('click', exportCsv);
  $('form-hr-attendance').addEventListener('submit', saveMark);
  for (const btn of $$('[data-hr-att-mode]')) btn.addEventListener('click', () => switchMode(btn.dataset.hrAttMode));
  $('hr-att-table').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="mark"]');
    if (!btn) return;
    const tr = btn.closest('tr[data-emp-id]');
    if (tr) openMark(tr.dataset.empId);
  });
}

export default {
  init,
  show() {
    fillBranches($('hr-att-branch'));
    lockScope($('hr-att-branch'));
    fillDepartments($('hr-att-dept'));
    if (!$('hr-att-date').value) $('hr-att-date').value = ymd(new Date());
    if (!$('hr-att-month').value) $('hr-att-month').value = monthKey(new Date());
    renderDaily();
    renderShifts();
  },
};
