// HRMS - local demo store (no server, no database).
//
// The screens talk to this module only. When the real backend exists, replace
// the bodies below with fetch() calls - the function names, arguments and
// returned shapes are already close to the API contract in HR_MODULE.md.
//
// Everything is persisted in localStorage under `tk_hr_v3`; "Reset demo data"
// rebuilds the seed from seed.js.

import {
  buildSeed, hash, ymd, addDays, monthKey, monthDays, salaryStructure,
  BRANCHES, DEPARTMENTS, SHIFTS, LEAVE_TYPES, EMPLOYMENT_TYPES, EMPLOYEE_STATUS,
  ATTENDANCE_LABELS, DOC_TYPES, REVIEW_CYCLES, STAGES,
} from './seed.js';

const KEY = 'tk_hr_v3';

function clone(v) { return JSON.parse(JSON.stringify(v)); }

let db = null;

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 3 || !Array.isArray(parsed.employees)) return null;
    return parsed;
  } catch { return null; }
}

function seed() {
  // buildSeed() must run fresh so "today" is right; but keep edits when valid.
  return buildSeed();
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* storage full or blocked */ }
}

export function initStore() {
  if (db) return db;
  db = load() || seed();
  persist();
  return db;
}

export function resetDemo() {
  db = seed();
  persist();
  return db;
}

function data() { return db || initStore(); }

const uid = (list) => (list.length ? Math.max(...list.map((x) => Number(x.id) || 0)) + 1 : 1);
const round = (n) => Math.round(Number(n) || 0);
const nowISO = () => new Date().toISOString();

// ---------- reference data ----------
export const departments = () => data().departments;
export const branches = () => data().branches;
export const shifts = () => data().shifts;
export const leaveTypes = () => LEAVE_TYPES;
export const employmentTypes = () => EMPLOYMENT_TYPES;
export const employeeStatuses = () => EMPLOYEE_STATUS;
export const attendanceLabels = () => ATTENDANCE_LABELS;
export const documentTypes = () => DOC_TYPES;
export const stages = () => STAGES;
export const settings = () => data().settings;

export const departmentName = (key) => DEPARTMENTS.find((d) => d.key === key)?.name || key || '-';
export const branchName = (id) => BRANCHES.find((b) => String(b.id) === String(id))?.name || '-';
export const shiftName = (id) => SHIFTS.find((s) => String(s.id) === String(id))?.name || '-';
export const shiftOf = (emp) => SHIFTS.find((s) => String(s.id) === String(emp?.shift_id)) || SHIFTS[0];
export const typeName = (key) => EMPLOYMENT_TYPES[key] || key || '-';
export const statusName = (key) => EMPLOYEE_STATUS[key] || key || '-';

