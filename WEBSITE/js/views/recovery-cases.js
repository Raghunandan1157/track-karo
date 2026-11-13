// Recovery cases: filter, search, paginate, export and create a new case.
import {
  $, cloneTpl, fill, setEmpty, chip, toast, openDialog, closeDialog,
  showError, downloadCsv, todayIST,
} from '../ui.js';
import {
  CASES, BRANCHES, OFFICERS, STAGES, GROUPS, addCase, fmtDateShort, groupOfStage,
  inr, isoAgo, overdueDays, stageDef,
} from '../recovery/data.js';
import { openCase } from './recovery-case.js';

const PAGE = 8;
let offset = 0;
let rows = [];

function filtered() {
  const q = ($('rec-cases-search')?.value || '').trim().toLowerCase();
  const group = $('rec-cases-group')?.value || '';
  const stage = Number($('rec-cases-stage')?.value || 0);
  const officer = $('rec-cases-officer')?.value || '';
  const aging = $('rec-cases-aging')?.value || '';

  return CASES.filter((c) => {
    if (q) {
      const hay = `${c.id} ${c.borrower} ${c.memberNo} ${c.loanNo} ${c.village} ${c.officer}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (group && groupOfStage(c.stage).key !== group) return false;
    if (stage && c.stage !== stage) return false;
    if (officer && c.officer !== officer) return false;
    if (aging) {
      const d = overdueDays(c);
      const [from, to] = aging.split('-').map(Number);
      if (to) { if (d < from || d > to) return false; }
      else if (d < from) return false;
    }
    return true;
  });
}

function render() {
  const tbody = $('rec-cases-table');
  if (!tbody) return;
  tbody.textContent = '';
  const page = rows.slice(offset, offset + PAGE);
  for (const c of page) {
    const tr = cloneTpl('tpl-rec-case-row');
    tr.dataset.caseId = c.id;
    const d = overdueDays(c);
    fill(tr, {
      case_id: c.id,
      borrower: c.borrower,
      branch: c.branch,
      loan_type: c.loanType,
      outstanding: inr(c.outstanding),
      overdue: inr(c.overdue),
      days: chip(`${d} d`, d > 365 ? 'critical' : d > 180 ? 'high' : d > 90 ? 'medium' : 'low'),
      stage: chip(`${c.stage}. ${stageDef(c.stage).title}`, groupOfStage(c.stage).key),
      officer: c.officer,
      next_action: c.nextAction,
      next_due: `Due ${fmtDateShort(c.nextDue)}`,
    });
    tbody.appendChild(tr);
  }
  setEmpty('rec-cases', rows.length === 0);
  const from = rows.length ? offset + 1 : 0;
  const to = Math.min(offset + PAGE, rows.length);
  const info = $('rec-cases-page-info');
  if (info) info.textContent = rows.length ? `${from}-${to} of ${rows.length}` : '0 cases';
  if ($('rec-cases-prev')) $('rec-cases-prev').disabled = offset === 0;
  if ($('rec-cases-next')) $('rec-cases-next').disabled = to >= rows.length;
  const count = $('rec-cases-count');
  if (count) count.textContent = `${rows.length} case${rows.length === 1 ? '' : 's'}`;
}

function applyFilters() {
  offset = 0;
  rows = filtered();
  render();
}

function exportCsv() {
  const list = filtered();
  const header = ['Case', 'Borrower', 'Member no', 'Branch', 'Loan type', 'Loan no', 'Outstanding', 'Overdue', 'Days overdue', 'Stage', 'Stage group', 'Officer', 'Next action', 'Next due', 'Status'];
  const body = list.map((c) => [
    c.id, c.borrower, c.memberNo, c.branch, c.loanType, c.loanNo,
    c.outstanding, c.overdue, overdueDays(c), c.stage, groupOfStage(c.stage).label,
    c.officer, c.nextAction, c.nextDue, c.status,
  ]);
  downloadCsv(`recovery-cases-${todayIST()}.csv`, [header, ...body]);
  toast('Export ready', `${list.length} cases exported.`, 'success');
}

function openNewCase() {
  $('form-rec-case').reset();
  showError($('rec-case-error'), '');
  const branch = $('rec-new-branch');
  const officer = $('rec-new-officer');
  if (branch && !branch.options.length) {
    branch.appendChild(new Option('Select branch', ''));
    for (const b of BRANCHES) branch.appendChild(new Option(b, b));
  }
  if (officer && !officer.options.length) {
    officer.appendChild(new Option('Select officer', ''));
    for (const o of OFFICERS) officer.appendChild(new Option(o, o));
  }
  $('rec-new-overdue-since').value = isoAgo(30);
  openDialog($('modal-rec-case'));
  $('rec-new-borrower').focus();
}

function saveNewCase(e) {
  e.preventDefault();
  const err = $('rec-case-error');
  showError(err, '');
  const input = {
    borrower: $('rec-new-borrower').value.trim(),
    memberNo: $('rec-new-member').value.trim(),
    phone: $('rec-new-phone').value.trim(),
    branch: $('rec-new-branch').value,
    village: $('rec-new-village').value.trim(),
    loanType: $('rec-new-loan-type').value.trim(),
    loanNo: $('rec-new-loan-no').value.trim(),
    sanctioned: $('rec-new-sanctioned').value,
    outstanding: $('rec-new-outstanding').value,
    overdue: $('rec-new-overdue').value,
    overdueSince: $('rec-new-overdue-since').value || isoAgo(30),
    officer: $('rec-new-officer').value,
    note: $('rec-new-note').value.trim(),
  };
  if (!input.borrower) { showError(err, 'Enter the borrower name.'); $('rec-new-borrower').focus(); return; }
  if (!input.branch) { showError(err, 'Select a branch.'); $('rec-new-branch').focus(); return; }
  if (!input.loanType) { showError(err, 'Enter the loan type.'); $('rec-new-loan-type').focus(); return; }
  if (!(Number(input.outstanding) > 0)) { showError(err, 'Enter a valid outstanding amount.'); $('rec-new-outstanding').focus(); return; }
  if (!(Number(input.overdue) > 0)) { showError(err, 'Enter a valid overdue amount.'); $('rec-new-overdue').focus(); return; }
  if (!input.officer) { showError(err, 'Select a recovery officer.'); $('rec-new-officer').focus(); return; }

  const c = addCase(input);
  closeDialog($('modal-rec-case'));
  toast('Recovery case created', `${c.id} · ${c.borrower}`, 'success');
  rows = filtered();
  offset = 0;
  render();
  openCase(c.id);
}

function init() {
  const group = $('rec-cases-group');
  if (group && !group.options.length) {
    group.appendChild(new Option('All stage groups', ''));
    for (const g of GROUPS) group.appendChild(new Option(g.label, g.key));
  }
  const stage = $('rec-cases-stage');
  if (stage && !stage.options.length) {
    stage.appendChild(new Option('All stages', ''));
    for (const g of GROUPS) {
      const og = document.createElement('optgroup');
      og.label = g.label;
      for (const s of STAGES.filter((s) => s.group === g.key)) {
        og.appendChild(new Option(`${s.no}. ${s.title}`, String(s.no)));
      }
      stage.appendChild(og);
    }
  }
  const officer = $('rec-cases-officer');
  if (officer && !officer.options.length) {
    officer.appendChild(new Option('All officers', ''));
    for (const o of OFFICERS) officer.appendChild(new Option(o, o));
  }

  $('rec-cases-search')?.addEventListener('input', applyFilters);
  $('rec-cases-group')?.addEventListener('change', applyFilters);
  $('rec-cases-stage')?.addEventListener('change', applyFilters);
  $('rec-cases-officer')?.addEventListener('change', applyFilters);
  $('rec-cases-aging')?.addEventListener('change', applyFilters);
  $('btn-rec-export-cases')?.addEventListener('click', exportCsv);
  $('btn-rec-new-case')?.addEventListener('click', openNewCase);
  $('form-rec-case')?.addEventListener('submit', saveNewCase);
  $('rec-cases-prev')?.addEventListener('click', () => { offset = Math.max(0, offset - PAGE); render(); });
  $('rec-cases-next')?.addEventListener('click', () => { offset = Math.min(offset + PAGE, Math.max(0, rows.length - 1)); render(); });
  $('rec-cases-table')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="open"]');
    if (!btn) return;
    const tr = btn.closest('tr[data-case-id]');
    if (tr) openCase(tr.dataset.caseId);
  });
  $('rec-cases-table')?.addEventListener('dblclick', (e) => {
    const tr = e.target.closest('tr[data-case-id]');
    if (tr) openCase(tr.dataset.caseId);
  });
}

export default {
  init,
  show() {
    rows = filtered();
    render();
  },
};
