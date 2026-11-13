// Recovery case workspace: 28-stage interactive workflow, payments and documents.
import { $, toast, openDialog, closeDialog, showError } from '../ui.js';
import {
  GROUPS, caseById, completeStage, daysBetween, fmtDate, fmtDateShort, groupOfStage,
  inr, isoIn, overdueDays, recordPayment, stageDef, todayISO,
} from '../recovery/data.js';
import { clear, el, icon } from '../recovery/dom.js';
import { openNoticeForm } from './recovery-notices.js';

let currentId = null;
let modalStageNo = 0;

function addChip(box, text, value) {
  const c = el('span', { class: 'chip' }, text);
  c.dataset.value = value;
  box.appendChild(c);
}

function stageStatus(c, no) {
  if (c.status === 'closed') return 'done';
  if (no < c.stage) return 'done';
  if (no === c.stage) return 'current';
  return 'upcoming';
}

function historyFor(c, no) {
  return (c.history || []).filter((h) => h.stage === no).slice(-1)[0] || null;
}

function renderHeader(c) {
  $('rec-case-kicker').textContent = `${c.id} · ${c.branch} branch`;
  $('rec-case-title').textContent = c.borrower;
  $('rec-case-sub').textContent = [c.memberNo, c.phone, c.village].filter(Boolean).join(' · ');

  const chips = $('rec-case-chips');
  clear(chips);
  addChip(chips, c.status === 'closed' ? 'Case closed' : 'Active', c.status);
  addChip(chips, groupOfStage(c.stage).label, groupOfStage(c.stage).key);
  addChip(chips, `${c.risk} risk`, c.risk);
  addChip(chips, `${overdueDays(c)} days overdue`, overdueDays(c) > 180 ? 'critical' : 'warn');

  const completed = c.status === 'closed' ? 28 : c.stage - 1;
  const pct = Math.round((completed / 28) * 100);
  $('rec-case-progress').textContent = `${completed} of 28 stages complete · ${pct}%`;
  const barEl = $('rec-case-progress-bar');
  if (barEl) barEl.style.width = `${pct}%`;
  const groupChip = $('rec-case-group-chip');
  if (groupChip) {
    groupChip.textContent = `Stage ${c.stage} of 28`;
    groupChip.dataset.value = groupOfStage(c.stage).key;
  }
  document.title = `${c.borrower} - Recovery - Track_karo`;
  const pageTitle = $('page-title');
  if (pageTitle) pageTitle.textContent = `Case ${c.id}`;
}

function kv(box, label, value, options = {}) {
  box.appendChild(el('div', { class: 'kv-row' },
    el('dt', {}, label),
    el('dd', { class: options.strong ? 'is-strong' : '' }, value)));
}

function renderSummary(c) {
  const box = $('rec-case-summary');
  clear(box);
  kv(box, 'Loan account', `${c.loanType} · ${c.loanNo}`, { strong: true });
  kv(box, 'Sanctioned limit', inr(c.sanctioned));
  kv(box, 'Outstanding', inr(c.outstanding), { strong: true });
  kv(box, 'Overdue amount', inr(c.overdue));
  kv(box, 'Overdue since', `${fmtDate(c.overdueSince)} (${overdueDays(c)} d)`);
  kv(box, 'Recovered to date', inr(c.recovered || 0));
  kv(box, 'Next due / action', `${fmtDateShort(c.nextDue)} · ${c.nextAction}`);
  if (c.hearingOn) kv(box, 'Next hearing', fmtDate(c.hearingOn));
  if (c.status === 'closed') kv(box, 'Closed on', fmtDate(c.closedAt));
  if (c.note) kv(box, 'Case note', c.note);

  const assignment = $('rec-case-assignment');
  clear(assignment);
  const owner = stageDef(c.stage).owner;
  kv(assignment, 'Recovery officer', c.officer, { strong: true });
  kv(assignment, 'Branch', c.branch);
  kv(assignment, 'Current stage owner', owner);
  kv(assignment, 'Stage SLA', `${stageDef(c.stage).sla} days`);
  kv(assignment, 'Evidence required', stageDef(c.stage).evidence);
}