// ---------- employees ----------
export function employees({
  branch_id, department, status, q, manager_id, employment_type,
} = {}) {
  let list = data().employees.slice();
  if (branch_id) list = list.filter((e) => String(e.branch_id) === String(branch_id));
  if (department) list = list.filter((e) => e.department === department);
  if (status) list = list.filter((e) => e.status === status);
  if (manager_id) list = list.filter((e) => String(e.manager_id) === String(manager_id));
  if (employment_type) list = list.filter((e) => e.employment_type === employment_type);
  if (q) {
    const needle = String(q).toLowerCase().trim();
    list = list.filter((e) =>
      [e.name, e.emp_code, e.email, e.phone, e.designation, e.city]
        .some((v) => String(v || '').toLowerCase().includes(needle)));
  }
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

export const employee = (id) => data().employees.find((e) => String(e.id) === String(id)) || null;
export const employeeName = (id) => employee(id)?.name || '-';
export const managerName = (emp) => (emp?.manager_id ? employeeName(emp.manager_id) : '-');

export function upsertEmployee(payload) {
  const list = data().employees;
  const id = payload.id ? Number(payload.id) : null;
  const clean = { ...payload };
  delete clean.id;
  clean.ctc = Number(clean.ctc) || 0;
  clean.branch_id = Number(clean.branch_id) || 1;
  clean.shift_id = Number(clean.shift_id) || 1;
  clean.manager_id = clean.manager_id ? Number(clean.manager_id) : null;
  if (id) {
    const idx = list.findIndex((e) => e.id === id);
    if (idx < 0) throw new Error('Employee not found');
    list[idx] = { ...list[idx], ...clean, id };
    persist();
    return list[idx];
  }
  const nextId = uid(list);
  const emp = {
    id: nextId,
    emp_code: `TK-${String(nextId).padStart(4, '0')}`,
    created_at: nowISO(),
    status: 'probation',
    skills: [],
    ...clean,
  };
  list.push(emp);
  persist();
  return emp;
}

export function setEmployeeStatus(id, status) {
  const emp = employee(id);
  if (!emp) throw new Error('Employee not found');
  emp.status = status;
  persist();
  return emp;
}

export function headcount() {
  const list = data().employees;
  return {
    total: list.length,
    active: list.filter((e) => e.status !== 'inactive').length,
    probation: list.filter((e) => e.status === 'probation').length,
    notice: list.filter((e) => e.status === 'notice').length,
    inactive: list.filter((e) => e.status === 'inactive').length,
  };
}

export function headcountByDepartment(branchId) {
  const list = employees({ branch_id: branchId, status: '' }).filter((e) => e.status !== 'inactive');
  return DEPARTMENTS.map((d) => ({ ...d, count: list.filter((e) => e.department === d.key).length }))
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count);
}

export function newJoiners(days = 30, branchId) {
  const from = ymd(addDays(new Date(), -days));
  return employees({ branch_id: branchId }).filter((e) => e.doj >= from);
}

// ---------- attendance ----------
function isHoliday(date) {
  return data().holidays.find((h) => h.date === date) || null;
}
function isWeekOff(emp, date) {
  const d = new Date(date + 'T12:00:00');
  const dow = d.getDay();
  const nightShift = emp.shift_id === 4;
  if (nightShift) return dow === 0 || dow === 6;
  return dow === 0; // Sunday
}
function leaveOn(empId, date) {
  return data().leaves.find((l) =>
    String(l.employee_id) === String(empId) &&
    l.status === 'approved' &&
    l.from <= date && l.to >= date) || null;
}
function overrideOn(empId, date) {
  return data().attendance_overrides[`${empId}:${date}`] || null;
}

function inAt(shift, minutes) {
  const [h, m] = shift.start.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const p = (n) => String(Math.floor(n / 60) % 24).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
  return p(total);
}

/**
 * Attendance for one employee on one date.
 * Returns null for future dates (not scheduled yet).
 */
export function attendanceRecord(emp, date) {
  if (!emp) return null;
  const today = ymd(new Date());
  if (date > today) return null;
  const override = overrideOn(emp.id, date);
  if (override) return { ...override, date, employee_id: emp.id, source: override.source || 'manual' };
  const hol = isHoliday(date);
  if (hol) return { date, employee_id: emp.id, status: 'holiday', in: '', out: '', worked_min: 0, ot_min: 0, source: 'calendar', note: hol.name };
  if (isWeekOff(emp, date)) return { date, employee_id: emp.id, status: 'week_off', in: '', out: '', worked_min: 0, ot_min: 0, source: 'calendar', note: '' };
  const leave = leaveOn(emp.id, date);
  if (leave) {
    return { date, employee_id: emp.id, status: 'leave', in: '', out: '', worked_min: 0, ot_min: 0, leave_type: leave.type, source: 'leave', note: LEAVE_TYPES[leave.type]?.name || '' };
  }

  const shift = shiftOf(emp);
  const r = (hash(`${emp.id}:${date}`) % 10000) / 10000;
  let status = 'present';
  if (r < 0.03) status = 'absent';
  else if (r < 0.07) status = 'half_day';
  else if (r < 0.15) status = emp.work_mode === 'field' ? 'field' : 'wfh';
  else if (r < 0.34) status = 'late';
  if (status === 'absent') return { date, employee_id: emp.id, status, in: '', out: '', worked_min: 0, ot_min: 0, source: 'biometric', note: '' };

  const lateBy = status === 'late' ? shift.grace_min + 4 + (hash(emp.id + date + 'l') % 35) : (hash(emp.id + date + 'e') % 8) - 4;
  const inTime = inAt(shift, lateBy);
  const early = status === 'half_day' ? -210 - (hash(emp.id + date) % 45) : (hash(emp.id + date + 'o') % 50);
  const ot = status === 'half_day' ? 0 : (hash(emp.id + date + 't') % 10 === 0 ? 30 + (hash(emp.id + date + 'tt') % 90) : 0);
  const [sh, sm] = shift.start.split(':').map(Number);
  const [eh, em] = shift.end.split(':').map(Number);
  const worked = Math.max(0, (eh * 60 + em) - (sh * 60 + sm) - Math.max(0, -early) + ot - Math.max(0, lateBy));
  return {
    date,
    employee_id: emp.id,
    status,
    in: inTime,
    out: inAt(shift, lateBy + worked),
    worked_min: worked,
    ot_min: ot,
    source: 'biometric',
    note: '',
  };
}

