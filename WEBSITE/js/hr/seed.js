// HRMS - demo seed data (no database).
// Everything here is generated from a fixed hash so the demo looks the same on
// every device, while dates follow the real clock (today's attendance, etc.).

export const BRANCHES = [
  { id: 1, name: 'Head Office - Bengaluru', city: 'Bengaluru' },
  { id: 2, name: 'Mysuru Branch', city: 'Mysuru' },
  { id: 3, name: 'Hubballi Branch', city: 'Hubballi' },
  { id: 4, name: 'Mangaluru Branch', city: 'Mangaluru' },
  { id: 5, name: 'Belagavi Branch', city: 'Belagavi' },
];

export const DEPARTMENTS = [
  { key: 'field_ops', name: 'Field Operations' },
  { key: 'branch_ops', name: 'Branch Operations' },
  { key: 'credit', name: 'Credit & Risk' },
  { key: 'collections', name: 'Collections' },
  { key: 'sales', name: 'Sales' },
  { key: 'hr', name: 'Human Resources' },
  { key: 'finance', name: 'Finance & Accounts' },
  { key: 'it', name: 'Technology' },
];

export const SHIFTS = [
  { id: 1, name: 'General', start: '09:30', end: '18:30', grace_min: 10, half_day_min: 240, days: 'Mon-Sat' },
  { id: 2, name: 'Field', start: '09:00', end: '18:00', grace_min: 15, half_day_min: 240, days: 'Mon-Sat' },
  { id: 3, name: 'Early', start: '08:00', end: '17:00', grace_min: 10, half_day_min: 240, days: 'Mon-Sat' },
  { id: 4, name: 'Night (IT)', start: '14:00', end: '23:00', grace_min: 10, half_day_min: 240, days: 'Mon-Fri' },
];

export const LEAVE_TYPES = {
  casual: { name: 'Casual leave', annual: 12, paid: true },
  sick: { name: 'Sick leave', annual: 10, paid: true },
  earned: { name: 'Earned leave', annual: 15, paid: true },
  comp_off: { name: 'Comp off', annual: 4, paid: true },
  unpaid: { name: 'Unpaid leave', annual: 0, paid: false },
  maternity: { name: 'Maternity leave', annual: 182, paid: true },
};

export const EMPLOYMENT_TYPES = {
  full_time: 'Full time',
  part_time: 'Part time',
  contract: 'Contract',
  intern: 'Intern',
};

export const EMPLOYEE_STATUS = {
  active: 'Active',
  probation: 'Probation',
  notice: 'Notice period',
  inactive: 'Inactive',
};

export const ATTENDANCE_LABELS = {
  present: 'Present',
  late: 'Late',
  half_day: 'Half day',
  leave: 'On leave',
  absent: 'Absent',
  wfh: 'Work from home',
  field: 'On field',
  holiday: 'Holiday',
  week_off: 'Week off',
  not_marked: 'Not marked',
};

export const DOC_TYPES = {
  aadhaar: 'Aadhaar card',
  pan: 'PAN card',
  offer: 'Offer letter',
  contract: 'Employment contract',
  licence: 'Driving licence',
  insurance: 'Health insurance',
  police: 'Police verification',
  qualification: 'Degree certificate',
};

export const REVIEW_CYCLES = [
  {
    id: 1,
    name: 'FY 2026-27 · H2',
    period_from: '2026-10-01',
    period_to: '2027-03-31',
    status: 'in_progress',
    due: '2026-12-15',
  },
  {
    id: 2,
    name: 'FY 2026-27 · H1',
    period_from: '2026-04-01',
    period_to: '2026-09-30',
    status: 'completed',
    due: '2026-09-30',
  },
];

