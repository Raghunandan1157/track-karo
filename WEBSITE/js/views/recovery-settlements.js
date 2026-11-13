// Recovery settlements: one-time settlement calculator and approval queue.
import {
  $, cloneTpl, fill, setEmpty, chip, toast, confirmDialog, showError,
} from '../ui.js';
import {
  CASES, PROPOSALS, PROP_STATUS_LABELS, addProposal, caseById, fmtDateShort, inr,
  inrCompact, isoIn, proposalDues, setProposalStatus, waiverOf, waiverPct,
} from '../recovery/data.js';

function eligibleCases() {
  return CASES.filter((c) => c.status === 'active' && c.outstanding > 0);
}

function populateCases(force = false) {
  const sel = $('rec-settle-case');
  if (!sel) return;
  const previous = sel.value;
  if (sel.options.length && !force) return;
  sel.textContent = '';
  sel.appendChild(new Option('Select a case', ''));
  for (const c of eligibleCases()) {
    sel.appendChild(new Option(`${c.id} · ${c.borrower} (${c.branch})`, c.id));
  }
  if (previous && eligibleCases().some((c) => c.id === previous)) {
    sel.value = previous;
    return;
  }
  const preferred = eligibleCases().find((c) => c.stage >= 24) || eligibleCases()[0];
  if (preferred) sel.value = preferred.id;
}

function calc() {
  const c = caseById($('rec-settle-case')?.value || '');
  const base = c ? c.outstanding : 0;
  const interest = Math.max(0, Number($('rec-settle-interest')?.value) || 0);
  const charges = Math.max(0, Number($('rec-settle-charges')?.value) || 0);
  const dues = base + interest + charges;
  const proposed = Math.max(0, Number($('rec-settle-proposed')?.value) || 0);
  const installments = Math.max(1, Number($('rec-settle-installments')?.value) || 1);
  const waiver = Math.max(0, dues - proposed);
  const pct = dues ? (waiver / dues) * 100 : 0;

  const set = (id, value) => { const node = $(id); if (node) node.textContent = value; };
  set('rec-calc-dues', inr(dues));
  set('rec-calc-waiver', inr(waiver));
  set('rec-calc-waiver-pct', `${pct.toFixed(1)}%`);
  set('rec-calc-installment', proposed ? inr(Math.ceil(proposed / installments)) : inr(0));
  const outstandingInput = $('rec-settle-outstanding');
  if (outstandingInput) outstandingInput.value = c ? inr(c.outstanding) : '-';
  set('rec-calc-case-note', c ? `${c.borrower} · ${c.loanType} · ${c.branch} · ${c.stage >= 24 ? 'at settlement stage' : `currently stage ${c.stage}`}` : 'Select a case to see its dues.');

  const hint = $('rec-calc-hint');
  if (hint) {
    if (!c) hint.textContent = 'Select a case to calculate a settlement.';
    else if (proposed > dues) hint.textContent = 'Proposed amount is higher than the total dues.';
    else if (pct > 25) hint.textContent = 'Waiver above 25% needs committee approval beyond the manager limit.';
    else if (proposed <= 0) hint.textContent = 'Enter the proposed settlement amount.';
    else hint.textContent = `Waiver of ${pct.toFixed(1)}% is within the recovery manager's approval limit.`;
    hint.dataset.state = !c ? '' : proposed > dues ? 'error' : pct > 25 ? 'warn' : 'ok';
  }
}

function resetCalc() {
  $('rec-settle-interest').value = '0';
  $('rec-settle-charges').value = '0';
  $('rec-settle-installments').value = '6';
  $('rec-settle-first').value = isoIn(15);
  $('rec-settle-remarks').value = '';
  const c = caseById($('rec-settle-case')?.value || '');
  $('rec-settle-proposed').value = c ? String(Math.round((c.outstanding * 0.8) / 1000) * 1000) : '';
  showError($('rec-settle-error'), '');
  calc();
}