export function attendanceFor(date, { branch_id, department, q } = {}) {
  const list = employees({ branch_id, department, q }).filter((e) => e.status !== 'inactive');
  return list.map((e) => ({ employee: e, record: attendanceRecord(e, date) }));
}

export function markAttendance({ employee_id, date, status, in: inTime = '', out = '', note = '' }) {
  const emp = employee(employee_id);
  if (!emp) throw new Error('Employee not found');
  if (!date) throw new Error('Pick a date');
  const shift = shiftOf(emp);
  let worked = 0;
  if (status === 'present' || status === 'late' || status === 'half_day' || status === 'wfh' || status === 'field') {
    const parse = (t) => { const [h, m] = String(t || '').split(':').map(Number); return Number.isFinite(h) ? h * 60 + m : null; };
    const a = parse(inTime) ?? (shift.start.split(':').map(Number).reduce((h, m) => h * 60 + m, 0));
    const b = parse(out) ?? (shift.end.split(':').map(Number).reduce((h, m) => h * 60 + m, 0));
    worked = Math.max(0, b - a);
  }
  data().attendance_overrides[`${emp.id}:${date}`] = {
    status, in: inTime, out, worked_min: worked, ot_min: 0, note, source: 'manual',
  };
  persist();
  return attendanceRecord(emp, date);
}

export function attendanceStats(date, branchId) {
  const rows = attendanceFor(date, { branch_id: branchId });
  const count = (s) => rows.filter((r) => r.record?.status === s).length;
  const marked = rows.filter((r) => r.record).length;
  return {
    total: rows.length,
    marked,
    present: count('present') + count('late') + count('wfh') + count('field'),
    late: count('late'),
    absent: count('absent'),
    half_day: count('half_day'),
    leave: count('leave'),
    week_off: count('week_off') + count('holiday'),
    not_marked: rows.length - marked,
  };
}

export function employeeMonthSummary(emp, month) {
  const days = monthDays(month);
  const today = ymd(new Date());
  const s = { employee: emp, working: 0, present: 0, late: 0, half_day: 0, leave: 0, absent: 0, ot_min: 0, worked_min: 0, attendance_pct: 0 };
  for (let d = 1; d <= days; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    if (date > today) break;
    const rec = attendanceRecord(emp, date);
    if (!rec || rec.status === 'week_off' || rec.status === 'holiday') continue;
    s.working += 1;
    if (rec.status === 'present' || rec.status === 'wfh' || rec.status === 'field') s.present += 1;
    else if (rec.status === 'late') { s.present += 1; s.late += 1; }
    else if (rec.status === 'half_day') { s.half_day += 1; s.present += 0.5; }
    else if (rec.status === 'leave') s.leave += 1;
    else if (rec.status === 'absent') s.absent += 1;
    s.ot_min += rec.ot_min || 0;
    s.worked_min += rec.worked_min || 0;
  }
  s.attendance_pct = s.working ? Math.round((s.present / s.working) * 100) : 0;
  return s;
}

