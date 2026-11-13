// Recovery dashboard: portfolio KPIs, stage funnel, ageing, follow-ups and activity.
import { $ } from '../ui.js';
import {
  CASES, GROUPS, PAYMENTS, STAGES, activeCases, activityFeed, daysBetween, fmtDate,
  fmtDateShort, groupOfStage, inr, inrCompact, legalCases, overdueDays, stageDef,
  todayISO, totalOutstanding, totalOverdue,
} from '../recovery/data.js';
import { bar, clear, el, icon } from '../recovery/dom.js';
import { openCase } from './recovery-case.js';

const setText = (id, value) => {
  const node = $(id);
  if (node) node.textContent = value;
};

function dueLabel(iso) {
  if (!iso) return { text: '-', overdue: false };
  const overdue = iso < todayISO();
  if (iso === todayISO()) return { text: 'Due today', overdue: true };
  if (overdue) return { text: `${daysBetween(iso, todayISO())} d overdue`, overdue: true };
  return { text: `Due ${fmtDateShort(iso)}`, overdue: false };
}

function renderStats() {
  const active = activeCases();
  const month = todayISO().slice(0, 7);
  const recovered = PAYMENTS
    .filter((p) => (p.date || '').slice(0, 7) === month)
    .reduce((sum, p) => sum + p.amount, 0);
  setText('rec-stat-outstanding', inrCompact(totalOutstanding(active)));
  setText('rec-stat-active', String(active.length));
  setText('rec-stat-overdue', inrCompact(totalOverdue(active)));
  setText('rec-stat-legal', String(legalCases().length));
  setText('rec-stat-recovered', inrCompact(recovered));
  setText('rec-stat-closed', String(CASES.filter((c) => c.status === 'closed').length));
}

function renderFunnel() {
  const box = $('rec-funnel');
  if (!box) return;
  clear(box);
  const active = activeCases();
  const rows = GROUPS.map((g) => {
    const list = active.filter((c) => c.stage >= g.from && c.stage <= g.to);
    return { ...g, count: list.length, amount: totalOutstanding(list) };
  });
  const max = Math.max(...rows.map((r) => r.count), 1);
  for (const row of rows) {
    box.appendChild(el('div', { class: `rec-funnel-row is-${row.key}` },
      el('div', { class: 'rec-funnel-head' },
        el('span', { class: 'rec-funnel-name' },
          el('span', { class: `rec-group-dot is-${row.key}` }), row.label),
        el('span', { class: 'rec-funnel-count' }, `${row.count} case${row.count === 1 ? '' : 's'}`)),
      bar(row.count, max),
      el('div', { class: 'rec-funnel-meta' },
        el('span', {}, inr(row.amount)),
        el('span', { class: 'muted' }, `stages ${row.from}-${row.to}`))));
  }
  const stageCounts = STAGES.map((s) => active.filter((c) => c.stage === s.no).length);
  const busiest = STAGES[stageCounts.indexOf(Math.max(...stageCounts))] || null;
  box.appendChild(el('p', { class: 'rec-note' },
    icon('info'),
    busiest ? `Busiest stage: ${busiest.no}. ${busiest.title} (${Math.max(...stageCounts)} case${Math.max(...stageCounts) === 1 ? '' : 's'}).` : 'No active cases.',
    ` ${active.length} of ${CASES.length} cases are active.`));
}

function renderAging() {
  const box = $('rec-aging');
  if (!box) return;
  clear(box);
  const buckets = [
    { label: '0-30 days', from: 0, to: 30 },
    { label: '31-60 days', from: 31, to: 60 },
    { label: '61-90 days', from: 61, to: 90 },
    { label: '91-180 days', from: 91, to: 180 },
    { label: '181-365 days', from: 181, to: 365 },
    { label: 'Above 365 days', from: 366, to: 99999 },
  ].map((b) => {
    const list = activeCases().filter((c) => {
      const d = overdueDays(c);
      return d >= b.from && d <= b.to;
    });
    return { ...b, count: list.length, amount: list.reduce((s, c) => s + c.overdue, 0) };
  });
  const max = Math.max(...buckets.map((b) => b.count), 1);
  for (const b of buckets) {
    box.appendChild(el('div', { class: 'rec-age-row' },
      el('div', { class: 'rec-age-head' },
        el('span', {}, b.label),
        el('span', { class: 'rec-age-amount' }, `${b.count} · ${inr(b.amount)}`)),
      bar(b.count, max)));
  }
  box.appendChild(el('p', { class: 'rec-note' },
    icon('alert'),
    `${activeCases().filter((c) => overdueDays(c) > 180).length} accounts are more than 180 days overdue and need escalation review.`));
}

function renderFollowups() {
  const box = $('rec-followups');
  if (!box) return;
  clear(box);
  const rows = activeCases()
    .slice()
    .sort((a, b) => (a.nextDue < b.nextDue ? -1 : a.nextDue > b.nextDue ? 1 : 0))
    .slice(0, 6);
  const empty = $('rec-followups-empty');
  if (empty) empty.hidden = rows.length > 0;
  for (const c of rows) {
    const due = dueLabel(c.nextDue);
    const group = groupOfStage(c.stage);
    const li = el('li', {
      class: 'list-item rec-followup',
      tabindex: '0',
      role: 'button',
      'aria-label': `Open case ${c.id}`,
    },
    el('span', { class: 'rec-followup-main' },
      el('strong', {}, c.borrower),
      el('span', { class: 'rec-followup-sub' }, `${c.nextAction} · ${c.id}`)),
    el('span', { class: 'rec-followup-side' },
      el('span', { class: `chip is-group-${group.key}` }, stageDef(c.stage).title),
      el('span', { class: `rec-due${due.overdue ? ' is-overdue' : ''}` }, due.text)));
    const go = () => openCase(c.id);
    li.addEventListener('click', go);
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
    });
    box.appendChild(li);
  }
}

function renderActivity() {
  const box = $('rec-activity');
  if (!box) return;
  clear(box);
  for (const item of activityFeed(8)) {
    const iconName = item.kind === 'payment' ? 'rupee' : item.kind === 'notice' ? 'notice' : 'check';
    box.appendChild(el('li', { class: `rec-event is-${item.kind}` },
      el('span', { class: 'rec-event-dot' }, icon(iconName)),
      el('div', { class: 'rec-event-body' },
        el('strong', {}, item.title),
        el('span', {}, item.body),
        el('time', { datetime: item.at }, fmtDate(item.at)))));
  }
}

function render() {
  renderStats();
  renderFunnel();
  renderAging();
  renderFollowups();
  renderActivity();
}

export default {
  init() { /* dashboard has no one-time wiring */ },
  show: render,
  refresh: render,
};
