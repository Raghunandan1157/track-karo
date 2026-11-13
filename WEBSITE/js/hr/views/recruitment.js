// HR recruitment: pipeline, job openings and onboarding checklists.
import {
  $, $$, cloneTpl, fill, setEmpty, toast, toastError, withLoading, showError,
  openDialog, closeDialog, downloadCsv, fmtDay,
} from '../../ui.js';
import {
  jobs, job, jobTitle, addJob, closeJob, candidates, addCandidate, setCandidateStage,
  recruitmentStats, onboarding, toggleOnboardingTask, employees, branches, departments,
  departmentName, branchName, typeName, stages,
} from '../store.js';
import { ymd, STAGES } from '../seed.js';
import { hrScope, avatar, moneyShort, stars } from '../ui.js';

let tab = 'pipeline';
const STAGE_ORDER = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected'];

function renderStats() {
  const s = recruitmentStats();
  const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  set('hr-rec-stat-open', s.open_jobs);
  set('hr-rec-stat-openings', s.openings);
  set('hr-rec-stat-pipeline', s.in_pipeline);
  set('hr-rec-stat-interviews', s.interviews_this_week);
}

function renderJobs() {
  const tbody = $('hr-jobs-table');
  if (!tbody) return;
  const list = jobs().filter((j) => !hrScope() || String(j.branch_id) === String(hrScope()));
  tbody.textContent = '';
  for (const j of list) {
    const tr = cloneTpl('tpl-hr-job-row');
    tr.dataset.jobId = j.id;
    fill(tr, {
      title: j.title,
      department: departmentName(j.department),
      branch: branchName(j.branch_id),
      type: typeName(j.employment_type),
      openings: j.openings - (j.filled || 0),
      filled: j.filled || 0,
      status: { text: j.status === 'open' ? 'Open' : 'Closed', value: j.status },
      posted: fmtDay(j.posted_at),
    });
    const toggle = tr.querySelector('[data-action="toggle-job"]');
    if (toggle) toggle.textContent = j.status === 'open' ? 'Close' : 'Reopen';
    tbody.appendChild(tr);
  }
  setEmpty('hr-jobs', list.length === 0);
}