export function monthSummary(month, { branch_id, department, q } = {}) {
  return employees({ branch_id, department, q })
    .filter((e) => e.status !== 'inactive')
    .map((e) => employeeMonthSummary(e, month));
}

export function attendanceForEmployee(empId, month) {
  const emp = employee(empId);
  if (!emp) return [];
  const days = monthDays(month);
  const today = ymd(new Date());
  const out = [];
  for (let d = days; d >= 1; d--) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    if (date > today) continue;
    const record = attendanceRecord(emp, date);
    if (record) out.push(record);
  }
  return out;
}

// ---------- leave ----------
export function leaveRequests({ status, employee_id, branch_id, type, from, to } = {}) {
  let list = data().leaves.slice();
  if (status) list = list.filter((l) => l.status === status);
  if (type) list = list.filter((l) => l.type === type);
  if (employee_id) list = list.filter((l) => String(l.employee_id) === String(employee_id));
  if (branch_id) list = list.filter((l) => String(employee(l.employee_id)?.branch_id) === String(branch_id));
  if (from) list = list.filter((l) => l.to >= from);
  if (to) list = list.filter((l) => l.from <= to);
  return list.sort((a, b) => (b.applied_at || '').localeCompare(a.applied_at || ''));
}

export function leaveBalance(empId) {
  const year = new Date().getFullYear();
  const approved = data().leaves.filter((l) => String(l.employee_id) === String(empId) && l.status === 'approved' && l.from.slice(0, 4) === String(year));
  return Object.keys(LEAVE_TYPES).filter((k) => k !== 'unpaid' && k !== 'maternity').map((key) => {
    const def = LEAVE_TYPES[key];
    const used = approved.filter((l) => l.type === key).reduce((n, l) => n + Number(l.days || 0), 0);
    return { key, name: def.name, total: def.annual, used, left: Math.max(0, def.annual - used) };
  });
}

export function applyLeave(payload) {
  const emp = employee(payload.employee_id);
  if (!emp) throw new Error('Pick an employee');
  if (!payload.from || !payload.to) throw new Error('Pick the leave dates');
  if (payload.to < payload.from) throw new Error('End date cannot be before the start date');
  const days = Math.max(1, Math.round((new Date(payload.to) - new Date(payload.from)) / 86400000) + 1);
  const req = {
    id: uid(data().leaves),
    employee_id: emp.id,
    type: payload.type || 'casual',
    from: payload.from,
    to: payload.to,
    days,
    reason: String(payload.reason || '').trim(),
    contact: payload.contact || emp.phone,
    status: 'pending',
    applied_at: nowISO(),
    decided_by: null,
    decided_at: null,
    note: '',
  };
  data().leaves.push(req);
  persist();
  return req;
}

export function decideLeave(id, status, note = '') {
  const req = data().leaves.find((l) => String(l.id) === String(id));
  if (!req) throw new Error('Leave request not found');
  if (!['approved', 'rejected', 'cancelled'].includes(status)) throw new Error('Unknown leave status');
  req.status = status;
  req.note = note;
  req.decided_by = 2;
  req.decided_at = nowISO();
  persist();
  return req;
}

export function leaveStats(branchId) {
  const list = leaveRequests({ branch_id: branchId });
  const onLeaveToday = employees({ branch_id: branchId }).filter((e) => leaveOn(e.id, ymd(new Date()))).length;
  return {
    pending: list.filter((l) => l.status === 'pending').length,
    on_leave_today: onLeaveToday,
    approved_this_month: list.filter((l) => l.status === 'approved' && l.from.slice(0, 7) === monthKey(new Date())).length,
  };
}

export const holidays = () => data().holidays.slice().sort((a, b) => a.date.localeCompare(b.date));

