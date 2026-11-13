// Recovery module - stage definitions and static demo data (no database, no API).
// Everything lives in memory: stage changes, payments and notices reset on reload.

// ---------- stage definitions ----------
export const GROUPS = [
  { key: 'pre_legal', label: 'Pre-Legal Recovery', short: 'Pre-legal', from: 1, to: 12 },
  { key: 'legal', label: 'Legal Recovery', short: 'Legal', from: 13, to: 22 },
  { key: 'final', label: 'Final Recovery', short: 'Final', from: 23, to: 28 },
];

export const STAGES = [
  { no: 1, title: 'Overdue identification', group: 'pre_legal', owner: 'Recovery officer', sla: 1, evidence: 'Overdue report, loan ledger', description: 'Identify accounts that have crossed the due date and classify them by ageing and exposure.' },
  { no: 2, title: 'Case creation', group: 'pre_legal', owner: 'Recovery officer', sla: 1, evidence: 'Case file, KYC and loan documents', description: 'Open a recovery case with borrower, loan and overdue details, and record the source of the overdue.' },
  { no: 3, title: 'Recovery officer assignment', group: 'pre_legal', owner: 'Recovery manager', sla: 1, evidence: 'Assignment order', description: 'Assign the case to a recovery officer based on branch, exposure and officer workload.' },
  { no: 4, title: 'Initial customer contact', group: 'pre_legal', owner: 'Recovery officer', sla: 2, evidence: 'Contact log (call/SMS/letter)', description: 'Make first contact with the borrower, confirm the overdue and explain the consequences of default.' },
  { no: 5, title: 'Telephone follow-up', group: 'pre_legal', owner: 'Recovery officer', sla: 3, evidence: 'Call log with date and outcome', description: 'Follow up by telephone, record the borrower\'s response and agree the next contact date.' },
  { no: 6, title: 'Personal visit', group: 'pre_legal', owner: 'Recovery officer', sla: 5, evidence: 'Visit report, geo-tagged photo', description: 'Visit the borrower or guarantor at the address on record and document the outcome of the visit.' },
  { no: 7, title: 'Demand notice preparation', group: 'pre_legal', owner: 'Recovery officer', sla: 3, evidence: 'Draft demand notice', description: 'Prepare a demand notice stating the outstanding, overdue amount, deadline and payment instructions.' },
  { no: 8, title: 'Notice dispatch', group: 'pre_legal', owner: 'Recovery officer', sla: 2, evidence: 'Postal receipt / dispatch register', description: 'Dispatch the demand notice by registered post, speed post or email and record the tracking reference.' },
  { no: 9, title: 'Notice delivery confirmation', group: 'pre_legal', owner: 'Recovery officer', sla: 5, evidence: 'Acknowledgement / delivery tracking', description: 'Confirm delivery of the notice and retain the acknowledgement or tracking proof on file.' },
  { no: 10, title: 'Borrower response', group: 'pre_legal', owner: 'Recovery officer', sla: 7, evidence: 'Written or recorded response', description: 'Record the borrower\'s reply, objection or request, and decide whether negotiation is possible.' },
  { no: 11, title: 'Payment commitment or negotiation', group: 'pre_legal', owner: 'Recovery manager', sla: 5, evidence: 'Commitment letter / negotiation note', description: 'Agree a payment plan or settlement discussion, with dates, amounts and approval requirements.' },
  { no: 12, title: 'Legal review and escalation', group: 'pre_legal', owner: 'Recovery manager', sla: 3, evidence: 'Escalation note, legal checklist', description: 'Review the case for legal action and escalate to the legal cell with all supporting documents.' },

  { no: 13, title: 'Legal approval', group: 'legal', owner: 'Legal officer', sla: 5, evidence: 'Legal opinion / approval note', description: 'Obtain approval from the competent authority to initiate legal or statutory proceedings.' },
  { no: 14, title: 'Legal notice or statutory process', group: 'legal', owner: 'Legal officer', sla: 7, evidence: 'Legal notice, statutory form', description: 'Issue the legal notice or start the applicable statutory process, as advised by the legal cell.' },
  { no: 15, title: 'Filing before the appropriate authority', group: 'legal', owner: 'Legal officer', sla: 15, evidence: 'Filing receipt, plaint / application', description: 'File the case before the appropriate court, tribunal or authority and retain the filing receipt.' },
  { no: 16, title: 'Case registration', group: 'legal', owner: 'Legal officer', sla: 7, evidence: 'Case number / registration order', description: 'Record the case number, forum, bench and next date once the authority registers the case.' },
  { no: 17, title: 'Notice or summons proceedings', group: 'legal', owner: 'Legal officer', sla: 15, evidence: 'Summons, service affidavit', description: 'Serve summons on the borrower and complete the procedural steps required before the hearing.' },
  { no: 18, title: 'Hearing scheduled', group: 'legal', owner: 'Legal officer', sla: 10, evidence: 'Cause list / hearing notice', description: 'Track the hearing date, brief the advocate and ensure the case file is ready.' },
  { no: 19, title: 'Hearing completed', group: 'legal', owner: 'Legal officer', sla: 5, evidence: 'Hearing minutes / advocate note', description: 'Record the proceedings, adjournments and directions of the authority after the hearing.' },
  { no: 20, title: 'Order or award received', group: 'legal', owner: 'Legal officer', sla: 10, evidence: 'Certified order / award copy', description: 'Receive the order or award, review the relief granted and communicate it to the recovery team.' },
  { no: 21, title: 'Execution or enforcement proceedings', group: 'legal', owner: 'Legal officer', sla: 30, evidence: 'Execution petition, attachment order', description: 'Start execution or enforcement where the borrower does not comply with the order or award.' },
  { no: 22, title: 'Recovery realization', group: 'legal', owner: 'Recovery manager', sla: 15, evidence: 'Receipt, bank credit advice', description: 'Realize the amount through the legal process and update the loan account and case ledger.' },

  { no: 23, title: 'Partial recovery', group: 'final', owner: 'Recovery officer', sla: 1, evidence: 'Payment receipt', description: 'Record a part payment or part realization and update the outstanding and overdue balances.' },
  { no: 24, title: 'Settlement proposal', group: 'final', owner: 'Recovery officer', sla: 5, evidence: 'Settlement proposal, waiver working', description: 'Prepare a one-time settlement or instalment proposal with the waiver amount and justification.' },
  { no: 25, title: 'Settlement approval', group: 'final', owner: 'Recovery manager', sla: 3, evidence: 'Approval note / committee resolution', description: 'Obtain approval from the competent authority for the settlement terms.' },
  { no: 26, title: 'Settlement payment', group: 'final', owner: 'Recovery officer', sla: 5, evidence: 'Payment receipt, cleared instrument', description: 'Collect the settlement amount as per the approved schedule and confirm the credit.' },
  { no: 27, title: 'Full recovery', group: 'final', owner: 'Recovery officer', sla: 1, evidence: 'Final receipt, nil-dues working', description: 'Confirm that the principal, interest and charges have been fully recovered.' },
  { no: 28, title: 'Case closure', group: 'final', owner: 'Recovery manager', sla: 2, evidence: 'Closure note, no-dues certificate', description: 'Close the recovery case, issue the no-dues position and archive the documents.' },
];