function renderPipeline() {
  const board = $('hr-pipeline');
  if (!board) return;
  board.textContent = '';
  const list = candidates();
  for (const stage of STAGE_ORDER) {
    const col = document.createElement('section');
    col.className = `kanban-col kanban-${stage}`;
    const head = document.createElement('header');
    head.className = 'kanban-head';
    const name = document.createElement('h3');
    name.textContent = stages()[stage] || stage;
    const count = document.createElement('span');
    count.className = 'badge';
    const items = list.filter((c) => c.stage === stage);
    count.textContent = items.length;
    head.append(name, count);
    col.appendChild(head);

    const body = document.createElement('div');
    body.className = 'kanban-body';
    for (const c of items) {
      const card = document.createElement('article');
      card.className = 'kanban-card';
      const top = document.createElement('div');
      top.className = 'kanban-card-top';
      top.appendChild(avatar(c, 'avatar avatar-sm'));
      const who = document.createElement('div');
      who.className = 'kanban-who';
      const n = document.createElement('strong');
      n.textContent = c.name;
      const j = document.createElement('span');
      j.textContent = jobTitle(c.job_id);
      who.append(n, j);
      top.appendChild(who);
      card.appendChild(top);

      const meta = document.createElement('p');
      meta.className = 'kanban-meta';
      meta.textContent = `${c.experience_years} yrs exp · ₹${moneyShort(c.expected_ctc)} expected`;
      card.appendChild(meta);

      const rating = document.createElement('p');
      rating.className = 'kanban-rating';
      rating.textContent = stars(c.rating);
      rating.title = `Rating ${c.rating}/5`;
      card.appendChild(rating);

      if (c.interview_at) {
        const iv = document.createElement('p');
        iv.className = 'kanban-interview';
        iv.textContent = new Date(c.interview_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
        card.appendChild(iv);
      }

      const actions = document.createElement('div');
      actions.className = 'kanban-actions';
      const idx = STAGE_ORDER.indexOf(stage);
      if (stage !== 'hired' && stage !== 'rejected') {
        const next = document.createElement('button');
        next.type = 'button';
        next.className = 'btn btn-sm';
        next.dataset.candidateId = c.id;
        next.dataset.next = STAGE_ORDER[idx + 1];
        next.textContent = idx === 3 ? 'Mark hired' : 'Advance';
        actions.appendChild(next);
        const rej = document.createElement('button');
        rej.type = 'button';
        rej.className = 'btn btn-sm btn-link';
        rej.dataset.candidateId = c.id;
        rej.dataset.next = 'rejected';
        rej.textContent = 'Reject';
        actions.appendChild(rej);
      } else if (stage === 'rejected') {
        const back = document.createElement('button');
        back.type = 'button';
        back.className = 'btn btn-sm btn-link';
        back.dataset.candidateId = c.id;
        back.dataset.next = 'screening';
        back.textContent = 'Reopen';
        actions.appendChild(back);
      }
      card.appendChild(actions);
      body.appendChild(card);
    }
    if (!items.length) {
      const p = document.createElement('p');
      p.className = 'kanban-empty';
      p.textContent = 'No candidates';
      body.appendChild(p);
    }
    col.appendChild(body);
    board.appendChild(col);
  }
}

function renderOnboarding() {
  const box = $('hr-onboarding-list');
  if (!box) return;
  box.textContent = '';
  const list = onboarding();
  for (const o of list) {
    const card = document.createElement('article');
    card.className = 'card onboarding-card';
    const head = document.createElement('header');
    head.className = 'onboarding-head';
    head.appendChild(avatar(o.employee, 'avatar'));
    const info = document.createElement('div');
    info.className = 'onboarding-info';
    const name = document.createElement('strong');
    name.textContent = o.employee?.name || '-';
    const meta = document.createElement('span');
    meta.textContent = `${o.employee?.designation || ''} · joined ${fmtDay(o.start_date)} · buddy ${o.buddy?.name || '-'}`;
    info.append(name, meta);
    const pct = document.createElement('span');
    pct.className = 'chip';
    pct.dataset.value = o.pct === 100 ? 'completed' : 'pending';
    pct.textContent = `${o.done}/${o.total} done`;
    head.append(info, pct);
    card.appendChild(head);

    const track = document.createElement('div');
    track.className = 'progress-track onboarding-track';
    const fillEl = document.createElement('span');
    fillEl.className = 'progress-fill';
    fillEl.style.width = `${o.pct}%`;
    track.appendChild(fillEl);
    card.appendChild(track);

    const ul = document.createElement('ul');
    ul.className = 'checklist';
    for (const t of o.tasks) {
      const li = document.createElement('li');
      const label = document.createElement('label');
      label.className = 'check';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = t.done;
      cb.dataset.onboardingId = o.id;
      cb.dataset.taskKey = t.key;
      const span = document.createElement('span');
      span.textContent = t.label;
      label.append(cb, span);
      li.appendChild(label);
      ul.appendChild(li);
    }
    card.appendChild(ul);
    box.appendChild(card);
  }
  if (!list.length) {
    const p = document.createElement('p');
    p.className = 'empty-state';
    p.textContent = 'No one is onboarding right now.';
    box.appendChild(p);
  }
}

function switchTab(next) {
  tab = next;
  for (const btn of $$('[data-hr-rec-tab]')) btn.setAttribute('aria-selected', String(btn.dataset.hrRecTab === next));
  const panels = { pipeline: $('hr-rec-pipeline'), jobs: $('hr-rec-jobs'), onboarding: $('hr-rec-onboarding') };
  for (const [k, el] of Object.entries(panels)) if (el) el.hidden = k !== next;
  if (next === 'pipeline') renderPipeline();
  if (next === 'jobs') renderJobs();
  if (next === 'onboarding') renderOnboarding();
}

function openJob() {
  $('form-hr-job').reset();
  const deptSel = $('hr-job-dept');
  deptSel.textContent = '';
  for (const d of departments()) {
    const o = document.createElement('option');
    o.value = d.key;
    o.textContent = d.name;
    deptSel.appendChild(o);
  }
  const branchSel = $('hr-job-branch');
  branchSel.textContent = '';
  for (const b of branches().filter((b) => !hrScope() || String(b.id) === String(hrScope()))) {
    const o = document.createElement('option');
    o.value = String(b.id);
    o.textContent = b.name;
    branchSel.appendChild(o);
  }
  const mgrSel = $('hr-job-manager');
  mgrSel.textContent = '';
  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = 'Not assigned';
  mgrSel.appendChild(blank);
  for (const e of employees().filter((e) => ['active', 'probation'].includes(e.status)).slice(0, 80)) {
    const o = document.createElement('option');
    o.value = String(e.id);
    o.textContent = `${e.name} (${e.emp_code})`;
    mgrSel.appendChild(o);
  }
  showError($('hr-job-error'), '');
  openDialog($('modal-hr-job'));
}

async function saveJob(e) {
  e.preventDefault();
  const err = $('hr-job-error');
  showError(err, '');
  if (!$('hr-job-title').value.trim()) { showError(err, 'Enter the job title.'); return; }
  await withLoading($('btn-hr-save-job'), async () => {
    try {
      addJob({
        title: $('hr-job-title').value,
        department: $('hr-job-dept').value,
        branch_id: $('hr-job-branch').value,
        employment_type: $('hr-job-type').value,
        openings: $('hr-job-openings').value,
        hiring_manager_id: $('hr-job-manager').value || null,
        description: $('hr-job-description').value,
      });
      closeDialog($('modal-hr-job'));
      toast('Job posted', $('hr-job-title').value, 'success');
      renderStats();
      switchTab('jobs');
    } catch (ex) {
      showError(err, ex.message);
    }
  });
}

function openCandidate() {
  $('form-hr-candidate').reset();
  const sel = $('hr-cand-job');
  sel.textContent = '';
  for (const j of jobs().filter((j) => j.status === 'open')) {
    const o = document.createElement('option');
    o.value = String(j.id);
    o.textContent = `${j.title} · ${branchName(j.branch_id)}`;
    sel.appendChild(o);
  }
  showError($('hr-cand-error'), '');
  openDialog($('modal-hr-candidate'));
}

async function saveCandidate(e) {
  e.preventDefault();
  const err = $('hr-cand-error');
  showError(err, '');
  if (!$('hr-cand-name').value.trim()) { showError(err, 'Enter the candidate name.'); return; }
  if (!$('hr-cand-job').value) { showError(err, 'Post a job before adding candidates.'); return; }
  await withLoading($('btn-hr-save-candidate'), async () => {
    try {
      addCandidate({
        name: $('hr-cand-name').value,
        email: $('hr-cand-email').value,
        phone: $('hr-cand-phone').value,
        job_id: $('hr-cand-job').value,
        experience_years: $('hr-cand-exp').value,
        current_ctc: $('hr-cand-current').value,
        expected_ctc: $('hr-cand-expected').value,
        source: $('hr-cand-source').value,
        rating: $('hr-cand-rating').value,
        interview_at: $('hr-cand-interview').value,
        notes: $('hr-cand-notes').value,
      });
      closeDialog($('modal-hr-candidate'));
      toast('Candidate added', $('hr-cand-name').value, 'success');
      renderStats();
      switchTab('pipeline');
    } catch (ex) {
      showError(err, ex.message);
    }
  });
}

function exportCsv() {
  const rows = candidates().map((c) => [c.name, c.email, c.phone, jobTitle(c.job_id), STAGES[c.stage] || c.stage, c.experience_years, c.current_ctc, c.expected_ctc, c.source, c.rating, c.applied_at]);
  downloadCsv(`candidates-${ymd(new Date())}.csv`, [['Name', 'Email', 'Phone', 'Job', 'Stage', 'Experience', 'Current CTC', 'Expected CTC', 'Source', 'Rating', 'Applied'], ...rows]);
}

function init() {
  $('btn-hr-add-job').addEventListener('click', openJob);
  $('btn-hr-add-candidate').addEventListener('click', openCandidate);
  $('btn-hr-rec-export').addEventListener('click', exportCsv);
  $('form-hr-job').addEventListener('submit', saveJob);
  $('form-hr-candidate').addEventListener('submit', saveCandidate);
  for (const btn of $$('[data-hr-rec-tab]')) btn.addEventListener('click', () => switchTab(btn.dataset.hrRecTab));
  $('hr-pipeline').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-candidate-id]');
    if (!btn) return;
    try {
      setCandidateStage(btn.dataset.candidateId, btn.dataset.next);
      renderStats();
      renderPipeline();
      toast('Candidate moved', stages()[btn.dataset.next] || btn.dataset.next, 'success');
    } catch (err) {
      toastError(err, 'Could not move the candidate');
    }
  });
  $('hr-jobs-table').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="toggle-job"]');
    const tr = btn?.closest('tr[data-job-id]');
    if (!tr) return;
    closeJob(tr.dataset.jobId);
    renderJobs();
    renderStats();
  });
  $('hr-onboarding-list').addEventListener('change', (e) => {
    const cb = e.target.closest('input[data-task-key]');
    if (!cb) return;
    toggleOnboardingTask(cb.dataset.onboardingId, cb.dataset.taskKey);
    renderOnboarding();
  });
}

export default {
  init,
  show() {
    renderStats();
    switchTab(tab);
  },
};
