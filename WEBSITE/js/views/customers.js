// Customers: search, branch filter, pagination, add/edit/delete, CSV import.
import { get, post, put, del } from '../api.js';
import {
  $, cloneTpl, fill, setEmpty, chip, toast, toastError, withLoading, showError, debounce,
  confirmDialog, openDialog, closeDialog, fmtDateTime, parseCsv, hasCoords, num,
} from '../ui.js';
import { on, fillBranchSelect, lockBranchSelect, isManager } from '../state.js';

const PAGE = 50;
let loaded = false;
let offset = 0;
let total = 0;
let rows = [];
let seq = 0;
let importRows = [];

function rowValues(c) {
  const located = hasCoords(c);
  return {
    name: c.name,
    village: c.village,
    phone: c.phone,
    branch_name: c.branch_name,
    located: located ? chip('Yes', 'yes') : chip('No', 'no'),
    located_at: located ? fmtDateTime(c.located_at) : '-',
    located_by_name: located ? c.located_by_name : '-',
  };
}

function render() {
  const tbody = $('customers-table');
  tbody.textContent = '';
  for (const c of rows) {
    const tr = cloneTpl('tpl-customer-row');
    tr.dataset.customerId = c.id;
    fill(tr, rowValues(c));
    tbody.appendChild(tr);
  }
  setEmpty('customers', rows.length === 0);
  const from = rows.length ? offset + 1 : 0;
  const to = offset + rows.length;
  $('customers-page-info').textContent = total ? `${from}-${to} of ${total}` : (rows.length ? `${from}-${to}` : '0 customers');
  $('customers-prev').disabled = offset === 0;
  $('customers-next').disabled = total ? to >= total : rows.length < PAGE;
}

async function load() {
  const my = ++seq;
  const tbody = $('customers-table');
  tbody.classList.add('is-loading');
  try {
    const r = await get('/customers', {
      q: $('customers-search').value.trim(),
      branch_id: $('customers-branch').value,
      limit: PAGE,
      offset,
    });
    if (my !== seq) return;
    rows = r.customers || [];
    total = Number(r.total) || 0;
    if (!rows.length && offset > 0 && total) { offset = Math.max(0, Math.floor((total - 1) / PAGE) * PAGE); return load(); }
    loaded = true;
    render();
  } catch (err) {
    if (my === seq) toastError(err, 'Could not load customers');
  } finally {
    if (my === seq) tbody.classList.remove('is-loading');
  }
}

const reload = () => { offset = 0; load(); };

// ---------- add / edit ----------
async function openCustomer(c) {
  const dlg = $('modal-customer');
  $('form-customer').reset();
  showError($('customer-error'), '');
  $('modal-customer-title').textContent = c ? 'Edit customer' : 'Add customer';
  $('customer-id').value = c ? c.id : '';
  $('customer-name').value = c?.name || '';
  $('customer-village').value = c?.village || '';
  $('customer-phone').value = c?.phone || '';
  try { await fillBranchSelect($('customer-branch')); } catch { /* ignore */ }
  $('customer-branch').value = c?.branch_id ? String(c.branch_id) : ($('customers-branch').value || '');
  lockBranchSelect($('customer-branch'));
  openDialog(dlg);
  $('customer-name').focus();
}

async function saveCustomer(e) {
  e.preventDefault();
  const err = $('customer-error');
  showError(err, '');
  const id = $('customer-id').value;
  const body = {
    name: $('customer-name').value.trim(),
    village: $('customer-village').value.trim(),
    phone: $('customer-phone').value.trim(),
    branch_id: num($('customer-branch').value) ?? $('customer-branch').value,
  };
  if (!body.name) { showError(err, 'Enter the customer name.'); $('customer-name').focus(); return; }
  if (!body.branch_id) { showError(err, 'Select a branch.'); $('customer-branch').focus(); return; }
  await withLoading($('btn-save-customer'), async () => {
    try {
      if (id) await put(`/customers/${encodeURIComponent(id)}`, body);
      else await post('/customers', body);
      closeDialog($('modal-customer'));
      toast(id ? 'Customer updated' : 'Customer added', body.name, 'success');
      load();
    } catch (ex) {
      showError(err, ex.message);
    }
  });
}

