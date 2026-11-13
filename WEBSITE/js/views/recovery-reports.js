// Recovery reports: stage groups, ageing, officer performance and monthly realization.
import { $, toast, downloadCsv } from '../ui.js';
import {
  BRANCHES, CASES, GROUPS, OFFICERS, PAYMENTS, PROPOSALS, activeCases, caseById,
  inr, inrCompact, overdueDays, totalOutstanding, totalOverdue,
} from '../recovery/data.js';
import { clear, el } from '../recovery/dom.js';

const BUCKETS = [
  { label: '0-30 days', from: 0, to: 30 },
  { label: '31-60 days', from: 31, to: 60 },
  { label: '61-90 days', from: 61, to: 90 },
  { label: '91-180 days', from: 91, to: 180 },
  { label: '181-365 days', from: 181, to: 365 },
  { label: 'Above 365 days', from: 366, to: 99999 },
];

function periodMonths() {
  return Number($('rec-report-period')?.value || 6);
}

function filteredCases() {
  const branch = $('rec-report-branch')?.value || '';
  return CASES.filter((c) => !branch || c.branch === branch);
}

function filteredPayments() {
  const branch = $('rec-report-branch')?.value || '';
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - periodMonths());
  const iso = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-01`;
  return PAYMENTS.filter((p) => {
    const c = caseById(p.caseId);
    return p.date >= iso && (!branch || c?.branch === branch);
  });
}

function setText(id, value) {
  const node = $(id);
  if (node) node.textContent = value;
}

function renderStats() {
  const cases = filteredCases();
  const payments = filteredPayments();
  const recovered = payments.reduce((s, p) => s + p.amount, 0);
  const closed = cases.filter((c) => c.status === 'closed');
  const avg = closed.length ? Math.round(closed.reduce((s, c) => s + c.days, 0) / closed.length) : 0;
  const settlements = PROPOSALS.filter((p) => p.status === 'approved' || p.status === 'paid').length;
  setText('rec-report-stat-recovered', inrCompact(recovered));
  setText('rec-report-stat-resolved', String(closed.length));
  setText('rec-report-stat-avgdays', `${avg} d`);
  setText('rec-report-stat-settlements', String(settlements));
}

function renderStageTable() {
  const tbody = $('rec-report-stage-table');
  if (!tbody) return;
  tbody.textContent = '';
  const cases = filteredCases().filter((c) => c.status === 'active');
  const rows = GROUPS.map((g) => {
    const list = cases.filter((c) => c.stage >= g.from && c.stage <= g.to);
    return {
      ...g,
      count: list.length,
      outstanding: totalOutstanding(list),
      overdue: totalOverdue(list),
      share: cases.length ? (list.length / cases.length) * 100 : 0,
    };
  });
  for (const r of rows) {
    tbody.appendChild(el('tr', {},
      el('td', {}, el('span', { class: `rec-group-dot is-${r.key}` }), r.label),
      el('td', {}, String(r.count)),
      el('td', {}, inr(r.outstanding)),
      el('td', {}, inr(r.overdue)),
      el('td', {},
        el('span', { class: 'rec-share' },
          el('span', { class: 'rec-share-fill' }, ''),
          `${r.share.toFixed(0)}%`))));
    const fill = tbody.lastChild.lastChild.querySelector('.rec-share-fill');
    if (fill) fill.style.width = `${Math.max(2, r.share)}%`;
  }
  tbody.appendChild(el('tr', {},
    el('th', { scope: 'row' }, 'Total'),
    el('td', {}, String(cases.length)),
    el('td', {}, inr(totalOutstanding(cases))),
    el('td', {}, inr(totalOverdue(cases))),
    el('td', {}, '100%')));
}

function renderAgingTable() {
  const tbody = $('rec-report-aging-table');
  if (!tbody) return;
  tbody.textContent = '';
  const cases = filteredCases().filter((c) => c.status === 'active');
  for (const b of BUCKETS) {
    const list = cases.filter((c) => {
      const d = overdueDays(c);
      return d >= b.from && d <= b.to;
    });
    tbody.appendChild(el('tr', {},
      el('td', {}, b.label),
      el('td', {}, String(list.length)),
      el('td', {}, inr(totalOverdue(list))),
      el('td', {}, inr(totalOutstanding(list)))));
  }
}

function renderOfficerTable() {
  const tbody = $('rec-report-officer-table');
  if (!tbody) return;
  tbody.textContent = '';
  const cases = filteredCases();
  const payments = filteredPayments();
  const all = OFFICERS.map((officer) => {
    const list = cases.filter((c) => c.officer === officer);
    const recovered = payments.filter((p) => caseById(p.caseId)?.officer === officer).reduce((s, p) => s + p.amount, 0);
    const closed = list.filter((c) => c.status === 'closed').length;
    return { officer, list, recovered, closed };
  }).filter((o) => o.list.length);
  const max = Math.max(...all.map((o) => o.recovered), 1);
  for (const o of all) {
    const share = o.recovered / max;
    tbody.appendChild(el('tr', {},
      el('td', {}, el('strong', {}, o.officer)),
      el('td', {}, String(o.list.length)),
      el('td', {}, String(o.list.filter((c) => c.status === 'active').length)),
      el('td', {}, inr(totalOutstanding(o.list))),
      el('td', {}, inr(totalOverdue(o.list))),
      el('td', {}, inr(o.recovered)),
      el('td', {},
        el('span', { class: 'rec-share' },
          el('span', { class: 'rec-share-fill' }, ''), `${Math.round(share * 100)}%`))));
    const fill = tbody.lastChild.lastChild.querySelector('.rec-share-fill');
    if (fill) fill.style.width = `${Math.max(2, share * 100)}%`;
  }
}

function renderChart() {
  const box = $('rec-report-chart');
  if (!box) return;
  clear(box);
  const months = [];
  const now = new Date();
  for (let i = periodMonths() - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(d);
    const amount = filteredPayments().filter((p) => (p.date || '').slice(0, 7) === key).reduce((s, p) => s + p.amount, 0);
    months.push({ key, label, amount });
  }
  const max = Math.max(...months.map((m) => m.amount), 1);
  for (const m of months) {
    const height = Math.max(m.amount ? 8 : 2, Math.round((m.amount / max) * 100));
    box.appendChild(el('div', { class: 'rec-chart-col', title: `${m.label}: ${inr(m.amount)}` },
      el('span', { class: 'rec-chart-value' }, m.amount ? inrCompact(m.amount) : '-'),
      el('div', { class: 'rec-chart-track' },
        el('div', { class: 'rec-chart-bar', style: `height:${height}%` })),
      el('span', { class: 'rec-chart-label' }, m.label)));
  }
}

function exportReport() {
  const cases = filteredCases().filter((c) => c.status === 'active');
  const rows = [['Stage group', 'Cases', 'Outstanding', 'Overdue', 'Share %']];
  for (const g of GROUPS) {
    const list = cases.filter((c) => c.stage >= g.from && c.stage <= g.to);
    rows.push([g.label, list.length, totalOutstanding(list), totalOverdue(list),
      cases.length ? ((list.length / cases.length) * 100).toFixed(1) : '0']);
  }
  downloadCsv(`recovery-report-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  toast('Report exported', 'Stage summary downloaded as CSV.', 'success');
}

function render() {
  renderStats();
  renderStageTable();
  renderAgingTable();
  renderOfficerTable();
  renderChart();
}

function init() {
  const branch = $('rec-report-branch');
  if (branch && !branch.options.length) {
    branch.appendChild(new Option('All branches', ''));
    for (const b of BRANCHES) branch.appendChild(new Option(b, b));
  }
  $('rec-report-branch')?.addEventListener('change', render);
  $('rec-report-period')?.addEventListener('change', render);
  $('btn-rec-export-report')?.addEventListener('click', exportReport);
}

export default {
  init,
  show: render,
};