function createProposal(e) {
  e.preventDefault();
  const err = $('rec-settle-error');
  showError(err, '');
  const c = caseById($('rec-settle-case').value);
  if (!c) { showError(err, 'Select a case.'); return; }
  const interest = Math.max(0, Number($('rec-settle-interest').value) || 0);
  const charges = Math.max(0, Number($('rec-settle-charges').value) || 0);
  const dues = c.outstanding + interest + charges;
  const proposed = Number($('rec-settle-proposed').value);
  if (!(proposed > 0)) { showError(err, 'Enter the proposed settlement amount.'); return; }
  if (proposed > dues) { showError(err, 'Proposed amount cannot exceed the total dues.'); return; }
  const installments = Number($('rec-settle-installments').value);
  if (!(installments >= 1 && installments <= 36)) { showError(err, 'Installments must be between 1 and 36.'); return; }
  const p = addProposal({
    caseId: c.id,
    proposed,
    installments,
    firstDue: $('rec-settle-first').value || isoIn(15),
    remarks: $('rec-settle-remarks').value.trim(),
  });
  renderProposals();
  toast('Settlement proposal created', `${p.id} · ${c.borrower} · ${inr(proposed)}`, 'success');
  resetCalc();
}

function renderStats() {
  const pending = PROPOSALS.filter((p) => p.status === 'pending_approval');
  const approved = PROPOSALS.filter((p) => p.status === 'approved' || p.status === 'paid');
  const set = (id, value) => { const node = $(id); if (node) node.textContent = value; };
  set('rec-settle-stat-pending', String(pending.length));
  set('rec-settle-stat-proposed', inrCompact(pending.reduce((s, p) => s + p.proposed, 0)));
  set('rec-settle-stat-waiver', inrCompact(pending.reduce((s, p) => s + waiverOf(p), 0)));
  set('rec-settle-stat-approved', String(approved.length));
}

function renderProposals() {
  renderStats();
  const tbody = $('rec-proposals-table');
  if (!tbody) return;
  tbody.textContent = '';
  const order = { pending_approval: 0, approved: 1, paid: 2, rejected: 3 };
  const rows = PROPOSALS.slice().sort((a, b) => (order[a.status] - order[b.status]) || (a.id < b.id ? 1 : -1));
  for (const p of rows) {
    const c = caseById(p.caseId);
    const tr = cloneTpl('tpl-rec-proposal-row');
    tr.dataset.proposalId = p.id;
    fill(tr, {
      proposal_id: p.id,
      case_id: p.caseId,
      borrower: c?.borrower || '-',
      dues: inr(proposalDues(p)),
      proposed: inr(p.proposed),
      waiver: `${inr(waiverOf(p))} (${waiverPct(p).toFixed(1)}%)`,
      installments: String(p.installments),
      requested: `${p.by} · ${fmtDateShort(p.requestedAt)}`,
      status: chip(PROP_STATUS_LABELS[p.status] || p.status, p.status),
    });
    const approve = tr.querySelector('[data-action="approve"]');
    const reject = tr.querySelector('[data-action="reject"]');
    const pending = p.status === 'pending_approval';
    if (approve) approve.hidden = !pending;
    if (reject) reject.hidden = !pending;
    tbody.appendChild(tr);
  }
  setEmpty('rec-proposals', rows.length === 0);
  const count = $('rec-proposals-count');
  if (count) count.textContent = `${PROPOSALS.filter((p) => p.status === 'pending_approval').length} pending`;
}

async function decide(proposal, approve) {
  if (!proposal) return;
  if (!approve) {
    const ok = await confirmDialog({
      title: 'Reject settlement proposal?',
      message: `${proposal.id} for ${caseById(proposal.caseId)?.borrower || proposal.caseId} will be marked rejected.`,
      okText: 'Reject proposal',
    });
    if (!ok) return;
  }
  setProposalStatus(proposal, approve ? 'approved' : 'rejected');
  renderProposals();
  toast(approve ? 'Settlement approved' : 'Settlement rejected', `${proposal.id} · ${inr(proposal.proposed)}`, approve ? 'success' : 'info');
}

function init() {
  populateCases();
  resetCalc();
  $('rec-settle-case')?.addEventListener('change', resetCalc);
  for (const id of ['rec-settle-interest', 'rec-settle-charges', 'rec-settle-proposed', 'rec-settle-installments']) {
    $(id)?.addEventListener('input', calc);
  }
  $('form-rec-settlement')?.addEventListener('submit', createProposal);
  $('btn-rec-settle-reset')?.addEventListener('click', resetCalc);
  $('rec-proposals-table')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    const tr = btn?.closest('tr[data-proposal-id]');
    if (!tr) return;
    const proposal = PROPOSALS.find((p) => p.id === tr.dataset.proposalId);
    if (!proposal) return;
    if (btn.dataset.action === 'approve') decide(proposal, true);
    if (btn.dataset.action === 'reject') decide(proposal, false);
  });
}

export default {
  init,
  show() {
    populateCases(true);
    if (!$('rec-settle-proposed')?.value) resetCalc();
    else calc();
    renderProposals();
  },
};
