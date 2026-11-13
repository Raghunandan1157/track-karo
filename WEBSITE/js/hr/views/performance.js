// HR performance: review cycles, rating distribution and appraisal dialog.
import {
  $, cloneTpl, fill, setEmpty, toast, toastError, withLoading, showError,
  openDialog, closeDialog, downloadCsv, fmtDay,
} from '../../ui.js';
import {
  reviewCycles, reviews, review, reviewStats, saveReview, employee,
  departments, departmentName, branchName,
} from '../store.js';
import { ymd } from '../seed.js';
import { hrScope, personCell, avatar, fillBranches, fillDepartments, barRow, stars, lockScope } from '../ui.js';

const selCycle = () => Number($('hr-perf-cycle')?.value) || reviewCycles()[0]?.id;
const filters = () => ({
  branch_id: $('hr-perf-branch')?.value || hrScope() || '',
  department: $('hr-perf-dept')?.value || '',
});

const statusLabel = { pending: 'Not started', self_done: 'Self review done', completed: 'Completed' };

function renderStats() {
  const s = reviewStats(selCycle());
  const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  set('hr-perf-stat-total', s.total);
  set('hr-perf-stat-completed', s.completed);
  set('hr-perf-stat-avg', s.completed ? s.avg_rating : '-');
  set('hr-perf-stat-pending', s.pending);

  const cycle = reviewCycles().find((c) => c.id === selCycle());
  const info = $('hr-perf-cycle-info');
  if (info && cycle) {
    info.textContent = '';
    const name = document.createElement('strong');
    name.textContent = cycle.name;
    const dates = document.createElement('span');
    dates.textContent = `${fmtDay(cycle.period_from)} - ${fmtDay(cycle.period_to)} · due ${fmtDay(cycle.due)}`;
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.dataset.value = cycle.status === 'completed' ? 'completed' : 'pending';
    chip.textContent = cycle.status === 'completed' ? 'Completed' : 'In progress';
    info.append(name, dates, chip);
  }
}

function renderDistribution() {
  const box = $('hr-perf-dist');
  if (!box) return;
  box.textContent = '';
  const dist = reviewStats(selCycle()).distribution;
  const max = Math.max(1, ...dist.map((d) => d.count));
  for (const d of dist) {
    box.appendChild(barRow(`${d.rating} star${d.rating === 1 ? '' : 's'}`, d.count, max, { display: String(d.count), tone: d.rating >= 4 ? 'good' : d.rating === 3 ? 'mid' : 'low' }));
  }
}

function renderTop() {
  const box = $('hr-perf-top');
  if (!box) return;
  box.textContent = '';
  const list = reviews(selCycle(), filters())
    .filter((r) => r.status === 'completed')
    .sort((a, b) => (b.final_rating || 0) - (a.final_rating || 0))
    .slice(0, 5);
  if (!list.length) {
    const p = document.createElement('p');
    p.className = 'empty-state';
    p.textContent = 'No completed reviews yet.';
    box.appendChild(p);
    return;
  }
  for (const r of list) {
    const row = document.createElement('div');
    row.className = 'top-performer';
    row.appendChild(avatar(r.employee));
    const main = document.createElement('div');
    main.className = 'top-main';
    const n = document.createElement('strong');
    n.textContent = r.employee?.name || '-';
    const m = document.createElement('span');
    m.className = 'muted';
    m.textContent = `${r.employee?.designation || ''} · ${departmentName(r.employee?.department)}`;
    main.append(n, m);
    const rating = document.createElement('span');
    rating.className = 'stars';
    rating.textContent = stars(r.final_rating);
    row.append(main, rating);
    box.appendChild(row);
  }
}

function renderTable() {
  const tbody = $('hr-perf-table');
  if (!tbody) return;
  const list = reviews(selCycle(), filters());
  tbody.textContent = '';
  for (const r of list) {
    const tr = cloneTpl('tpl-hr-perf-row');
    tr.dataset.reviewId = r.id;
    const person = tr.querySelector('[data-field="person"]');
    if (person) person.appendChild(personCell(r.employee));
    fill(tr, {
      department: departmentName(r.employee?.department),
      self: r.self_rating ? stars(r.self_rating) : '-',
      manager: r.manager_rating ? stars(r.manager_rating) : '-',
      final: r.final_rating ? stars(r.final_rating) : '-',
      status: { text: statusLabel[r.status] || r.status, value: r.status },
      goals: `${r.goals.filter((g) => g.progress >= 100).length}/${r.goals.length}`,
    });
    tbody.appendChild(tr);
  }
  setEmpty('hr-perf', list.length === 0);
}