// name, dept, designation, branch, doj, ctc, type, status
const PEOPLE = [
  ['Raghunandan S', 'it', 'Managing Director', 1, '2019-04-01', 4800000, 'full_time', 'active'],
  ['Ganesh R', 'hr', 'HR Manager', 1, '2020-06-15', 1200000, 'full_time', 'active'],
  ['Priya Menon', 'hr', 'HR Executive', 1, '2023-02-01', 620000, 'full_time', 'active'],
  ['Arjun Rao', 'finance', 'Finance Controller', 1, '2021-03-10', 1500000, 'full_time', 'active'],
  ['Kavya Iyer', 'finance', 'Accountant', 1, '2022-08-01', 540000, 'full_time', 'active'],
  ['Sandeep Kulkarni', 'it', 'Engineering Manager', 1, '2021-09-06', 2400000, 'full_time', 'active'],
  ['Meera Nair', 'it', 'Software Engineer', 1, '2023-07-17', 1100000, 'full_time', 'active'],
  ['Nikhil Shetty', 'it', 'Software Engineer', 1, '2024-01-08', 950000, 'full_time', 'active'],
  ['Divya Hegde', 'credit', 'Credit Head', 1, '2020-11-02', 1800000, 'full_time', 'active'],
  ['Ramesh Gowda', 'credit', 'Credit Analyst', 1, '2022-04-11', 720000, 'full_time', 'active'],
  ['Ananya Bhat', 'branch_ops', 'Operations Head', 1, '2021-05-24', 1600000, 'full_time', 'active'],
  ['Suresh Patil', 'collections', 'Collections Head', 1, '2020-02-17', 1400000, 'full_time', 'active'],
  ['Lakshmi Prasad', 'sales', 'Sales Head', 1, '2019-10-07', 2000000, 'full_time', 'active'],
  ['Vikram Singh', 'sales', 'Sales Executive', 1, '2023-11-20', 680000, 'full_time', 'active'],
  ['Pooja Desai', 'branch_ops', 'Operations Executive', 1, '2024-06-03', 480000, 'full_time', 'active'],
  ['Kiran Kumar', 'field_ops', 'Senior Field Officer', 1, '2022-01-10', 420000, 'full_time', 'active'],
  ['Manjunath H', 'field_ops', 'Field Officer', 1, '2023-05-15', 336000, 'full_time', 'active'],
  ['Shwetha R', 'field_ops', 'Field Officer', 1, '2024-02-19', 324000, 'full_time', 'active'],
  ['Harish B', 'field_ops', 'Field Officer', 1, '2024-08-12', 312000, 'full_time', 'active'],
  ['Deepa S', 'field_ops', 'Field Officer', 1, '2025-01-06', 300000, 'full_time', 'active'],
  ['Chandra Shekhar', 'branch_ops', 'Branch Manager', 2, '2020-09-01', 1100000, 'full_time', 'active'],
  ['Nandini Rao', 'field_ops', 'Senior Field Officer', 2, '2022-03-14', 420000, 'full_time', 'active'],
  ['Vinay M', 'field_ops', 'Field Officer', 2, '2023-06-19', 330000, 'full_time', 'active'],
  ['Sowmya K', 'collections', 'Collections Officer', 2, '2024-04-08', 384000, 'full_time', 'active'],
  ['Abhishek N', 'credit', 'Credit Analyst', 2, '2024-09-23', 660000, 'full_time', 'active'],
  ['Roopa V', 'branch_ops', 'Operations Executive', 2, '2025-03-03', 456000, 'full_time', 'active'],
  ['Basavaraj P', 'branch_ops', 'Branch Manager', 3, '2021-01-18', 1050000, 'full_time', 'active'],
  ['Santosh K', 'field_ops', 'Senior Field Officer', 3, '2022-07-11', 408000, 'full_time', 'active'],
  ['Ashwini D', 'field_ops', 'Field Officer', 3, '2023-09-04', 324000, 'full_time', 'active'],
  ['Irfan Ali', 'field_ops', 'Field Officer', 3, '2024-11-25', 312000, 'full_time', 'active'],
  ['Geeta Naik', 'sales', 'Sales Executive', 3, '2025-02-10', 540000, 'full_time', 'active'],
  ['Prashanth Shetty', 'branch_ops', 'Branch Manager', 4, '2020-12-07', 1080000, 'full_time', 'active'],
  ['Reshma D', 'field_ops', 'Senior Field Officer', 4, '2022-02-21', 420000, 'full_time', 'active'],
  ['Sandhya P', 'field_ops', 'Field Officer', 4, '2023-08-14', 324000, 'full_time', 'active'],
  ['Girish M', 'collections', 'Collections Officer', 4, '2024-05-06', 372000, 'full_time', 'active'],
  ['Ayesha S', 'credit', 'Credit Analyst', 4, '2025-04-21', 600000, 'full_time', 'active'],
  ['Mahadev J', 'branch_ops', 'Branch Manager', 5, '2021-06-14', 1020000, 'full_time', 'active'],
  ['Sunita K', 'field_ops', 'Senior Field Officer', 5, '2022-09-05', 396000, 'full_time', 'active'],
  ['Pavan G', 'field_ops', 'Field Officer', 5, '2023-10-16', 312000, 'full_time', 'active'],
  ['Shilpa H', 'field_ops', 'Field Officer', 5, '2025-05-26', 300000, 'full_time', 'active'],
  ['Rohan D', 'it', 'Software Engineer', 1, '2026-10-01', 900000, 'full_time', 'probation'],
  ['Anjali M', 'hr', 'HR Executive', 1, '2026-11-02', 560000, 'full_time', 'probation'],
  ['Karthik B', 'field_ops', 'Field Officer', 1, '2026-10-12', 300000, 'full_time', 'probation'],
];