function renderStepper(c) {
  const box = $('rec-stepper');
  if (!box) return;
  clear(box);
  for (const group of GROUPS) {
    const stages = [];
    for (let no = group.from; no <= group.to; no++) stages.push(no);
    const done = stages.filter((no) => stageStatus(c, no) === 'done').length;
    const section = el('section', { class: `stage-group is-${group.key}` });

    section.appendChild(el('header', { class: 'stage-group-head' },
      el('span', { class: `rec-group-dot is-${group.key}` }),
      el('h4', {}, group.label),
      el('span', { class: 'stage-group-count' }, `${done} / ${stages.length} complete`)));

    const list = el('ol', { class: 'stage-list' });
    for (const no of stages) {
      const s = stageDef(no);
      const status = stageStatus(c, no);
      const h = historyFor(c, no);
      const li = el('li', { class: `stage is-${status}` });

      let meta;
      if (status === 'done') meta = `Completed ${fmtDate(h?.at)} · ${h?.by || s.owner}`;
      else if (status === 'current') meta = `In progress · due ${fmtDateShort(c.nextDue)} · ${s.owner}`;
      else meta = `Pending · owner ${s.owner} · SLA ${s.sla} d`;

      const marker = el('span', { class: 'stage-marker' });
      marker.appendChild(status === 'done' ? icon('check') : document.createTextNode(String(no)));

      const btn = el('button', {
        type: 'button',
        class: 'stage-btn',
        'data-stage': String(no),
        'aria-label': `Stage ${no}: ${s.title}`,
      },
      marker,
      el('span', { class: 'stage-text' },
        el('strong', {}, `${no}. ${s.title}`),
        el('span', { class: 'stage-desc' }, s.description),
        el('span', { class: 'stage-meta' }, meta)),
      el('span', { class: 'stage-state' }, status === 'done' ? 'Done' : status === 'current' ? 'Current' : 'Upcoming'));

      li.appendChild(btn);
      list.appendChild(li);
    }
    section.appendChild(list);
    box.appendChild(section);
  }
}

function renderActivity(c) {
  const box = $('rec-case-activity');
  if (!box) return;
  clear(box);
  const events = (c.history || []).slice().reverse().slice(0, 12);
  if (!events.length) {
    box.appendChild(el('li', { class: 'rec-event is-empty' },
      el('span', { class: 'rec-event-dot' }, icon('clock')),
      el('div', { class: 'rec-event-body' }, el('strong', {}, 'No activity yet'),
        el('span', {}, 'Stage actions you record will appear here.'))));
    return;
  }
  for (const h of events) {
    box.appendChild(el('li', { class: 'rec-event' },
      el('span', { class: 'rec-event-dot' }, icon('check')),
      el('div', { class: 'rec-event-body' },
        el('strong', {}, `${h.stage}. ${stageDef(h.stage).title}`),
        el('span', {}, h.note),
        el('span', { class: 'rec-event-meta' }, `${h.by} · ${fmtDate(h.at)}`))));
  }
}

function renderDocs(c) {
  const box = $('rec-case-docs');
  if (!box) return;
  clear(box);
  for (const d of c.docs || []) {
    box.appendChild(el('li', { class: 'doc-item' },
      el('span', { class: 'doc-icon' }, icon('file')),
      el('span', { class: 'doc-main' },
        el('strong', {}, d.name),
        el('span', {}, `${d.type} · ${fmtDate(d.date)}`)),
      el('button', {
        type: 'button', class: 'btn btn-sm btn-link', 'data-action': 'doc',
        'data-doc': d.name,
      }, 'View')));
  }
}

function render() {
  const c = currentId ? caseById(currentId) : null;
  const body = $('rec-case-body');
  const empty = $('rec-case-empty');
  if (!c) {
    if (body) body.hidden = true;
    if (empty) empty.hidden = false;
    return;
  }
  if (body) body.hidden = false;
  if (empty) empty.hidden = true;
  renderHeader(c);
  renderSummary(c);
  renderStepper(c);
  renderActivity(c);
  renderDocs(c);
}

export function openCase(id) {
  if (!caseById(id)) return;
  currentId = id;
  if (location.hash === '#recovery-case') render();
  else location.hash = '#recovery-case';
}

