// HR documents: compliance dashboard, expiry tracking and upload dialog.
import {
  $, cloneTpl, fill, setEmpty, toast, toastError, withLoading, showError,
  openDialog, closeDialog, downloadCsv, debounce, fmtDay,
} from '../../ui.js';
import {
  documents, documentStats, documentTypes, addDocument, updateDocument,
  employees, employee, branches, branchName, documentStatus,
} from '../store.js';
import { ymd } from '../seed.js';
import { hrScope, personCell, fillBranches, avatar, lockScope } from '../ui.js';

let lastList = [];

const statusLabel = { valid: 'Valid', expiring: 'Expiring', expired: 'Expired' };

const filters = () => ({
  q: $('hr-doc-q')?.value || '',
  type: $('hr-doc-type')?.value || '',
  status: $('hr-doc-status')?.value || '',
  branch_id: $('hr-doc-branch')?.value || hrScope() || '',
});

function renderStats() {
  const s = documentStats(hrScope());
  const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  set('hr-doc-stat-valid', s.valid);
  set('hr-doc-stat-expiring', s.expiring);
  set('hr-doc-stat-expired', s.expired);
  set('hr-doc-stat-missing', s.missing);
}

function renderTable() {
  const tbody = $('hr-doc-table');
  if (!tbody) return;
  const all = documents(filters());
  lastList = all;
  const list = all.slice(0, 80);
  tbody.textContent = '';
  for (const d of list) {
    const tr = cloneTpl('tpl-hr-doc-row');
    tr.dataset.docId = d.id;
    const person = tr.querySelector('[data-field="person"]');
    if (person) person.appendChild(personCell(d.employee));
    fill(tr, {
      type: documentTypes()[d.type] || d.type,
      number: d.number || '-',
      issued: d.issued_on ? fmtDay(d.issued_on) : '-',
      expires: d.expires_on ? fmtDay(d.expires_on) : 'No expiry',
      status: { text: statusLabel[d.computed_status], value: d.computed_status },
    });
    tbody.appendChild(tr);
  }
  setEmpty('hr-doc', list.length === 0);
  const count = $('hr-doc-count');
  if (count) count.textContent = all.length > list.length
    ? `${all.length} documents · showing first ${list.length}, narrow with filters`
    : `${all.length} document${all.length === 1 ? '' : 's'}`;
}

function renderExpiring() {
  const box = $('hr-doc-expiring');
  if (!box) return;
  box.textContent = '';
  const list = documents({ branch_id: hrScope() || '', status: 'expiring' }).slice(0, 6);
  const expired = documents({ branch_id: hrScope() || '', status: 'expired' }).slice(0, 3);
  const rows = [...expired, ...list];
  if (!rows.length) {
    const p = document.createElement('p');
    p.className = 'empty-state';
    p.textContent = 'No documents need attention.';
    box.appendChild(p);
    return;
  }
  for (const d of rows) {
    const row = document.createElement('div');
    row.className = 'doc-alert';
    const av = avatar(d.employee);
    const main = document.createElement('div');
    main.className = 'doc-main';
    const t = document.createElement('strong');
    t.textContent = d.employee?.name || '-';
    const s = document.createElement('span');
    s.className = 'muted';
    s.textContent = `${documentTypes()[d.type] || d.type} · ${d.expires_on ? fmtDay(d.expires_on) : ''}`;
    main.append(t, s);
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.dataset.value = d.computed_status;
    chip.textContent = statusLabel[d.computed_status];
    row.append(av, main, chip);
    box.appendChild(row);
  }
}

