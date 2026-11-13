// HR payroll: monthly run, totals, payslip preview and history.
import {
  $, cloneTpl, fill, setEmpty, toast, toastError, withLoading, confirmDialog,
  openDialog, closeDialog, downloadCsv,
} from '../../ui.js';
import {
  employees, employee, payrollTotals, payslip, processPayroll, markPayrollPaid,
  payrollRuns, payrollRun, branches, departments, departmentName, branchName, typeName,
} from '../store.js';
import { monthKey, monthLabel } from '../seed.js';
import { hrScope, personCell, fillBranches, money, moneyShort, barRow, lockScope } from '../ui.js';

const selMonth = () => $('hr-pay-month')?.value || monthKey(new Date());
const branchFilter = () => $('hr-pay-branch')?.value || hrScope() || '';

const runStatus = (status) => ({ draft: 'Draft', processed: 'Processed', paid: 'Paid' }[status] || status);

function renderStats() {
  const totals = payrollTotals(selMonth(), branchFilter());
  const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  set('hr-pay-stat-employees', totals.employees);
  set('hr-pay-stat-gross', `₹${moneyShort(totals.gross)}`);
  set('hr-pay-stat-deductions', `₹${moneyShort(totals.deductions)}`);
  set('hr-pay-stat-net', `₹${moneyShort(totals.net)}`);

  const banner = $('hr-pay-run-status');
  if (banner) {
    banner.textContent = '';
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.dataset.value = totals.run.status;
    chip.textContent = runStatus(totals.run.status);
    const text = document.createElement('span');
    text.textContent = totals.run.status === 'draft'
      ? 'Draft for this month. Processing locks the numbers.'
      : totals.run.status === 'processed'
        ? `Processed${totals.run.processed_at ? ` on ${new Date(totals.run.processed_at).toLocaleDateString('en-IN')}` : ''} - not paid yet.`
        : `Paid${totals.run.paid_at ? ` on ${new Date(totals.run.paid_at).toLocaleDateString('en-IN')}` : ''}.`;
    banner.append(chip, text);
  }
  const processBtn = $('btn-hr-process-payroll');
  const paidBtn = $('btn-hr-mark-paid');
  if (processBtn) processBtn.disabled = totals.run.status !== 'draft';
  if (paidBtn) paidBtn.disabled = totals.run.status === 'paid';
}

function renderTable() {
  const tbody = $('hr-pay-table');
  if (!tbody) return;
  const month = selMonth();
  const list = employees({ branch_id: branchFilter() }).filter((e) => e.status !== 'inactive');
  tbody.textContent = '';
  for (const emp of list) {
    const slip = payslip(month, emp.id);
    if (!slip) continue;
    const tr = cloneTpl('tpl-hr-pay-row');
    tr.dataset.empId = emp.id;
    const person = tr.querySelector('[data-field="person"]');
    if (person) person.appendChild(personCell(emp));
    fill(tr, {
      days: slip.days_paid,
      lop: slip.lop_days || '-',
      gross: money(slip.gross),
      deductions: money(slip.total_deductions),
      net: money(slip.net),
      status: { text: runStatus(slip.status), value: slip.status },
    });
    tbody.appendChild(tr);
  }
  setEmpty('hr-pay', list.length === 0);
}

function renderDepartmentCost() {
  const box = $('hr-pay-dept');
  if (!box) return;
  box.textContent = '';
  const month = selMonth();
  const list = employees({ branch_id: branchFilter() }).filter((e) => e.status !== 'inactive');
  const rows = departments().map((d) => ({
    name: d.name,
    total: list.filter((e) => e.department === d.key).reduce((n, e) => n + (payslip(month, e.id)?.net || 0), 0),
  })).filter((d) => d.total > 0).sort((a, b) => b.total - a.total);
  const max = Math.max(1, ...rows.map((r) => r.total));
  for (const r of rows) box.appendChild(barRow(r.name, r.total, max, { display: `₹${moneyShort(r.total)}` }));
}