// ---------- payroll ----------
export function payrollRuns() {
  return data().payroll.slice().sort((a, b) => b.month.localeCompare(a.month));
}
export function payrollRun(month) {
  if (!data().payroll.some((r) => r.month === month)) {
    data().payroll.push({ month, status: 'draft', processed_at: null, paid_at: null });
    persist();
  }
  return data().payroll.find((r) => r.month === month);
}

export function payslip(month, empId) {
  const emp = employee(empId);
  if (!emp) return null;
  const st = salaryStructure(emp);
  const run = payrollRun(month);
  const sum = employeeMonthSummary(emp, month);
  const lopDays = sum.absent + sum.half_day * 0.5;
  const days = monthDays(month);
  const perDay = st.gross / days;
  const lop = Math.round(perDay * lopDays);
  const bonus = 0;
  const earnings = st.basic + st.hra + st.conveyance + st.special + bonus;
  const gross = Math.max(0, earnings - lop);
  const deductions = st.pf + st.esi + st.pt + st.tds;
  return {
    id: `${month}:${emp.id}`,
    month,
    employee: emp,
    employee_id: emp.id,
    status: run.status,
    days,
    days_paid: Math.max(0, Math.round(sum.working - lopDays)),
    lop_days: lopDays,
    present_days: sum.present,
    structure: st,
    earnings: { basic: st.basic, hra: st.hra, conveyance: st.conveyance, special: st.special, bonus },
    deductions_detail: { pf: st.pf, esi: st.esi, pt: st.pt, tds: st.tds, lop },
    gross,
    total_deductions: deductions,
    net: gross - deductions,
  };
}

export function payrollTotals(month, branchId) {
  const list = employees({ branch_id: branchId }).filter((e) => e.status !== 'inactive');
  const slips = list.map((e) => payslip(month, e.id)).filter(Boolean);
  return {
    employees: slips.length,
    gross: slips.reduce((n, s) => n + s.gross, 0),
    deductions: slips.reduce((n, s) => n + s.total_deductions, 0),
    net: slips.reduce((n, s) => n + s.net, 0),
    employer_pf: slips.reduce((n, s) => n + s.structure.pf, 0),
    run: payrollRun(month),
  };
}

export function processPayroll(month) {
  const run = payrollRun(month);
  if (run.status === 'paid') throw new Error('Payroll is already paid');
  run.status = 'processed';
  run.processed_at = nowISO();
  persist();
  return run;
}

export function markPayrollPaid(month) {
  const run = payrollRun(month);
  if (run.status === 'draft') throw new Error('Run the payroll before marking it paid');
  run.status = 'paid';
  run.paid_at = nowISO();
  persist();
  return run;
}

// ---------- recruitment ----------
export function jobs({ status } = {}) {
  const list = data().jobs.slice();
  return (status ? list.filter((j) => j.status === status) : list)
    .sort((a, b) => b.posted_at.localeCompare(a.posted_at));
}
export function job(id) { return data().jobs.find((j) => String(j.id) === String(id)) || null; }
export const jobTitle = (id) => job(id)?.title || '-';

export function addJob(payload) {
  if (!payload.title) throw new Error('Enter the job title');
  const rec = {
    id: uid(data().jobs),
    title: payload.title.trim(),
    department: payload.department || 'field_ops',
    branch_id: Number(payload.branch_id) || 1,
    employment_type: payload.employment_type || 'full_time',
    openings: Number(payload.openings) || 1,
    filled: 0,
    status: 'open',
    posted_at: ymd(new Date()),
    hiring_manager_id: payload.hiring_manager_id ? Number(payload.hiring_manager_id) : null,
    description: String(payload.description || '').trim(),
  };
  data().jobs.push(rec);
  persist();
  return rec;
}

export function closeJob(id) {
  const j = job(id);
  if (!j) throw new Error('Job not found');
  j.status = j.status === 'open' ? 'closed' : 'open';
  persist();
  return j;
}

export function candidates({ stage, job_id, q } = {}) {
  let list = data().candidates.slice();
  if (stage) list = list.filter((c) => c.stage === stage);
  if (job_id) list = list.filter((c) => String(c.job_id) === String(job_id));
  if (q) {
    const n = q.toLowerCase();
    list = list.filter((c) => [c.name, c.email, c.phone].some((v) => String(v || '').toLowerCase().includes(n)));
  }
  return list.sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
}