const BANKS = ['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Canara Bank', 'Axis Bank', 'Kotak Mahindra'];
const CITIES = [
  ['Bengaluru', 'Karnataka', '560001'],
  ['Mysuru', 'Karnataka', '570001'],
  ['Hubballi', 'Karnataka', '580020'],
  ['Mangaluru', 'Karnataka', '575001'],
  ['Belagavi', 'Karnataka', '590001'],
];
const BLOOD = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
const RELATIONS = ['Spouse', 'Father', 'Mother', 'Sibling', 'Guardian'];

const GOAL_POOL = {
  field_ops: ['Customer visits per day', 'Collection target achievement', 'Geofence compliance', 'New customer onboarding'],
  branch_ops: ['Daily operations checklist', 'Cash reconciliation accuracy', 'Branch audit score', 'Customer turnaround time'],
  credit: ['Portfolio at risk', 'File approval turnaround', 'Documentation accuracy', 'Field verification coverage'],
  collections: ['Recovery rate', 'Bucket-X reduction', 'Call coverage', 'Legal case follow-up'],
  sales: ['New accounts opened', 'Disbursement target', 'Cross-sell ratio', 'Lead conversion'],
  hr: ['Time to hire', 'Attendance compliance', 'Training completion', 'Employee engagement score'],
  finance: ['Books closing time', 'Statutory filing accuracy', 'Vendor payment cycle', 'Cost optimisation'],
  it: ['Sprint delivery', 'Production uptime', 'Code review coverage', 'Security fixes closed'],
};

const CANDIDATE_NAMES = [
  'Aditya Kamath', 'Bhoomika R', 'Chetan Naik', 'Diana Fernandes', 'Eshwar Prasad', 'Farhan Khan',
  'Gayatri Hegde', 'Hemanth Rao', 'Ishita Jain', 'Jeevan Kumar', 'Komal S', 'Lokesh Reddy',
  'Manoj Patil', 'Nayana Bhat', 'Omkar Deshpande', 'Pallavi Shetty', 'Rahul Verma', 'Sneha Kulkarni',
];

export const STAGES = {
  applied: 'Applied',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Rejected',
};