async function deleteCustomer(c) {
  const ok = await confirmDialog({
    title: 'Delete customer?',
    message: `Delete "${c.name}"${c.village ? ` (${c.village})` : ''}? This cannot be undone.`,
    okText: 'Delete',
  });
  if (!ok) return;
  try {
    await del(`/customers/${encodeURIComponent(c.id)}`);
    toast('Customer deleted', c.name, 'success');
    load();
  } catch (err) {
    toastError(err, 'Could not delete the customer');
  }
}

// ---------- import ----------
function parseImport(text) {
  const parsed = parseCsv(text);
  if (parsed.length && /^(customer\s*)?name$/i.test(parsed[0][0] || '')) parsed.shift();
  return parsed
    .map((r) => ({ name: (r[0] || '').trim(), village: (r[1] || '').trim(), phone: (r[2] || '').trim() }))
    .filter((r) => r.name);
}

function updateImportCount() {
  importRows = parseImport($('import-text').value);
  $('import-count').textContent = String(importRows.length);
}

async function openImport() {
  $('form-import').reset();
  showError($('import-error'), '');
  importRows = [];
  $('import-count').textContent = '0';
  try { await fillBranchSelect($('import-branch')); } catch { /* ignore */ }
  if (!isManager() && $('customers-branch').value) $('import-branch').value = $('customers-branch').value;
  lockBranchSelect($('import-branch'));
  openDialog($('modal-import'));
}

async function runImport(e) {
  e.preventDefault();
  const err = $('import-error');
  showError(err, '');
  updateImportCount();
  const branch = $('import-branch').value;
  if (!branch) { showError(err, 'Select the branch these customers belong to.'); $('import-branch').focus(); return; }
  if (!importRows.length) { showError(err, 'Choose a CSV file or paste rows: name, village, phone.'); return; }
  await withLoading($('btn-import-run'), async () => {
    try {
      const r = await post('/customers/import', { branch_id: num(branch) ?? branch, customers: importRows });
      closeDialog($('modal-import'));
      toast('Import complete', `${r.inserted ?? importRows.length} customers imported.`, 'success');
      reload();
    } catch (ex) {
      showError(err, ex.message);
    }
  });
}

function init() {
  const debounced = debounce(reload, 350);
  $('customers-search').addEventListener('input', debounced);
  $('customers-search').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); debounced.cancel(); reload(); } });
  $('customers-branch').addEventListener('change', reload);
  $('customers-prev').addEventListener('click', () => { offset = Math.max(0, offset - PAGE); load(); });
  $('customers-next').addEventListener('click', () => { offset += PAGE; load(); });
  $('btn-add-customer').addEventListener('click', () => openCustomer(null));
  $('btn-import-customers').addEventListener('click', openImport);
  $('form-customer').addEventListener('submit', saveCustomer);
  $('form-import').addEventListener('submit', runImport);
  $('import-text').addEventListener('input', updateImportCount);
  $('import-file').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      $('import-text').value = await f.text();
      updateImportCount();
    } catch {
      showError($('import-error'), 'Could not read that file.');
    }
  });
  $('customers-table').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    const tr = btn?.closest('tr[data-customer-id]');
    if (!tr) return;
    const c = rows.find((x) => String(x.id) === tr.dataset.customerId);
    if (!c) return;
    if (btn.dataset.action === 'edit') openCustomer(c);
    if (btn.dataset.action === 'delete') deleteCustomer(c);
  });

  // A customer located in the field: update the row if it is on this page.
  on('customer', (ev) => {
    if (!loaded || !ev) return;
    const c = rows.find((x) => String(x.id) === String(ev.id));
    if (!c) return;
    Object.assign(c, { lat: ev.lat, lng: ev.lng, located_at: ev.located_at });
    const tr = $('customers-table').querySelector(`tr[data-customer-id="${CSS.escape(String(c.id))}"]`);
    if (tr) fill(tr, rowValues(c));
  });
}

export default {
  init,
  async show() {
    if (loaded) return;
    loaded = true;
    try { await fillBranchSelect($('customers-branch')); } catch { /* ignore */ }
    await load();
  },
  refresh: load,
};