function openStageModal(no) {
  const c = caseById(currentId);
  if (!c) return;
  modalStageNo = no;
  const s = stageDef(no);
  const status = stageStatus(c, no);
  $('rec-stage-title').textContent = `Stage ${no} · ${s.title}`;
  $('rec-stage-desc').textContent = s.description;
  $('rec-stage-meta').textContent = `${groupOfStage(no).label} · owner ${s.owner} · SLA ${s.sla} days · evidence: ${s.evidence}`;
  const form = $('form-rec-stage');
  form.reset();
  showError($('rec-stage-error'), '');
  $('rec-stage-next').value = isoIn(3);
  $('rec-stage-note').value = '';

  const done = historyFor(c, no);
  const statusLine = $('rec-stage-status');
  if (status === 'done') {
    statusLine.hidden = false;
    statusLine.textContent = done
      ? `Completed on ${fmtDate(done.at)} by ${done.by}. ${done.note}`
      : 'This stage is already complete.';
  } else if (status === 'upcoming') {
    statusLine.hidden = false;
    statusLine.textContent = `This stage is not active yet. Complete stage ${c.stage} first.`;
  } else {
    statusLine.hidden = true;
  }

  const btn = $('btn-rec-complete-stage');
  btn.disabled = status !== 'current';
  btn.textContent = c.status === 'closed' ? 'Case is closed' : status === 'current' ? 'Complete stage & continue' : 'Stage not active';
  openDialog($('modal-rec-stage'));
  if (status === 'current') setTimeout(() => $('rec-stage-note').focus(), 50);
}

function submitStage(e) {
  e.preventDefault();
  const c = caseById(currentId);
  if (!c) return;
  if (c.stage !== modalStageNo || c.status === 'closed') return;
  const note = $('rec-stage-note').value.trim()
    || `${stageDef(modalStageNo).title} completed with outcome: ${$('rec-stage-outcome').value}.`;
  const next = $('rec-stage-next').value;
  const nextDueIn = next ? Math.max(0, daysBetween(todayISO(), next)) : 3;
  completeStage(c, { note, nextDueIn });
  closeDialog($('modal-rec-stage'));
  render();
  if (c.status === 'closed') toast('Case closed', `${c.id} · ${c.borrower}`, 'success');
  else toast(`Stage ${modalStageNo} complete`, `Moved to stage ${c.stage}: ${stageDef(c.stage).title}`, 'success');
}

function openPaymentModal() {
  const c = caseById(currentId);
  if (!c) return;
  $('form-rec-payment').reset();
  showError($('rec-payment-error'), '');
  $('rec-pay-amount').value = String(Math.min(c.overdue || c.outstanding, c.outstanding) || '');
  $('rec-pay-date').value = todayISO();
  $('rec-pay-outstanding').textContent = inr(c.outstanding);
  openDialog($('modal-rec-payment'));
  $('rec-pay-amount').focus();
}

function submitPayment(e) {
  e.preventDefault();
  const c = caseById(currentId);
  if (!c) return;
  const err = $('rec-payment-error');
  showError(err, '');
  const amount = Number($('rec-pay-amount').value);
  if (!(amount > 0)) { showError(err, 'Enter a payment amount greater than zero.'); return; }
  if (amount > c.outstanding) { showError(err, 'Payment cannot exceed the outstanding balance.'); return; }
  recordPayment(c, {
    amount,
    mode: $('rec-pay-mode').value,
    ref: $('rec-pay-ref').value.trim(),
    date: $('rec-pay-date').value || todayISO(),
  });
  closeDialog($('modal-rec-payment'));
  render();
  toast('Payment recorded', `${inr(amount)} · ${c.borrower}`, 'success');
}

function init() {
  $('rec-stepper')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-stage]');
    if (btn) openStageModal(Number(btn.dataset.stage));
  });
  $('form-rec-stage')?.addEventListener('submit', submitStage);
  $('btn-rec-payment')?.addEventListener('click', openPaymentModal);
  $('form-rec-payment')?.addEventListener('submit', submitPayment);
  $('btn-rec-draft-notice')?.addEventListener('click', () => openNoticeForm(currentId));
  $('rec-case-docs')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="doc"]');
    if (btn) toast('Document preview', `${btn.dataset.doc} - preview is not wired in this UI-only demo.`);
  });
}

export default {
  init,
  show: render,
};