// ---------- deterministic helpers ----------
export function hash(str) {
  let h = 2166136261;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
const rnd = (seed) => (hash(seed) % 10000) / 10000;
const pick = (list, seed) => list[hash(seed) % list.length];
const digits = (seed, n) => String(hash(seed)).padEnd(n, '4').slice(0, n);

export const ymd = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
export const addDays = (date, n) => {
  const d = new Date(date.getFullYear ? date : new Date(date + 'T12:00:00'));
  d.setDate(d.getDate() + n);
  return d;
};
export const monthKey = (d = new Date()) => ymd(d).slice(0, 7);
export function monthDays(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}
export function monthLabel(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

/** Annual -> monthly salary split used by every payslip. */
export function salaryStructure(emp) {
  const monthly = Number(emp.ctc || 0) / 12;
  const basic = Math.round(monthly * 0.4);
  const hra = Math.round(monthly * 0.2);
  const conveyance = Math.round(monthly * 0.05);
  const special = Math.max(0, Math.round(monthly - basic - hra - conveyance));
  const pf = Math.round(basic * 0.12);
  const esi = monthly <= 21000 ? Math.round(monthly * 0.0075) : 0;
  const pt = 200;
  const tds = monthlyTds(Number(emp.ctc || 0));
  return { basic, hra, conveyance, special, pf, esi, pt, tds, gross: basic + hra + conveyance + special };
}

function monthlyTds(annual) {
  const taxable = Math.max(0, annual - 75000);
  let tax = 0;
  if (taxable > 300000) tax += Math.min(taxable - 300000, 400000) * 0.05;
  if (taxable > 700000) tax += Math.min(taxable - 700000, 300000) * 0.10;
  if (taxable > 1000000) tax += Math.min(taxable - 1000000, 200000) * 0.15;
  if (taxable > 1200000) tax += Math.min(taxable - 1200000, 300000) * 0.20;
  if (taxable > 1500000) tax += Math.min(taxable - 1500000, 1000000) * 0.30;
  if (taxable > 2500000) tax += (taxable - 2500000) * 0.30;
  return Math.round(tax / 12);
}

/** Contract expiry: doj + 3 years, renewed to next year once it has lapsed. */
function contractExpiry(doj) {
  const start = new Date(doj + 'T12:00:00');
  const exp = new Date(start);
  exp.setFullYear(exp.getFullYear() + 3);
  if (exp < new Date()) {
    const renew = new Date();
    renew.setFullYear(renew.getFullYear() + 1);
    return ymd(renew);
  }
  return ymd(exp);
}

export function buildSeed() {
  const today = new Date();
  const todayStr = ymd(today);
  const year = today.getFullYear();

  const departments = DEPARTMENTS;
  const branches = BRANCHES;
  const shifts = SHIFTS;

  const employees = PEOPLE.map((p, i) => {
    const [name, dept, designation, branchId, doj, ctc, employment_type, status] = p;
    const id = i + 1;
    const slug = name.toLowerCase().replace(/[^a-z]+/g, '.');
    const city = CITIES[(branchId - 1) % CITIES.length];
    const shiftId = dept === 'field_ops' ? 2 : dept === 'it' && id === 8 ? 4 : 1;
    const dobYear = 1982 + (hash(name) % 18);
    const dobMonth = 1 + (hash(name + 'm') % 12);
    const dobDay = 1 + (hash(name + 'd') % 28);
    const isField = dept === 'field_ops';
    return {
      id,
      emp_code: `TK-${String(id).padStart(4, '0')}`,
      name,
      email: `${slug}@trackkaro.in`,
      phone: `9${digits(name + 'p', 9)}`,
      alt_phone: '',
      dob: `${dobYear}-${String(dobMonth).padStart(2, '0')}-${String(dobDay).padStart(2, '0')}`,
      gender: ['Priya', 'Kavya', 'Meera', 'Divya', 'Ananya', 'Lakshmi', 'Pooja', 'Shwetha', 'Deepa', 'Nandini', 'Sowmya', 'Roopa', 'Ashwini', 'Geeta', 'Reshma', 'Sandhya', 'Ayesha', 'Sunita', 'Shilpa', 'Anjali', 'Bhoomika', 'Diana', 'Gayatri', 'Ishita', 'Komal', 'Nayana', 'Pallavi', 'Sneha'].some((n) => name.startsWith(n)) ? 'female' : 'male',
      blood_group: pick(BLOOD, name + 'bg'),
      marital_status: hash(name + 'ms') % 3 === 0 ? 'single' : 'married',
      address: `${(hash(name + 'a') % 200) + 1}, ${pick(['MG Road', 'Ring Road', 'Vijayanagar', 'Gokulam', 'Vidyanagar', 'Kadri'], name + 'st')}`,
      city: city[0],
      state: city[1],
      pincode: city[2],
      emergency_name: pick(['Ravi', 'Suman', 'Anil', 'Rekha', 'Latha', 'Mohan'], name + 'en') + ' ' + name.split(' ').slice(-1)[0],
      emergency_relation: pick(RELATIONS, name + 'er'),
      emergency_phone: `9${digits(name + 'ep', 9)}`,
      branch_id: branchId,
      department: dept,
      designation,
      manager_id: null,
      doj,
      employment_type,
      status,
      work_mode: isField ? 'field' : dept === 'it' ? 'hybrid' : 'office',
      shift_id: shiftId,
      ctc,
      pan: `AB${pick(['CPX', 'DKQ', 'FHR', 'GJT'], name + 'pan')}${digits(name + 'pn', 4)}${pick(['F', 'K', 'M', 'P'], name + 'pl')}`,
      aadhaar_last4: digits(name + 'aa', 4),
      uan: digits(name + 'uan', 12),
      esic: hash(name + 'esic') % 2 ? digits(name + 'es', 10) : '',
      pf_no: `KN/BNG/${digits(name + 'pf', 6)}/000`,
      bank_name: pick(BANKS, name + 'bank'),
      bank_account_last4: digits(name + 'ac', 4),
      ifsc: `HDFC000${digits(name + 'if', 4)}`,
      skills: isField
        ? ['Customer visits', 'Collections', 'Local language']
        : dept === 'it'
          ? ['JavaScript', 'SQL', 'APIs']
          : dept === 'hr'
            ? ['Recruitment', 'Payroll', 'Compliance']
            : ['MS Excel', 'Reporting', 'Coordination'],
      created_at: `${doj}T10:00:00+05:30`,
    };
  });

  // Reporting lines: branch manager for branch roles, department head at HO.
  const byDept = (d) => employees.filter((e) => e.department === d).sort((a, b) => b.ctc - a.ctc);
  const headOf = (d) => byDept(d)[0]?.id ?? null;
  for (const e of employees) {
    if (e.designation === 'Managing Director') continue;
    const branchManager = employees.find((x) => x.branch_id === e.branch_id && x.designation === 'Branch Manager');
    if (e.branch_id !== 1 && branchManager && branchManager.id !== e.id) e.manager_id = branchManager.id;
    else if (e.department === 'field_ops' || e.department === 'collections') e.manager_id = headOf(e.department) ?? headOf('branch_ops');
    else e.manager_id = headOf(e.department) ?? headOf('branch_ops');
    if (e.manager_id === e.id) e.manager_id = 1;
  }

  // ---------- holidays (Karnataka calendar) ----------
  const holidays = [
    { date: `${year}-01-01`, name: 'New Year', type: 'public' },
    { date: `${year}-01-15`, name: 'Makara Sankranti', type: 'public' },
    { date: `${year}-01-26`, name: 'Republic Day', type: 'national' },
    { date: `${year}-03-14`, name: 'Holi', type: 'public' },
    { date: `${year}-04-14`, name: 'Dr. Ambedkar Jayanti', type: 'public' },
    { date: `${year}-05-01`, name: 'May Day', type: 'public' },
    { date: `${year}-08-15`, name: 'Independence Day', type: 'national' },
    { date: `${year}-10-02`, name: 'Gandhi Jayanti', type: 'national' },
    { date: `${year}-10-20`, name: 'Ayudha Puja', type: 'public' },
    { date: `${year}-10-21`, name: 'Vijaya Dashami', type: 'public' },
    { date: `${year}-11-01`, name: 'Kannada Rajyotsava', type: 'public' },
    { date: `${year}-11-08`, name: 'Deepavali', type: 'public' },
    { date: `${year}-12-25`, name: 'Christmas', type: 'public' },
    { date: `${year + 1}-01-01`, name: 'New Year', type: 'public' },
  ];

  // ---------- leave requests ----------
  const leaveTypes = Object.keys(LEAVE_TYPES);
  const leaves = [];
  const reasons = {
    casual: ['Family function', 'Personal work', 'Travelling home', 'Child school event'],
    sick: ['Fever', 'Viral infection', 'Dental procedure', 'Migraine'],
    earned: ['Family holiday', 'Wedding in family', 'Short vacation'],
    comp_off: ['Comp off for month-end closing', 'Comp off for Sunday audit'],
    unpaid: ['Extended personal leave'],
    maternity: ['Maternity leave'],
  };
  let leaveId = 1;
  const statusPlan = [
    ...Array(8).fill('pending'),
    ...Array(22).fill('approved'),
    ...Array(4).fill('rejected'),
    ...Array(3).fill('cancelled'),
  ];
  statusPlan.forEach((status, i) => {
    const emp = employees[(hash('lv' + i) % employees.length)];
    const type = status === 'pending' ? pick(['casual', 'sick', 'earned'], 'lt' + i) : pick(leaveTypes.slice(0, 4), 'lt' + i);
    const offset = status === 'pending'
      ? 3 + (hash('lo' + i) % 25)
      : status === 'approved'
        ? -80 + (hash('lo' + i) % 120)
        : -130 + (hash('lo' + i) % 90);
    const from = addDays(today, offset);
    const days = type === 'maternity' ? 90 : 1 + (hash('ld' + i) % 3);
    const to = addDays(from, days - 1);
    leaves.push({
      id: leaveId++,
      employee_id: emp.id,
      type,
      from: ymd(from),
      to: ymd(to),
      days,
      reason: pick(reasons[type] || ['Personal reason'], 'lr' + i),
      contact: emp.phone,
      status,
      applied_at: new Date(addDays(from, -3).getTime() + 3600000 * 10).toISOString(),
      decided_by: status === 'pending' ? null : 2,
      decided_at: status === 'pending' ? null : new Date(addDays(from, -2).getTime() + 3600000 * 11).toISOString(),
      note: status === 'rejected' ? 'Team coverage not available for these dates.' : '',
    });
  });
  // One approved sick leave covering today, so "on leave today" is populated.
  const todayLeaveEmp = employees[hash('today-leave') % employees.length];
  leaves.push({
    id: leaveId++,
    employee_id: todayLeaveEmp.id,
    type: 'sick',
    from: ymd(addDays(today, -1)),
    to: ymd(addDays(today, 1)),
    days: 3,
    reason: 'Viral fever',
    contact: todayLeaveEmp.phone,
    status: 'approved',
    applied_at: new Date(addDays(today, -3).getTime() + 3600000 * 9).toISOString(),
    decided_by: 2,
    decided_at: new Date(addDays(today, -2).getTime() + 3600000 * 10).toISOString(),
    note: 'Approved by HR',
  });

  // ---------- documents ----------
  const documents = [];
  let docId = 1;
  for (const e of employees) {
    const base = [
      { type: 'aadhaar', number: `XXXX XXXX ${e.aadhaar_last4}`, expires_on: null },
      { type: 'pan', number: e.pan, expires_on: null },
      { type: 'offer', number: `OL/${e.doj.slice(0, 4)}/${e.id}`, expires_on: null },
      { type: 'contract', number: `CT/${e.doj.slice(0, 4)}/${e.id}`, expires_on: contractExpiry(e.doj) },
      { type: 'qualification', number: `REG/${digits(e.name + 'q', 8)}`, expires_on: null },
    ];
    if (e.department === 'field_ops') {
      base.push({ type: 'licence', number: `KA${digits(e.name + 'dl', 2)} ${digits(e.name + 'dl2', 11)}`, expires_on: `${year}-${String(1 + (hash(e.name + 'dx') % 12)).padStart(2, '0')}-15` });
    }
    if (hash(e.name + 'police') % 2 === 0) base.push({ type: 'police', number: `PV/${digits(e.name + 'pv', 6)}`, expires_on: null });
    if (hash(e.name + 'ins') % 7 !== 0) {
      base.push({ type: 'insurance', number: `HI/${year}/${digits(e.name + 'in', 5)}`, expires_on: `${year}-${String(3 + (hash(e.name + 'im') % 9)).padStart(2, '0')}-${String(1 + (hash(e.name + 'id') % 28)).padStart(2, '0')}` });
    }
    for (const d of base) {
      documents.push({
        id: docId++,
        employee_id: e.id,
        type: d.type,
        number: d.number,
        issued_on: e.doj,
        expires_on: d.expires_on,
        file_name: `${d.type}-${e.emp_code}.pdf`,
        notes: '',
      });
    }
  }

  // ---------- recruitment ----------
  const jobs = [
    { id: 1, title: 'Field Officer', department: 'field_ops', branch_id: 2, employment_type: 'full_time', openings: 4, filled: 1, status: 'open', posted_at: ymd(addDays(today, -24)), hiring_manager_id: 21, description: 'Customer visits, collections and geofence compliance across Mysuru city.' },
    { id: 2, title: 'Branch Operations Executive', department: 'branch_ops', branch_id: 1, employment_type: 'full_time', openings: 2, filled: 0, status: 'open', posted_at: ymd(addDays(today, -17)), hiring_manager_id: 11, description: 'Daily branch operations, cash reconciliation and audit readiness.' },
    { id: 3, title: 'Credit Analyst', department: 'credit', branch_id: 1, employment_type: 'full_time', openings: 1, filled: 0, status: 'open', posted_at: ymd(addDays(today, -11)), hiring_manager_id: 9, description: 'Assess loan files, field verification and portfolio risk.' },
    { id: 4, title: 'Collections Officer', department: 'collections', branch_id: 4, employment_type: 'full_time', openings: 2, filled: 1, status: 'open', posted_at: ymd(addDays(today, -35)), hiring_manager_id: 12, description: 'Recovery calls and bucket-X follow-up for the coastal region.' },
    { id: 5, title: 'Software Engineer (Flutter)', department: 'it', branch_id: 1, employment_type: 'full_time', openings: 2, filled: 0, status: 'open', posted_at: ymd(addDays(today, -8)), hiring_manager_id: 6, description: 'Build the field app and the live tracking dashboard.' },
    { id: 6, title: 'HR Executive', department: 'hr', branch_id: 1, employment_type: 'full_time', openings: 1, filled: 1, status: 'closed', posted_at: ymd(addDays(today, -75)), hiring_manager_id: 2, description: 'Recruitment coordination and onboarding.' },
    { id: 7, title: 'Sales Executive', department: 'sales', branch_id: 3, employment_type: 'full_time', openings: 3, filled: 0, status: 'open', posted_at: ymd(addDays(today, -5)), hiring_manager_id: 13, description: 'New account acquisition in the Hubballi belt.' },
  ];

  const stagePlan = ['applied', 'applied', 'applied', 'screening', 'screening', 'screening', 'screening', 'interview', 'interview', 'interview', 'interview', 'offer', 'offer', 'hired', 'hired', 'rejected', 'rejected', 'applied'];
  const candidates = CANDIDATE_NAMES.map((name, i) => {
    const stage = stagePlan[i];
    const job = jobs[hash('cj' + i) % jobs.length];
    return {
      id: i + 1,
      name,
      email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@gmail.com`,
      phone: `9${digits(name + 'cp', 9)}`,
      job_id: job.id,
      stage,
      experience_years: 1 + (hash(name + 'ex') % 9),
      current_ctc: 300000 + (hash(name + 'cc') % 12) * 50000,
      expected_ctc: 400000 + (hash(name + 'ec') % 14) * 50000,
      source: pick(['LinkedIn', 'Referral', 'Naukri', 'Campus', 'Walk-in'], name + 'src'),
      rating: 2 + (hash(name + 'rt') % 4),
      applied_at: ymd(addDays(today, -(2 + (hash(name + 'ap') % 30)))),
      interview_at: stage === 'interview' ? new Date(addDays(today, (hash(name + 'iv') % 8) - 2).getTime() + 3600000 * 11).toISOString() : null,
      notes: '',
    };
  });

  // ---------- onboarding ----------
  const onboarding = employees
    .filter((e) => e.status === 'probation')
    .map((e) => ({
      id: e.id,
      employee_id: e.id,
      start_date: e.doj,
      buddy_id: e.department === 'it' ? 7 : 3,
      tasks: [
        { key: 'docs', label: 'Collect and verify documents', done: true },
        { key: 'contract', label: 'Signed offer and contract', done: true },
        { key: 'bank', label: 'Bank and PF details captured', done: e.id !== 42 },
        { key: 'it', label: 'Laptop, email and system access', done: e.id !== 43 },
        { key: 'id', label: 'ID card and access pass', done: false },
        { key: 'training', label: 'HR policy and POSH training', done: false },
        { key: 'buddy', label: 'Buddy assigned and first-week check-in', done: true },
      ],
    }));

  // ---------- performance reviews ----------
  const reviews = [];
  let reviewId = 1;
  for (const cycle of REVIEW_CYCLES) {
    for (const e of employees) {
      const seed = e.name + cycle.id;
      const roll = hash(seed + 'st') % 100;
      const status = cycle.status === 'completed' ? 'completed' : roll < 45 ? 'completed' : roll < 70 ? 'self_done' : 'pending';
      const self = status === 'pending' ? 0 : 3 + (hash(seed + 's') % 3);
      const mgr = status === 'completed' ? Math.max(1, Math.min(5, self + ((hash(seed + 'm') % 3) - 1))) : 0;
      const goals = (GOAL_POOL[e.department] || GOAL_POOL.branch_ops).slice(0, 3).map((title, gi) => ({
        title,
        weight: gi === 0 ? 40 : gi === 1 ? 35 : 25,
        progress: cycle.status === 'completed' || status === 'completed' ? 70 + (hash(seed + 'g' + gi) % 31) : 15 + (hash(seed + 'g' + gi) % 70),
        rating: status === 'completed' ? 3 + (hash(seed + 'gr' + gi) % 3) : 0,
      }));
      reviews.push({
        id: reviewId++,
        cycle_id: cycle.id,
        employee_id: e.id,
        self_rating: self,
        manager_rating: mgr,
        final_rating: status === 'completed' ? Math.round((self + mgr) / 2) : 0,
        status,
        submitted_at: status === 'completed' ? `${cycle.due}T18:00:00+05:30` : null,
        manager_note: status === 'completed' ? pick(['Consistent performer, ready for more ownership.', 'Strong customer handling; improve documentation discipline.', 'Good year, focus on turnaround time next cycle.'], seed + 'n') : '',
        goals,
      });
    }
  }

  const payroll = [-3, -2, -1].map((offset) => {
    const d = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    return { month: monthKey(d), status: 'paid', processed_at: `${monthKey(d)}-01T19:30:00+05:30`, paid_at: `${monthKey(d)}-02T11:00:00+05:30` };
  });
  payroll.push({ month: monthKey(today), status: 'draft', processed_at: null, paid_at: null });

  return {
    version: 3,
    seeded_on: todayStr,
    employees,
    departments,
    branches,
    shifts,
    holidays,
    leaves,
    documents,
    jobs,
    candidates,
    onboarding,
    reviews,
    review_cycles: REVIEW_CYCLES,
    payroll,
    attendance_overrides: {},
    settings: {
      company: 'Track_karo',
      hr_contact: 'hr@trackkaro.in',
      week_off: [0],
      probation_months: 6,
      notice_days: 30,
      pf_percent: 12,
      esi_limit: 21000,
      ot_rate: 1.5,
    },
  };
}
