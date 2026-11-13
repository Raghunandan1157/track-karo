// Branches (admin): CRUD with place search filling lat/lng.
import { get, post, put, del } from '../api.js';
import {
  $, cloneTpl, fill, setEmpty, toast, toastError, withLoading, showError, debounce,
  confirmDialog, openDialog, closeDialog, fmtNum, hasCoords, num,
} from '../ui.js';
import { getBranches, emit } from '../state.js';

let loaded = false;
let branches = [];
let searchSeq = 0;

function render() {
  const tbody = $('branches-table');
  tbody.textContent = '';
  for (const b of branches) {
    const tr = cloneTpl('tpl-branch-row');
    tr.dataset.branchId = b.id;
    fill(tr, {
      name: b.name,
      address: b.address,
      lat: fmtNum(b.lat, 6),
      lng: fmtNum(b.lng, 6),
      manager_names: Array.isArray(b.manager_names) ? b.manager_names.join(', ') : b.manager_names,
      officer_count: b.officer_count ?? 0,
    });
    tbody.appendChild(tr);
  }
  setEmpty('branches', branches.length === 0);
}

async function load() {
  const tbody = $('branches-table');
  tbody.classList.add('is-loading');
  try {
    branches = await getBranches(true);
    loaded = true;
    render();
    emit('branches:changed', branches);
  } catch (err) {
    toastError(err, 'Could not load branches');
  } finally {
    tbody.classList.remove('is-loading');
  }
}

// ---------- place search in the dialog ----------
function hideResults() {
  $('branch-place-results').hidden = true;
  $('branch-place-results-empty').hidden = true;
}

async function searchPlaces(q) {
  q = (q || '').trim();
  if (q.length < 3) { hideResults(); return; }
  const my = ++searchSeq;
  const input = $('branch-place-search');
  input.classList.add('is-loading');
  try {
    const r = await get('/geocode', { q });
    if (my !== searchSeq) return;
    const ul = $('branch-place-results');
    ul.textContent = '';
    const results = r.results || [];
    results.forEach((p, i) => {
      const li = cloneTpl('tpl-branch-place-result');
      li.dataset.index = String(i);
      fill(li, { name: p.name, address: p.address });
      ul.appendChild(li);
    });
    ul.tkResults = results;
    ul.hidden = results.length === 0;
    $('branch-place-results-empty').hidden = results.length > 0;
  } catch (err) {
    if (my === searchSeq) toastError(err, 'Place search failed');
  } finally {
    if (my === searchSeq) input.classList.remove('is-loading');
  }
}

function pick(li) {
  const p = ($('branch-place-results').tkResults || [])[Number(li.dataset.index)];
  if (!p) return;
  if (hasCoords(p)) {
    $('branch-lat').value = Number(p.lat).toFixed(6);
    $('branch-lng').value = Number(p.lng).toFixed(6);
  }
  if (!$('branch-address').value.trim() && p.address) $('branch-address').value = p.address;
  if (!$('branch-name').value.trim() && p.name) $('branch-name').value = p.name;
  hideResults();
}

function openBranch(b) {
  $('form-branch').reset();
  showError($('branch-error'), '');
  hideResults();
  $('modal-branch-title').textContent = b ? 'Edit branch' : 'Add branch';
  $('branch-id').value = b ? b.id : '';
  $('branch-name').value = b?.name || '';
  $('branch-address').value = b?.address || '';
  $('branch-lat').value = b && b.lat !== null && b.lat !== undefined ? b.lat : '';
  $('branch-lng').value = b && b.lng !== null && b.lng !== undefined ? b.lng : '';
  openDialog($('modal-branch'));
  $('branch-name').focus();
}

async function saveBranch(e) {
  e.preventDefault();
  const err = $('branch-error');
  showError(err, '');
  const id = $('branch-id').value;
  const body = {
    name: $('branch-name').value.trim(),
    address: $('branch-address').value.trim(),
    lat: num($('branch-lat').value),
    lng: num($('branch-lng').value),
  };
  if (!body.name) { showError(err, 'Enter the branch name.'); $('branch-name').focus(); return; }
  if (body.lat === null || body.lng === null || Math.abs(body.lat) > 90 || Math.abs(body.lng) > 180) {
    showError(err, 'Enter a valid latitude and longitude (or search a place).'); $('branch-lat').focus(); return;
  }
  await withLoading($('btn-save-branch'), async () => {
    try {
      if (id) await put(`/branches/${encodeURIComponent(id)}`, body);
      else await post('/branches', body);
      closeDialog($('modal-branch'));
      toast(id ? 'Branch updated' : 'Branch added', body.name, 'success');
      load();
    } catch (ex) {
      showError(err, ex.message);
    }
  });
}

async function deleteBranch(b) {
  const ok = await confirmDialog({
    title: 'Delete branch?',
    message: `Delete "${b.name}"? This cannot be undone.`,
    okText: 'Delete',
  });
  if (!ok) return;
  try {
    await del(`/branches/${encodeURIComponent(b.id)}`);
    toast('Branch deleted', b.name, 'success');
    load();
  } catch (err) {
    toastError(err, 'Could not delete the branch');
  }
}

function init() {
  $('btn-add-branch').addEventListener('click', () => openBranch(null));
  $('form-branch').addEventListener('submit', saveBranch);
  const debounced = debounce((q) => searchPlaces(q), 450);
  const input = $('branch-place-search');
  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (q.length >= 3) debounced(q); else { debounced.cancel(); hideResults(); }
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); debounced.cancel(); searchPlaces(input.value); }
    if (e.key === 'ArrowDown') { const first = $('branch-place-results').querySelector('li'); if (first) { e.preventDefault(); first.focus(); } }
  });
  const ul = $('branch-place-results');
  ul.addEventListener('click', (e) => { const li = e.target.closest('[data-action="pick"]'); if (li) pick(li); });
  ul.addEventListener('keydown', (e) => {
    const li = e.target.closest('[data-action="pick"]');
    if (!li) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(li); }
    if (e.key === 'ArrowDown') { e.preventDefault(); li.nextElementSibling?.focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); (li.previousElementSibling || input).focus(); }
  });
  $('branches-table').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    const tr = btn?.closest('tr[data-branch-id]');
    if (!tr) return;
    const b = branches.find((x) => String(x.id) === tr.dataset.branchId);
    if (!b) return;
    if (btn.dataset.action === 'edit') openBranch(b);
    if (btn.dataset.action === 'delete') deleteBranch(b);
  });
}

export default {
  init,
  show() { if (!loaded) load(); },
  refresh: load,
};