export const OFFICERS = ['S. Kulkarni', 'A. Pathak', 'P. Gaikwad', 'M. Shaikh'];
export const BRANCHES = ['Shirur', 'Wagholi', 'Khed', 'Junnar', 'Ambegaon', 'Baramati', 'Indapur', 'Daund'];

// ---------- formatting helpers ----------
const DAY = 86400000;
const NOW = new Date();

const inrFmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inrFmt2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const dateFmt = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' });
const dateShortFmt = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' });

export const inr = (n) => inrFmt.format(Number(n) || 0);
export const inrExact = (n) => inrFmt2.format(Number(n) || 0);

/** ₹12.4 L / ₹1.42 Cr for headline numbers. */
export function inrCompact(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 10000000) return `₹${(v / 10000000).toFixed(2)} Cr`;
  if (Math.abs(v) >= 100000) return `₹${(v / 100000).toFixed(2)} L`;
  return inr(v);
}

const toDate = (iso) => (iso ? new Date(`${iso}T12:00:00+05:30`) : null);
export const fmtDate = (iso) => (iso ? dateFmt.format(toDate(iso)) : '-');
export const fmtDateShort = (iso) => (iso ? dateShortFmt.format(toDate(iso)) : '-');
export const todayISO = () => {
  const d = new Date(NOW);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export function isoAgo(days) {
  const d = new Date(NOW.getTime() - Math.max(0, Math.round(days)) * DAY);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function isoIn(days) {
  const d = new Date(NOW.getTime() + Math.round(days) * DAY);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const daysBetween = (fromISO, toISO = todayISO()) => {
  const a = new Date(`${fromISO}T00:00:00+05:30`);
  const b = new Date(`${toISO}T00:00:00+05:30`);
  return Math.max(0, Math.round((b - a) / DAY));
};
export const addDaysISO = (iso, days) => {
  const d = new Date(`${iso}T12:00:00+05:30`);
  d.setDate(d.getDate() + Math.round(days));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const stageDef = (no) => STAGES[Math.min(Math.max(Number(no) || 1, 1), 28) - 1];
export const groupOfStage = (no) => GROUPS.find((g) => no >= g.from && no <= g.to) || GROUPS[0];
export const groupLabel = (key) => (GROUPS.find((g) => g.key === key) || GROUPS[0]).label;
export const isGroup = (no, key) => groupOfStage(no).key === key;
export const daysOverdue = (c) => (c.status === 'closed' ? c.days : daysBetween(c.overdueSince));

// ---------- sample cases ----------
const BASE_CASES = [
  {
    id: 'RC-2026-0143', borrower: 'Rahul Chavan', memberNo: 'C-1187', phone: '98220 44120',
    village: 'Shirur', branch: 'Shirur', loanType: 'Crop loan', loanNo: 'CL-2025-0288',
    sanctioned: 520000, outstanding: 468000, overdue: 88000, days: 34, stage: 1,
    risk: 'medium', officer: 'P. Gaikwad', nextAction: 'Confirm overdue classification', nextDueIn: 1,
    status: 'active', note: 'Seasonal crop loan; borrower has requested time till the next harvest.',
  },
  {
    id: 'RC-2026-0142', borrower: 'Ramesh Patil', memberNo: 'C-1042', phone: '98220 12345',
    village: 'Shirur', branch: 'Shirur', loanType: 'Gold loan', loanNo: 'GL-2024-0451',
    sanctioned: 450000, outstanding: 386000, overdue: 92500, days: 458, stage: 9,
    risk: 'high', officer: 'S. Kulkarni', nextAction: 'Confirm demand notice delivery', nextDueIn: 0,
    status: 'active', note: 'Demand notice returned once; re-dispatched to the village address.',
  },
  {
    id: 'RC-2026-0141', borrower: 'Sunita Deshmukh', memberNo: 'C-0974', phone: '99700 21874',
    village: 'Wagholi', branch: 'Wagholi', loanType: 'Cash credit', loanNo: 'CC-2023-0116',
    sanctioned: 1500000, outstanding: 1240000, overdue: 315000, days: 612, stage: 18,
    risk: 'high', officer: 'A. Pathak', nextAction: 'Hearing on 24 Nov 2026', nextDueIn: 11,
    status: 'active', note: 'Business premises attached; matter listed before the civil judge.',
    hearingOn: '2026-11-24',
  },
  {
    id: 'RC-2026-0138', borrower: 'Imran Shaikh', memberNo: 'C-0881', phone: '98901 55620',
    village: 'Khed', branch: 'Khed', loanType: 'Term loan', loanNo: 'TL-2022-0773',
    sanctioned: 1000000, outstanding: 875000, overdue: 142300, days: 274, stage: 12,
    risk: 'high', officer: 'S. Kulkarni', nextAction: 'Legal review and escalation note', nextDueIn: 2,
    status: 'active', note: 'Borrower disputes the interest calculation; legal opinion requested.',
  },
  {
    id: 'RC-2026-0135', borrower: 'Vijay Jadhav', memberNo: 'C-1265', phone: '97650 33178',
    village: 'Junnar', branch: 'Junnar', loanType: 'Vehicle loan', loanNo: 'VL-2024-0192',
    sanctioned: 280000, outstanding: 215000, overdue: 38400, days: 96, stage: 6,
    risk: 'medium', officer: 'P. Gaikwad', nextAction: 'Schedule personal visit', nextDueIn: 3,
    status: 'active', note: 'Telephone follow-ups unanswered; visit the guarantor as well.',
  },
  {
    id: 'RC-2026-0131', borrower: 'Kavita More', memberNo: 'C-1340', phone: '98230 77415',
    village: 'Ambegaon', branch: 'Ambegaon', loanType: 'Personal loan', loanNo: 'PL-2025-0064',
    sanctioned: 200000, outstanding: 145000, overdue: 27800, days: 61, stage: 11,
    risk: 'medium', officer: 'P. Gaikwad', nextAction: 'Collect payment commitment', nextDueIn: 1,
    status: 'active', note: 'Borrower has committed to pay ₹15,000 per month from December.',
  },
  {
    id: 'RC-2026-0127', borrower: 'Suresh Gaikwad', memberNo: 'C-0743', phone: '94220 60118',
    village: 'Baramati', branch: 'Baramati', loanType: 'Crop loan', loanNo: 'CL-2023-0441',
    sanctioned: 650000, outstanding: 520000, overdue: 186000, days: 210, stage: 22,
    risk: 'high', officer: 'A. Pathak', nextAction: 'Realize the awarded amount', nextDueIn: 5,
    status: 'active', note: 'Award received; bank account attachment in progress.',
  },
  {
    id: 'RC-2026-0124', borrower: 'Anita Pawar', memberNo: 'C-0619', phone: '99600 48231',
    village: 'Indapur', branch: 'Indapur', loanType: 'Housing loan', loanNo: 'HL-2021-0087',
    sanctioned: 2200000, outstanding: 1860000, overdue: 234500, days: 330, stage: 24,
    risk: 'high', officer: 'S. Kulkarni', nextAction: 'Settlement approval by committee', nextDueIn: 4,
    status: 'active', note: 'One-time settlement proposed at 76% of total dues.',
  },
  {
    id: 'RC-2026-0119', borrower: 'Pravin Bhosale', memberNo: 'C-1021', phone: '98500 11290',
    village: 'Daund', branch: 'Daund', loanType: 'Gold loan', loanNo: 'GL-2023-0210',
    sanctioned: 460000, outstanding: 402000, overdue: 0, days: 180, stage: 27,
    risk: 'low', officer: 'P. Gaikwad', nextAction: 'Confirm full recovery and close', nextDueIn: 2,
    status: 'active', note: 'Entire overdue cleared; awaiting closure approval.',
  },
  {
    id: 'RC-2026-0115', borrower: 'Farida Ansari', memberNo: 'C-1298', phone: '98220 90041',
    village: 'Wagholi', branch: 'Wagholi', loanType: 'Business loan', loanNo: 'BL-2024-0324',
    sanctioned: 750000, outstanding: 680000, overdue: 74200, days: 43, stage: 5,
    risk: 'medium', officer: 'A. Pathak', nextAction: 'Second telephone follow-up', nextDueIn: 0,
    status: 'active', note: 'First call connected; borrower asked for a week to arrange funds.',
  },
  {
    id: 'RC-2026-0111', borrower: 'Mahesh Kulkarni', memberNo: 'C-0552', phone: '94030 22187',
    village: 'Khed', branch: 'Khed', loanType: 'Term loan', loanNo: 'TL-2021-0391',
    sanctioned: 1200000, outstanding: 910000, overdue: 245000, days: 388, stage: 16,
    risk: 'high', officer: 'S. Kulkarni', nextAction: 'Case registration before authority', nextDueIn: 6,
    status: 'active', note: 'Filing accepted; awaiting registration number from the court.',
  },
  {
    id: 'RC-2026-0108', borrower: 'Nanda Sawant', memberNo: 'C-1174', phone: '97640 55213',
    village: 'Junnar', branch: 'Junnar', loanType: 'Cash credit', loanNo: 'CC-2024-0205',
    sanctioned: 420000, outstanding: 355000, overdue: 48600, days: 72, stage: 3,
    risk: 'medium', officer: 'M. Shaikh', nextAction: 'Assign recovery officer', nextDueIn: 1,
    status: 'active', note: 'Newly created case; branch recommends the Junnar field officer.',
  },
  {
    id: 'RC-2026-0102', borrower: 'Ganesh Shinde', memberNo: 'C-0407', phone: '99220 31866',
    village: 'Baramati', branch: 'Baramati', loanType: 'Gold loan', loanNo: 'GL-2022-0148',
    sanctioned: 320000, outstanding: 0, overdue: 0, days: 154, stage: 28,
    risk: 'low', officer: 'P. Gaikwad', nextAction: 'Case closed', nextDueIn: 0,
    status: 'closed', closedAt: isoAgo(12), note: 'Full recovery completed and no-dues certificate issued.',
  },
];

function caseHistory(c) {
  const upto = c.status === 'closed' ? c.stage : c.stage - 1;
  const out = [];
  for (let no = 1; no <= upto; no++) {
    const span = Math.max(c.stage - 1, 1);
    const offset = Math.round((c.days * (no - 1)) / span);
    out.push({
      stage: no,
      at: isoAgo(Math.max(0, c.days - offset)),
      by: stageDef(no).owner,
      note: stageEventNote(no, c),
    });
  }
  return out;
}

function stageEventNote(no, c) {
  switch (no) {
    case 1: return `Overdue flagged in the ${c.loanType} portfolio; ageing and exposure classified.`;
    case 2: return `Case file created for ${c.loanNo} with KYC and loan documents.`;
    case 3: return `Assigned to ${c.officer} based on branch and exposure.`;
    case 4: return `Initial contact made on the registered mobile number.`;
    case 5: return 'Telephone follow-up completed; borrower response recorded.';
    case 6: return 'Personal visit to the borrower\'s address completed.';
    case 7: return 'Demand notice drafted with outstanding and deadline.';
    case 8: return 'Demand notice dispatched by registered post.';
    case 9: return 'Delivery confirmation received and placed on file.';
    case 10: return 'Borrower response recorded; no acceptable payment plan offered.';
    case 11: return 'Negotiation held; payment commitment recorded.';
    case 12: return 'Legal review completed; case escalated to the legal cell.';
    case 13: return 'Legal approval granted by the competent authority.';
    case 14: return 'Legal notice issued to the borrower and guarantor.';
    case 15: return 'Petition filed before the appropriate authority.';
    case 16: return 'Case registered and case number recorded.';
    case 17: return 'Summons served; procedural steps completed.';
    case 18: return 'Hearing scheduled; advocate briefed with the case file.';
    case 19: return 'Hearing completed; directions recorded in the case file.';
    case 20: return 'Order / award received and reviewed by the legal cell.';
    case 21: return 'Execution petition filed for enforcement of the award.';
    case 22: return 'Amount realized through the legal process and credited.';
    case 23: return 'Part payment received and outstanding updated.';
    case 24: return 'Settlement proposal prepared with waiver working.';
    case 25: return 'Settlement approved by the recovery committee.';
    case 26: return 'Settlement payment received as per the approved schedule.';
    case 27: return 'Full recovery confirmed; nil-dues working prepared.';
    case 28: return 'Case closed and no-dues certificate issued.';
    default: return `Stage ${no} completed.`;
  }
}

function caseDocs(c) {
  const docs = [
    { name: 'Loan sanction letter', type: 'Loan document', date: isoAgo(c.days + 120) },
    { name: 'KYC and borrower profile', type: 'KYC', date: isoAgo(c.days + 120) },
    { name: 'Recovery case sheet', type: `Case ${c.id}`, date: isoAgo(c.days) },
  ];
  if (c.stage >= 7) docs.push({ name: `Demand notice DN/2026/${String(c.id.slice(-3))}`, type: 'Demand notice', date: isoAgo(Math.max(1, Math.round(c.days * 0.55))) });
  if (c.stage >= 14) docs.push({ name: `Legal notice LN/2026/${String(c.id.slice(-3))}`, type: 'Legal notice', date: isoAgo(Math.max(1, Math.round(c.days * 0.4))) });
  if (c.stage >= 16) docs.push({ name: 'Court filing acknowledgement', type: 'Legal filing', date: isoAgo(Math.max(1, Math.round(c.days * 0.3))) });
  if (c.stage >= 20) docs.push({ name: 'Certified order / award', type: 'Order', date: isoAgo(Math.max(1, Math.round(c.days * 0.2))) });
  if (c.stage >= 24) docs.push({ name: 'Settlement proposal and waiver working', type: 'Settlement', date: isoAgo(Math.max(1, Math.round(c.days * 0.12))) });
  if (c.status === 'closed') docs.push({ name: 'Case closure and no-dues certificate', type: 'Closure', date: c.closedAt });
  return docs;
}

export const CASES = BASE_CASES.map((base) => {
  const c = {
    ...base,
    overdueSince: isoAgo(base.days),
    nextDue: isoIn(base.nextDueIn),
    recovered: 0,
  };
  c.history = caseHistory(c);
  c.docs = caseDocs(c);
  c.lastActivity = c.history.length ? c.history[c.history.length - 1].at : c.overdueSince;
  return c;
});

// ---------- payments ----------
export const PAYMENTS = [
  { id: 'PY-2026-0941', caseId: 'RC-2026-0142', amount: 25000, date: isoAgo(4), mode: 'UPI', ref: 'UPI/4471882', by: 'S. Kulkarni' },
  { id: 'PY-2026-0938', caseId: 'RC-2026-0131', amount: 12000, date: isoAgo(8), mode: 'Cash', ref: 'BR/Shirur/118', by: 'P. Gaikwad' },
  { id: 'PY-2026-0927', caseId: 'RC-2026-0127', amount: 150000, date: isoAgo(20), mode: 'NEFT', ref: 'UTR 4471 9002 118', by: 'A. Pathak' },
  { id: 'PY-2026-0918', caseId: 'RC-2026-0124', amount: 200000, date: isoAgo(41), mode: 'NEFT', ref: 'UTR 3390 7726 004', by: 'S. Kulkarni' },
  { id: 'PY-2026-0902', caseId: 'RC-2026-0119', amount: 402000, date: isoAgo(64), mode: 'Gold auction', ref: 'AUC/2026/07', by: 'P. Gaikwad' },
  { id: 'PY-2026-0888', caseId: 'RC-2026-0102', amount: 290000, date: isoAgo(76), mode: 'Gold auction', ref: 'AUC/2026/04', by: 'P. Gaikwad' },
].map((p) => ({ ...p, case: CASES.find((c) => c.id === p.caseId) }));

for (const p of PAYMENTS) if (p.case) p.case.recovered = (p.case.recovered || 0) + p.amount;

// ---------- notices ----------
export const NOTICES = [
  { id: 'DN/2026/088', caseId: 'RC-2026-0142', type: 'demand', issuedAt: isoAgo(38), status: 'delivered', mode: 'Registered post', ref: 'RP-4471 8820 IN', dueAt: isoAgo(24), response: 'No response' },
  { id: 'LN/2026/031', caseId: 'RC-2026-0141', type: 'legal', issuedAt: isoAgo(95), status: 'delivered', mode: 'Registered post', ref: 'RP-3310 7741 IN', dueAt: isoAgo(80), response: 'Reply received' },
  { id: 'DN/2026/079', caseId: 'RC-2026-0138', type: 'demand', issuedAt: isoAgo(62), status: 'delivered', mode: 'Speed post', ref: 'SP-1182 4410 IN', dueAt: isoAgo(47), response: 'Disputed' },
  { id: 'DN/2026/074', caseId: 'RC-2026-0135', type: 'demand', issuedAt: isoAgo(21), status: 'dispatched', mode: 'Registered post', ref: 'RP-8820 1194 IN', dueAt: isoIn(6), response: '' },
  { id: 'LN/2026/026', caseId: 'RC-2026-0111', type: 'legal', issuedAt: isoAgo(54), status: 'responded', mode: 'Registered post', ref: 'RP-2290 6631 IN', dueAt: isoAgo(39), response: 'Objection filed' },
  { id: 'SM/2026/012', caseId: 'RC-2026-0141', type: 'summons', issuedAt: isoAgo(30), status: 'delivered', mode: 'Court service', ref: 'Case CJ/2026/441', dueAt: isoIn(11), response: 'Appearance entered' },
  { id: 'DN/2026/091', caseId: 'RC-2026-0127', type: 'demand', issuedAt: isoAgo(9), status: 'draft', mode: 'Registered post', ref: '', dueAt: isoIn(12), response: '' },
  { id: 'LN/2026/034', caseId: 'RC-2026-0124', type: 'legal', issuedAt: isoAgo(6), status: 'dispatched', mode: 'Email + registered post', ref: 'RP-5510 2208 IN', dueAt: isoIn(9), response: '' },
];

// ---------- settlement proposals ----------
export const PROPOSALS = [
  {
    id: 'ST/2026/014', caseId: 'RC-2026-0124', proposed: 1420000, installments: 6,
    firstDue: isoIn(15), status: 'pending_approval', by: 'S. Kulkarni', requestedAt: isoAgo(6),
    remarks: 'One-time settlement at 76% of dues; family has agreed to a six-month schedule.',
  },
  {
    id: 'ST/2026/012', caseId: 'RC-2026-0127', proposed: 430000, installments: 3,
    firstDue: isoIn(9), status: 'approved', by: 'A. Pathak', requestedAt: isoAgo(18),
    remarks: 'Settlement approved after part realization from the award.',
  },
  {
    id: 'ST/2026/011', caseId: 'RC-2026-0119', proposed: 402000, installments: 1,
    firstDue: isoAgo(60), status: 'paid', by: 'P. Gaikwad', requestedAt: isoAgo(70),
    remarks: 'Full and final settlement through gold auction proceeds.',
  },
  {
    id: 'ST/2026/009', caseId: 'RC-2026-0141', proposed: 900000, installments: 12,
    firstDue: isoIn(20), status: 'rejected', by: 'A. Pathak', requestedAt: isoAgo(26),
    remarks: 'Rejected: waiver exceeds the delegated authority limit.',
  },
  {
    id: 'ST/2026/015', caseId: 'RC-2026-0138', proposed: 700000, installments: 4,
    firstDue: isoIn(18), status: 'pending_approval', by: 'S. Kulkarni', requestedAt: isoAgo(2),
    remarks: 'Borrower proposes 80% of dues; legal opinion pending on the interest dispute.',
  },
];

// ---------- derived helpers ----------
export const caseById = (id) => CASES.find((c) => c.id === id);
export const activeCases = () => CASES.filter((c) => c.status === 'active');
export const legalCases = () => CASES.filter((c) => c.stage >= 13 && c.stage <= 22 && c.status === 'active');
export const totalOutstanding = (list = activeCases()) => list.reduce((s, c) => s + c.outstanding, 0);
export const totalOverdue = (list = activeCases()) => list.reduce((s, c) => s + c.overdue, 0);
export const overdueDays = (c) => (c.status === 'closed' ? c.days : daysBetween(c.overdueSince));
export const proposalDues = (p) => {
  const c = caseById(p.caseId);
  return c ? c.outstanding : p.proposed;
};
export const waiverOf = (p) => Math.max(0, proposalDues(p) - p.proposed);
export const waiverPct = (p) => {
  const dues = proposalDues(p);
  return dues ? (waiverOf(p) / dues) * 100 : 0;
};

export const NOTICE_TYPE_LABELS = {
  demand: 'Demand notice', legal: 'Legal notice', summons: 'Court summons',
};
export const NOTICE_STATUS_LABELS = {
  draft: 'Draft', dispatched: 'Dispatched', delivered: 'Delivered', responded: 'Responded',
};
export const PROP_STATUS_LABELS = {
  pending_approval: 'Pending approval', approved: 'Approved', rejected: 'Rejected', paid: 'Paid',
};

/** Combined activity feed from case history, payments and notices. */
export function activityFeed(limit = 12) {
  const items = [];
  for (const c of CASES) {
    for (const h of c.history.slice(-3)) {
      items.push({
        at: h.at, kind: 'stage', title: `${c.borrower} - ${stageDef(h.stage).title}`,
        body: `${c.id} · ${h.by}`, caseId: c.id,
      });
    }
  }
  for (const p of PAYMENTS) {
    items.push({
      at: p.date, kind: 'payment', title: `Payment received from ${p.case ? p.case.borrower : p.caseId}`,
      body: `${inr(p.amount)} · ${p.mode} · ${p.caseId}`, caseId: p.caseId,
    });
  }
  for (const n of NOTICES) {
    if (n.status === 'draft') continue;
    items.push({
      at: n.issuedAt, kind: 'notice', title: `${NOTICE_TYPE_LABELS[n.type]} ${n.status}`,
      body: `${n.id} · ${caseById(n.caseId)?.borrower || n.caseId}`, caseId: n.caseId,
    });
  }
  items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return items.slice(0, limit);
}

// ---------- in-memory mutations (demo only) ----------
export function addCase(input) {
  const seq = CASES.reduce((max, c) => Math.max(max, Number(String(c.id).split('-').pop()) || 0), 0) + 1;
  const overdueSince = input.overdueSince || isoAgo(1);
  const c = {
    id: `RC-2026-${String(seq).padStart(4, '0')}`,
    borrower: input.borrower,
    memberNo: input.memberNo || '-',
    phone: input.phone || '',
    village: input.village || '',
    branch: input.branch,
    loanType: input.loanType,
    loanNo: input.loanNo || '-',
    sanctioned: Number(input.sanctioned) || 0,
    outstanding: Number(input.outstanding) || 0,
    overdue: Number(input.overdue) || 0,
    days: Math.max(0, daysBetween(overdueSince)),
    stage: 1,
    risk: 'medium',
    officer: input.officer || OFFICERS[0],
    nextAction: 'Confirm overdue classification',
    nextDueIn: 2,
    nextDue: isoIn(2),
    status: 'active',
    note: input.note || '',
    overdueSince,
    recovered: 0,
    history: [],
    docs: caseDocs({ days: 0, stage: 1, id: 'new' }),
    lastActivity: overdueSince,
  };
  CASES.unshift(c);
  return c;
}

export function completeStage(c, { note, nextDueIn = 3 } = {}) {
  if (!c) return;
  const current = c.stage;
  c.history = c.history || [];
  c.history.push({
    stage: current,
    at: todayISO(),
    by: 'Recovery manager',
    note: note || `${stageDef(current).title} completed.`,
  });
  c.lastActivity = todayISO();
  if (current >= 28) {
    c.status = 'closed';
    c.closedAt = todayISO();
    c.nextAction = 'Case closed';
    c.docs = caseDocs(c);
  } else {
    c.stage = current + 1;
    c.nextAction = stageDef(c.stage).title;
  }
  c.nextDue = isoIn(nextDueIn);
  c.docs = caseDocs(c);
  return c;
}

export function recordPayment(c, { amount, mode = 'NEFT', ref = '', date = todayISO() } = {}) {
  if (!c) return null;
  const value = Math.max(0, Number(amount) || 0);
  c.recovered = (c.recovered || 0) + value;
  c.outstanding = Math.max(0, c.outstanding - value);
  c.overdue = Math.max(0, c.overdue - value);
  const payment = {
    id: `PY-2026-${String(PAYMENTS.length + 941).padStart(4, '0')}`,
    caseId: c.id, amount: value, date, mode, ref: ref || '-', by: 'Recovery manager', case: c,
  };
  PAYMENTS.unshift(payment);
  c.lastActivity = date;
  c.history = c.history || [];
  c.history.push({ stage: c.stage, at: date, by: 'Recovery manager', note: `Payment of ${inr(value)} received (${mode}${ref ? `, ${ref}` : ''}).` });
  if (c.outstanding === 0 && c.stage < 27) {
    c.stage = 27;
    c.nextAction = 'Confirm full recovery and close';
  }
  return payment;
}

export function addNotice({ caseId, type, issuedAt = todayISO(), dueAt, mode = 'Registered post', ref = '', body = '' }) {
  const prefix = type === 'legal' ? 'LN' : type === 'summons' ? 'SM' : 'DN';
  const year = new Date().getFullYear();
  const next = NOTICES
    .filter((n) => n.type === type)
    .reduce((max, n) => Math.max(max, Number(String(n.id).split('/').pop()) || 0), 0) + 1;
  const notice = {
    id: `${prefix}/${year}/${String(next).padStart(3, '0')}`,
    caseId, type, issuedAt, status: 'draft', mode, ref,
    dueAt: dueAt || isoIn(15), response: '', body,
  };
  NOTICES.unshift(notice);
  return notice;
}

export function setNoticeStatus(notice, status) {
  if (!notice) return;
  notice.status = status;
  if (status === 'dispatched' && !notice.ref) notice.ref = `RP-${Math.floor(1000 + Math.random() * 8999)} ${Math.floor(1000 + Math.random() * 8999)} IN`;
}

export function addProposal({ caseId, proposed, installments, firstDue, remarks = '' }) {
  const year = new Date().getFullYear();
  const next = PROPOSALS.reduce((max, p) => Math.max(max, Number(String(p.id).split('/').pop()) || 0), 0) + 1;
  const proposal = {
    id: `ST/${year}/${String(next).padStart(3, '0')}`,
    caseId,
    proposed: Number(proposed) || 0,
    installments: Math.max(1, Number(installments) || 1),
    firstDue: firstDue || isoIn(15),
    status: 'pending_approval',
    by: 'Recovery manager',
    requestedAt: todayISO(),
    remarks,
  };
  PROPOSALS.unshift(proposal);
  return proposal;
}

export function setProposalStatus(proposal, status) {
  if (proposal) proposal.status = status;
}