export function addCandidate(payload) {
  if (!payload.name) throw new Error('Enter the candidate name');
  if (!payload.job_id) throw new Error('Pick the job');
  const rec = {
    id: uid(data().candidates),
    name: payload.name.trim(),
    email: String(payload.email || '').trim(),
    phone: String(payload.phone || '').trim(),
    job_id: Number(payload.job_id),
    stage: payload.stage || 'applied',
    experience_years: Number(payload.experience_years) || 0,
    current_ctc: Number(payload.current_ctc) || 0,
    expected_ctc: Number(payload.expected_ctc) || 0,
    source: payload.source || 'LinkedIn',
    rating: Number(payload.rating) || 3,
    applied_at: ymd(new Date()),
    interview_at: payload.interview_at ? new Date(payload.interview_at).toISOString() : null,
    notes: String(payload.notes || '').trim(),
  };
  data().candidates.push(rec);
  persist();
  return rec;
}

export function setCandidateStage(id, stage, reason = '') {
  const c = data().candidates.find((x) => String(x.id) === String(id));
  if (!c) throw new Error('Candidate not found');
  c.stage = stage;
  if (reason) c.notes = reason;
  if (stage === 'hired') {
    const j = job(c.job_id);
    if (j) { j.filled = Math.min(j.openings, (j.filled || 0) + 1); if (j.filled >= j.openings) j.status = 'closed'; }
  }
  persist();
  return c;
}

export function recruitmentStats() {
  const cs = data().candidates;
  const open = data().jobs.filter((j) => j.status === 'open');
  const weekEnd = ymd(addDays(new Date(), 7));
  const today = ymd(new Date());
  return {
    open_jobs: open.length,
    openings: open.reduce((n, j) => n + Math.max(0, j.openings - (j.filled || 0)), 0),
    in_pipeline: cs.filter((c) => !['hired', 'rejected'].includes(c.stage)).length,
    interviews_this_week: cs.filter((c) => c.stage === 'interview' && c.interview_at && ymd(new Date(c.interview_at)) >= today && ymd(new Date(c.interview_at)) <= weekEnd).length,
    offers: cs.filter((c) => c.stage === 'offer').length,
    hired_this_month: cs.filter((c) => c.stage === 'hired' && c.applied_at.slice(0, 7) === monthKey(new Date())).length,
  };
}

export function onboarding() {
  return data().onboarding.map((o) => ({
    ...o,
    employee: employee(o.employee_id),
    buddy: employee(o.buddy_id),
    done: o.tasks.filter((t) => t.done).length,
    total: o.tasks.length,
    pct: Math.round((o.tasks.filter((t) => t.done).length / o.tasks.length) * 100),
  })).sort((a, b) => b.start_date.localeCompare(a.start_date));
}

export function toggleOnboardingTask(onboardingId, key) {
  const rec = data().onboarding.find((o) => String(o.id) === String(onboardingId));
  if (!rec) throw new Error('Onboarding record not found');
  const task = rec.tasks.find((t) => t.key === key);
  if (task) task.done = !task.done;
  persist();
  return rec;
}

// ---------- performance ----------
export const reviewCycles = () => data().review_cycles?.length ? data().review_cycles : REVIEW_CYCLES;
export function reviews(cycleId, { branch_id, department, status } = {}) {
  let list = data().reviews.filter((r) => String(r.cycle_id) === String(cycleId));
  if (branch_id || department || status) {
    list = list.filter((r) => {
      const e = employee(r.employee_id);
      if (!e) return false;
      if (branch_id && String(e.branch_id) !== String(branch_id)) return false;
      if (department && e.department !== department) return false;
      if (status && r.status !== status) return false;
      return true;
    });
  }
  return list.map((r) => ({ ...r, employee: employee(r.employee_id) }))
    .sort((a, b) => (a.employee?.name || '').localeCompare(b.employee?.name || ''));
}