function openReview(id) {
  const r = review(id);
  if (!r) return;
  $('hr-review-id').value = r.id;
  $('hr-review-employee').textContent = r.employee?.name || '-';
  const month = reviewCycles().find((c) => c.id === r.cycle_id);
  $('hr-review-meta').textContent = `${r.employee?.designation || ''} · ${departmentName(r.employee?.department)} · ${month?.name || ''}`;
  $('hr-review-self').value = String(r.self_rating || '');
  $('hr-review-manager').value = String(r.manager_rating || '');
  $('hr-review-note').value = r.manager_note || '';
  const goals = $('hr-review-goals');
  goals.textContent = '';
  for (const g of r.goals) {
    const row = document.createElement('div');
    row.className = 'goal-row';
    const top = document.createElement('div');
    top.className = 'goal-top';
    const title = document.createElement('strong');
    title.textContent = g.title;
    const weight = document.createElement('span');
    weight.className = 'muted';
    weight.textContent = `${g.weight}% weight`;
    top.append(title, weight);
    const track = document.createElement('span');
    track.className = 'progress-track';
    const fillEl = document.createElement('span');
    fillEl.className = 'progress-fill';
    fillEl.style.width = `${Math.min(100, g.progress)}%`;
    track.appendChild(fillEl);
    const meta = document.createElement('span');
    meta.className = 'goal-meta';
    meta.textContent = `${g.progress}% complete${g.rating ? ` · self rated ${g.rating}/5` : ''}`;
    row.append(top, track, meta);
    goals.appendChild(row);
  }
  showError($('hr-review-error'), '');
  openDialog($('modal-hr-review'));
}

async function save(e) {
  e.preventDefault();
  const err = $('hr-review-error');
  showError(err, '');
  const id = $('hr-review-id').value;
  const self = Number($('hr-review-self').value) || 0;
  if (!self) { showError(err, 'Select the self rating.'); $('hr-review-self').focus(); return; }
  await withLoading($('btn-hr-save-review'), async () => {
    try {
      saveReview(id, {
        self_rating: self,
        manager_rating: Number($('hr-review-manager').value) || 0,
        manager_note: $('hr-review-note').value.trim(),
      });
      closeDialog($('modal-hr-review'));
      toast('Review saved', review(id)?.employee?.name || '', 'success');
      renderStats();
      renderDistribution();
      renderTop();
      renderTable();
    } catch (ex) {
      showError(err, ex.message);
    }
  });
}

function exportCsv() {
  const rows = reviews(selCycle(), filters()).map((r) => [
    r.employee?.emp_code, r.employee?.name, departmentName(r.employee?.department),
    r.self_rating, r.manager_rating, r.final_rating, statusLabel[r.status] || r.status, r.manager_note,
  ]);
  downloadCsv(`appraisals-${ymd(new Date())}.csv`, [['Code', 'Name', 'Department', 'Self', 'Manager', 'Final', 'Status', 'Manager note'], ...rows]);
}

function init() {
  const sel = $('hr-perf-cycle');
  if (sel) {
    sel.textContent = '';
    for (const c of reviewCycles()) {
      const o = document.createElement('option');
      o.value = String(c.id);
      o.textContent = c.name;
      sel.appendChild(o);
    }
    sel.value = String(reviewCycles()[0]?.id || '');
  }
  fillBranches($('hr-perf-branch'));
  lockScope($('hr-perf-branch'));
  fillDepartments($('hr-perf-dept'));
  $('hr-perf-cycle').addEventListener('change', () => {
    renderStats(); renderDistribution(); renderTop(); renderTable();
  });
  for (const id of ['hr-perf-branch', 'hr-perf-dept']) {
    $(id).addEventListener('change', () => { renderTop(); renderTable(); });
  }
  $('btn-hr-perf-export').addEventListener('click', exportCsv);
  $('form-hr-review').addEventListener('submit', save);
  $('hr-perf-table').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="review"]');
    const tr = btn?.closest('tr[data-review-id]');
    if (tr) openReview(tr.dataset.reviewId);
  });
}

export default {
  init,
  show() {
    fillBranches($('hr-perf-branch'));
    lockScope($('hr-perf-branch'));
    fillDepartments($('hr-perf-dept'));
    renderStats();
    renderDistribution();
    renderTop();
    renderTable();
  },
};