function renderHistory() {
  const box = $('hr-pay-history');
  if (!box) return;
  box.textContent = '';
  const list = payrollRuns();
  for (const run of list) {
    const row = document.createElement('div');
    row.className = 'run-row';
    const month = document.createElement('strong');
    month.textContent = monthLabel(run.month);
    const totals = payrollTotals(run.month, branchFilter());
    const meta = document.createElement('span');
    meta.className = 'muted';
    meta.textContent = `${totals.employees} employees · net ₹${moneyShort(totals.net)}`;
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.dataset.value = run.status;
    chip.textContent = runStatus(run.status);
    const view = document.createElement('button');
    view.type = 'button';
    view.className = 'btn btn-sm btn-link';
    view.textContent = 'Open';
    view.dataset.runMonth = run.month;
    row.append(month, meta, chip, view);
    box.appendChild(row);
  }
}

function renderPayslip(month, empId) {
  const slip = payslip(month, empId);
  const box = $('hr-payslip-body');
  if (!slip || !box) return;
  const emp = slip.employee;
  const st = slip.structure;
  box.textContent = '';

  const sheet = document.createElement('div');
  sheet.className = 'payslip-sheet';

  const head = document.createElement('header');
  head.className = 'payslip-head';
  const brand = document.createElement('div');
  const company = document.createElement('h3');
  company.textContent = 'Track_karo';
  const tag = document.createElement('span');
  tag.className = 'muted';
  tag.textContent = 'SMART. SWIFT. SECURE. · Bengaluru, Karnataka';
  brand.append(company, tag);
  const period = document.createElement('div');
  period.className = 'payslip-period';
  const p1 = document.createElement('span');
  p1.textContent = 'Payslip for';
  const p2 = document.createElement('strong');
  p2.textContent = monthLabel(month);
  period.append(p1, p2);
  head.append(brand, period);
  sheet.appendChild(head);

  const grid = document.createElement('div');
  grid.className = 'payslip-grid';
  const left = document.createElement('div');
  left.className = 'payslip-block';
  left.innerHTML = '<h4>Employee details</h4>';
  const dl = document.createElement('dl');
  dl.className = 'detail-grid';
  const details = [
    ['Name', emp.name], ['Employee code', emp.emp_code], ['Designation', emp.designation],
    ['Department', departmentName(emp.department)], ['Branch', branchName(emp.branch_id)],
    ['Date of joining', emp.doj], ['Bank', `${emp.bank_name} XXXX${emp.bank_account_last4}`],
    ['PAN', emp.pan], ['UAN', emp.uan], ['PF no.', emp.pf_no],
  ];
  for (const [k, v] of details) {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = v || '-';
    dl.append(dt, dd);
  }
  left.appendChild(dl);

  const right = document.createElement('div');
  right.className = 'payslip-block';
  right.innerHTML = '<h4>Attendance</h4>';
  const dl2 = document.createElement('dl');
  dl2.className = 'detail-grid';
  const att = [
    ['Days in month', slip.days], ['Days paid', slip.days_paid], ['Present days', slip.present_days],
    ['Loss of pay', `${slip.lop_days} day(s)`], ['Payment mode', 'Bank transfer'],
    ['Payslip status', runStatus(slip.status)],
  ];
  for (const [k, v] of att) {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = v;
    dl2.append(dt, dd);
  }
  right.appendChild(dl2);
  grid.append(left, right);
  sheet.appendChild(grid);

  const tables = document.createElement('div');
  tables.className = 'payslip-tables';
  const mkTable = (title, rows, totalLabel, totalValue, tone) => {
    const block = document.createElement('div');
    block.className = 'payslip-block';
    const h = document.createElement('h4');
    h.textContent = title;
    const table = document.createElement('table');
    table.className = 'table table-sm';
    const tbody = document.createElement('tbody');
    for (const [k, v] of rows) {
      const tr = document.createElement('tr');
      const a = document.createElement('td'); a.textContent = k;
      const b = document.createElement('td'); b.className = 'num'; b.textContent = money(v);
      tr.append(a, b);
      tbody.appendChild(tr);
    }
    const total = document.createElement('tr');
    total.className = `payslip-total ${tone}`;
    const a = document.createElement('td'); a.textContent = totalLabel;
    const b = document.createElement('td'); b.className = 'num'; b.textContent = money(totalValue);
    total.append(a, b);
    tbody.appendChild(total);
    table.appendChild(tbody);
    block.append(h, table);
    return block;
  };
  tables.append(
    mkTable('Earnings', [
      ['Basic', slip.earnings.basic], ['HRA', slip.earnings.hra], ['Conveyance', slip.earnings.conveyance],
      ['Special allowance', slip.earnings.special], ['Bonus', slip.earnings.bonus], ['Loss of pay', -slip.deductions_detail.lop],
    ], 'Gross earnings', slip.gross, 'is-earning'),
    mkTable('Deductions', [
      ['Employee PF', slip.deductions_detail.pf], ['ESI', slip.deductions_detail.esi],
      ['Professional tax', slip.deductions_detail.pt], ['TDS', slip.deductions_detail.tds],
    ], 'Total deductions', slip.total_deductions, 'is-deduction'),
  );
  sheet.appendChild(tables);

  const net = document.createElement('div');
  net.className = 'payslip-net';
  const label = document.createElement('span');
  label.textContent = 'Net pay';
  const value = document.createElement('strong');
  value.textContent = money(slip.net);
  net.append(label, value);
  sheet.appendChild(net);

  const foot = document.createElement('p');
  foot.className = 'payslip-foot';
  foot.textContent = 'This is a system generated payslip for demo purposes. Employer PF and ESI contributions are deposited separately.';
  sheet.appendChild(foot);

  box.appendChild(sheet);
  const title = $('hr-payslip-title');
  if (title) title.textContent = `${emp.name} · ${monthLabel(month)}`;
  openDialog($('modal-hr-payslip'));
}