export function review(id) {
  const r = data().reviews.find((x) => String(x.id) === String(id));
  return r ? { ...r, employee: employee(r.employee_id) } : null;
}

export function saveReview(id, payload) {
  const r = data().reviews.find((x) => String(x.id) === String(id));
  if (!r) throw new Error('Review not found');
  if (payload.goals) r.goals = payload.goals;
  if (payload.self_rating !== undefined) r.self_rating = Number(payload.self_rating) || 0;
  if (payload.manager_rating !== undefined) r.manager_rating = Number(payload.manager_rating) || 0;
  if (payload.manager_note !== undefined) r.manager_note = payload.manager_note;
  if (payload.status) r.status = payload.status;
  if (r.self_rating && r.manager_rating) {
    r.final_rating = Math.round((r.self_rating + r.manager_rating) / 2);
    r.status = 'completed';
    r.submitted_at = nowISO();
  } else if (r.self_rating) {
    r.status = 'self_done';
  }
  persist();
  return r;
}

export function reviewStats(cycleId) {
  const list = reviews(cycleId);
  const done = list.filter((r) => r.status === 'completed');
  const dist = [1, 2, 3, 4, 5].map((n) => ({ rating: n, count: done.filter((r) => Math.round(r.final_rating) === n).length }));
  const avg = (arr) => arr.length ? arr.reduce((n, v) => n + v, 0) / arr.length : 0;
  return {
    total: list.length,
    completed: done.length,
    pending: list.filter((r) => r.status !== 'completed').length,
    avg_rating: avg(done.map((r) => r.final_rating)).toFixed(1),
    distribution: dist,
  };
}

// ---------- documents ----------
export function documentStatus(doc) {
  if (!doc?.expires_on) return 'valid';
  const today = ymd(new Date());
  if (doc.expires_on < today) return 'expired';
  if (doc.expires_on <= ymd(addDays(new Date(), 30))) return 'expiring';
  return 'valid';
}

export function documents({ employee_id, type, status, q, branch_id } = {}) {
  let list = data().documents.slice();
  if (employee_id) list = list.filter((d) => String(d.employee_id) === String(employee_id));
  if (type) list = list.filter((d) => d.type === type);
  if (branch_id) list = list.filter((d) => String(employee(d.employee_id)?.branch_id) === String(branch_id));
  if (q) {
    const n = q.toLowerCase();
    list = list.filter((d) => {
      const e = employee(d.employee_id);
      return [e?.name, e?.emp_code, d.number, d.type].some((v) => String(v || '').toLowerCase().includes(n));
    });
  }
  list = list.map((d) => ({ ...d, employee: employee(d.employee_id), computed_status: documentStatus(d) }));
  if (status) list = list.filter((d) => d.computed_status === status);
  return list.sort((a, b) => (a.expires_on || '9999').localeCompare(b.expires_on || '9999'));
}

export function documentStats(branchId) {
  const list = documents({ branch_id: branchId });
  const missing = employees({ branch_id: branchId }).filter((e) => e.status !== 'inactive').filter((e) => !list.some((d) => d.employee_id === e.id && d.type === 'insurance')).length;
  return {
    total: list.length,
    valid: list.filter((d) => d.computed_status === 'valid').length,
    expiring: list.filter((d) => d.computed_status === 'expiring').length,
    expired: list.filter((d) => d.computed_status === 'expired').length,
    missing,
  };
}

export function addDocument(payload) {
  const emp = employee(payload.employee_id);
  if (!emp) throw new Error('Pick an employee');
  if (!payload.type) throw new Error('Pick the document type');
  const rec = {
    id: uid(data().documents),
    employee_id: emp.id,
    type: payload.type,
    number: String(payload.number || '').trim(),
    issued_on: payload.issued_on || null,
    expires_on: payload.expires_on || null,
    file_name: payload.file_name || `${payload.type}-${emp.emp_code}.pdf`,
    notes: String(payload.notes || '').trim(),
  };
  data().documents.push(rec);
  persist();
  return rec;
}