function fillDocForm(doc) {
  const empSel = $('hr-doc-employee');
  empSel.textContent = '';
  for (const e of employees({ branch_id: hrScope() || '' }).filter((x) => x.status !== 'inactive')) {
    const o = document.createElement('option');
    o.value = String(e.id);
    o.textContent = `${e.name} (${e.emp_code})`;
    empSel.appendChild(o);
  }
  const typeSel = $('hr-doc-type-input');
  typeSel.textContent = '';
  for (const [key, name] of Object.entries(documentTypes())) {
    const o = document.createElement('option');
    o.value = key;
    o.textContent = name;
    typeSel.appendChild(o);
  }
  $('form-hr-doc').reset();
  $('hr-doc-id').value = doc?.id || '';
  if (doc) {
    empSel.value = String(doc.employee_id);
    typeSel.value = doc.type;
    $('hr-doc-number').value = doc.number || '';
    $('hr-doc-issued').value = doc.issued_on || '';
    $('hr-doc-expires').value = doc.expires_on || '';
    $('hr-doc-notes').value = doc.notes || '';
  }
  $('hr-doc-modal-title').textContent = doc ? 'Update document' : 'Upload document';
  $('hr-doc-file').value = '';
  showError($('hr-doc-error'), '');
  openDialog($('modal-hr-doc'));
}

async function save(e) {
  e.preventDefault();
  const err = $('hr-doc-error');
  showError(err, '');
  const id = $('hr-doc-id').value;
  const expires = $('hr-doc-expires').value;
  const issued = $('hr-doc-issued').value;
  if (!id && !$('hr-doc-employee').value) { showError(err, 'Pick an employee.'); return; }
  if (!id && !$('hr-doc-type-input').value) { showError(err, 'Pick the document type.'); return; }
  if (issued && expires && expires < issued) { showError(err, 'The expiry date cannot be before the issue date.'); return; }
  const file = $('hr-doc-file').files?.[0];
  const payload = {
    employee_id: $('hr-doc-employee').value,
    type: $('hr-doc-type-input').value,
    number: $('hr-doc-number').value,
    issued_on: issued || null,
    expires_on: expires || null,
    notes: $('hr-doc-notes').value,
    file_name: file?.name || '',
  };
  await withLoading($('btn-hr-save-doc'), async () => {
    try {
      if (id) updateDocument(id, payload);
      else addDocument(payload);
      closeDialog($('modal-hr-doc'));
      toast(id ? 'Document updated' : 'Document added', documentTypes()[payload.type] || payload.type, 'success');
      renderStats();
      renderTable();
      renderExpiring();
    } catch (ex) {
      showError(err, ex.message);
    }
  });
}

function exportCsv() {
  const rows = lastList.map((d) => [
    d.employee?.emp_code, d.employee?.name, documentTypes()[d.type] || d.type, d.number,
    d.issued_on, d.expires_on, statusLabel[documentStatus(d)],
  ]);
  downloadCsv(`documents-${ymd(new Date())}.csv`, [['Code', 'Name', 'Document', 'Number', 'Issued', 'Expires', 'Status'], ...rows]);
}

function init() {
  fillBranches($('hr-doc-branch'));
  lockScope($('hr-doc-branch'));
  const typeSel = $('hr-doc-type');
  if (typeSel) {
    for (const [key, name] of Object.entries(documentTypes())) {
      const o = document.createElement('option');
      o.value = key;
      o.textContent = name;
      typeSel.appendChild(o);
    }
  }
  $('hr-doc-q')?.addEventListener('input', debounce(renderTable, 250));
  for (const id of ['hr-doc-type', 'hr-doc-status', 'hr-doc-branch']) {
    $(id)?.addEventListener('change', () => { renderStats(); renderTable(); });
  }
  $('btn-hr-upload-doc').addEventListener('click', () => fillDocForm(null));
  $('btn-hr-doc-export').addEventListener('click', exportCsv);
  $('form-hr-doc').addEventListener('submit', save);
  $('hr-doc-table').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="edit"]');
    const tr = btn?.closest('tr[data-doc-id]');
    if (!tr) return;
    const doc = documents().find((d) => String(d.id) === tr.dataset.docId);
    if (doc) fillDocForm(doc);
  });
}

export default {
  init,
  show() {
    fillBranches($('hr-doc-branch'));
    lockScope($('hr-doc-branch'));
    renderStats();
    renderTable();
    renderExpiring();
  },
};