async function processRun() {
  const month = selMonth();
  const ok = await confirmDialog({
    title: 'Process payroll?',
    message: `This locks the ${monthLabel(month)} run for the selected employees. Payslips become read-only until you reset the demo data.`,
    okText: 'Process payroll',
  });
  if (!ok) return;
  try {
    processPayroll(month);
    toast('Payroll processed', monthLabel(month), 'success');
    renderAll();
  } catch (err) {
    toastError(err, 'Could not process payroll');
  }
}

async function markPaid() {
  const month = selMonth();
  const ok = await confirmDialog({
    title: 'Mark payroll paid?',
    message: `Bank transfer for ${monthLabel(month)} will be recorded as complete.`,
    okText: 'Mark paid',
  });
  if (!ok) return;
  try {
    markPayrollPaid(month);
    toast('Payroll marked paid', monthLabel(month), 'success');
    renderAll();
  } catch (err) {
    toastError(err, 'Could not update payroll');
  }
}

function exportCsv() {
  const month = selMonth();
  const list = employees({ branch_id: branchFilter() }).filter((e) => e.status !== 'inactive');
  const rows = list.map((emp) => {
    const slip = payslip(month, emp.id);
    return [emp.emp_code, emp.name, departmentName(emp.department), slip.days_paid, slip.lop_days, slip.gross, slip.total_deductions, slip.net, runStatus(slip.status)];
  });
  downloadCsv(`payroll-${month}.csv`, [['Code', 'Name', 'Department', 'Days paid', 'LOP', 'Gross', 'Deductions', 'Net', 'Status'], ...rows]);
}

function renderAll() {
  renderStats();
  renderTable();
  renderDepartmentCost();
  renderHistory();
}

function init() {
  fillBranches($('hr-pay-branch'));
  lockScope($('hr-pay-branch'));
  const sel = $('hr-pay-month');
  if (sel) {
    const now = new Date();
    for (let i = 0; i < 13; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = monthKey(d);
      const o = document.createElement('option');
      o.value = value;
      o.textContent = monthLabel(value);
      sel.appendChild(o);
    }
    sel.value = monthKey(now);
  }
  $('hr-pay-month').addEventListener('change', renderAll);
  $('hr-pay-branch').addEventListener('change', renderAll);
  $('btn-hr-process-payroll').addEventListener('click', processRun);
  $('btn-hr-mark-paid').addEventListener('click', markPaid);
  $('btn-hr-pay-export').addEventListener('click', exportCsv);
  $('hr-pay-table').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="view"]');
    const tr = btn?.closest('tr[data-emp-id]');
    if (tr) renderPayslip(selMonth(), tr.dataset.empId);
  });
  $('hr-pay-history').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-run-month]');
    if (!btn) return;
    $('hr-pay-month').value = btn.dataset.runMonth;
    renderAll();
  });
  $('btn-hr-payslip-print').addEventListener('click', () => {
    document.body.classList.add('printing-payslip');
    window.print();
    setTimeout(() => document.body.classList.remove('printing-payslip'), 400);
  });
}

export default {
  init,
  show() {
    fillBranches($('hr-pay-branch'));
    lockScope($('hr-pay-branch'));
    renderAll();
  },
};