export function updateDocument(id, payload) {
  const doc = data().documents.find((d) => String(d.id) === String(id));
  if (!doc) throw new Error('Document not found');
  const emp = employee(payload.employee_id || doc.employee_id);
  if (!emp) throw new Error('Pick an employee');
  doc.employee_id = emp.id;
  if (payload.type) doc.type = payload.type;
  if (payload.number !== undefined) doc.number = String(payload.number || '').trim();
  if (payload.issued_on !== undefined) doc.issued_on = payload.issued_on || null;
  if (payload.expires_on !== undefined) doc.expires_on = payload.expires_on || null;
  if (payload.notes !== undefined) doc.notes = String(payload.notes || '').trim();
  if (payload.file_name) doc.file_name = payload.file_name;
  persist();
  return doc;
}

export function expiringDocuments(days = 30, branchId) {
  const until = ymd(addDays(new Date(), days));
  const today = ymd(new Date());
  return documents({ branch_id: branchId })
    .filter((d) => d.expires_on && d.expires_on >= today && d.expires_on <= until)
    .sort((a, b) => a.expires_on.localeCompare(b.expires_on));
}

// ---------- dashboard ----------
export function upcoming(days = 30, branchId) {
  const today = new Date();
  const end = addDays(today, days);
  const list = employees({ branch_id: branchId }).filter((e) => e.status !== 'inactive');
  const out = [];
  const thisYear = today.getFullYear();
  for (const e of list) {
    const d = new Date(`${thisYear}-${e.dob.slice(5)}T12:00:00`);
    if (d >= today && d <= end) out.push({ type: 'birthday', date: ymd(d), employee: e, label: 'Birthday' });
    const confirm = addDays(new Date(e.doj + 'T12:00:00'), 180);
    if (confirm >= today && confirm <= end) out.push({ type: 'confirmation', date: ymd(confirm), employee: e, label: 'Probation ends' });
  }
  for (const d of expiringDocuments(days, branchId)) {
    out.push({ type: 'document', date: d.expires_on, employee: d.employee, label: `${DOC_TYPES[d.type]} expires` });
  }
  for (const h of data().holidays) {
    const d = new Date(h.date + 'T12:00:00');
    if (d >= today && d <= end) out.push({ type: 'holiday', date: h.date, employee: null, label: h.name });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 12);
}

export function hrOverview(branchId) {
  const hc = headcount();
  const att = attendanceStats(ymd(new Date()), branchId);
  const lv = leaveStats(branchId);
  const pay = payrollTotals(monthKey(new Date()), branchId);
  const rec = recruitmentStats();
  const joining = newJoiners(30, branchId);
  return {
    headcount: branchId ? employees({ branch_id: branchId }).filter((e) => e.status !== 'inactive').length : hc.active,
    new_joiners: joining.length,
    on_leave: lv.on_leave_today,
    pending_leave: lv.pending,
    present_today: att.present,
    absent_today: att.absent,
    attendance_pct: att.total - att.week_off ? Math.round((att.present / Math.max(1, att.total - att.week_off)) * 100) : 0,
    open_roles: rec.open_jobs,
    pipeline: rec.in_pipeline,
    payroll_net: pay.net,
    payroll_status: pay.run.status,
    probation: (branchId ? employees({ branch_id: branchId }) : data().employees).filter((e) => e.status === 'probation').length,
    docs_expiring: documentStats(branchId).expiring,
    docs_expired: documentStats(branchId).expired,
  };
}

// ---------- exports ----------
export function employeesCsv(list) {
  const rows = [['Code', 'Name', 'Designation', 'Department', 'Branch', 'Email', 'Phone', 'DOJ', 'Type', 'Status', 'CTC']];
  for (const e of list) {
    rows.push([e.emp_code, e.name, e.designation, departmentName(e.department), branchName(e.branch_id), e.email, e.phone, e.doj, typeName(e.employment_type), statusName(e.status), e.ctc]);
  }
  return rows;
}
