// HR employees: directory, filters, profile drawer and add/edit form.
import {
  $, cloneTpl, fill, setEmpty, toast, toastError, withLoading, showError,
  openDialog, closeDialog, confirmDialog, downloadCsv, debounce, fmtDay, num,
} from '../../ui.js';
import {
  employees, employee, upsertEmployee, setEmployeeStatus,
  departments, branches, shifts, managerName, departmentName, branchName, shiftName,
  typeName, statusName, documentTypes, documents, documentStatus,
  employeeMonthSummary, attendanceForEmployee,
} from '../store.js';
import { salaryStructure, monthKey, ymd } from '../seed.js';
import { hrScope, personCell, avatar, money, hrChip, fillBranches, fillDepartments, lockScope } from '../ui.js';

let rows = [];
let current = null;

const statusOf = (e) => (e.status === 'active' ? 'active' : e.status === 'inactive' ? 'inactive' : e.status);

function currentFilters() {
  return {
    q: $('hr-emp-q')?.value || '',
    department: $('hr-emp-dept')?.value || '',
    branch_id: $('hr-emp-branch')?.value || hrScope() || '',
    status: $('hr-emp-status')?.value || '',
  };
}

function render() {
  const tbody = $('hr-emp-table');
  if (!tbody) return;
  tbody.textContent = '';
  for (const e of rows) {
    const tr = cloneTpl('tpl-hr-employee-row');
    tr.dataset.empId = e.id;
    const person = tr.querySelector('[data-field="person"]');
    if (person) person.appendChild(personCell(e));
    fill(tr, {
      designation: e.designation,
      department: departmentName(e.department),
      branch: branchName(e.branch_id),
      doj: fmtDay(e.doj),
      type: typeName(e.employment_type),
      status: hrChip(statusName(e.status), statusOf(e)),
      tenure: tenure(e.doj),
    });
    tbody.appendChild(tr);
  }
  setEmpty('hr-emp', rows.length === 0);
  const count = $('hr-emp-count');
  if (count) count.textContent = `${rows.length} employee${rows.length === 1 ? '' : 's'}`;
}

export function tenure(doj) {
  if (!doj) return '-';
  const start = new Date(doj + 'T12:00:00');
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  if (months < 0) return 'Joining soon';
  const y = Math.floor(months / 12);
  const m = months % 12;
  return y ? `${y}y ${m}m` : `${m}m`;
}

export function load() {
  const f = currentFilters();
  if (!f.branch_id && hrScope()) f.branch_id = hrScope();
  rows = employees(f);
  render();
}

function fillFormOptions() {
  const branchSel = $('hr-emp-branch-input');
  if (branchSel) {
    branchSel.textContent = '';
    for (const b of branches().filter((b) => !hrScope() || String(b.id) === String(hrScope()))) {
      const o = document.createElement('option');
      o.value = String(b.id);
      o.textContent = b.name;
      branchSel.appendChild(o);
    }
  }
  const deptSel = $('hr-emp-dept-input');
  if (deptSel) {
    deptSel.textContent = '';
    for (const d of departments()) {
      const o = document.createElement('option');
      o.value = d.key;
      o.textContent = d.name;
      deptSel.appendChild(o);
    }
  }
  const shiftSel = $('hr-emp-shift');
  if (shiftSel) {
    shiftSel.textContent = '';
    for (const s of shifts()) {
      const o = document.createElement('option');
      o.value = String(s.id);
      o.textContent = `${s.name} (${s.start}-${s.end})`;
      shiftSel.appendChild(o);
    }
  }
  const mgrSel = $('hr-emp-manager');
  if (mgrSel) {
    mgrSel.textContent = '';
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = 'No manager';
    mgrSel.appendChild(blank);
    for (const m of employees().filter((e) => e.status !== 'inactive')) {
      if (current && String(m.id) === String(current.id)) continue;
      const o = document.createElement('option');
      o.value = String(m.id);
      o.textContent = `${m.name} (${m.emp_code})`;
      mgrSel.appendChild(o);
    }
  }
}

function openForm(emp) {
  current = emp || null;
  const form = $('form-hr-employee');
  if (!form) return;
  form.reset();
  showError($('hr-emp-error'), '');
  fillFormOptions();
  $('modal-hr-employee-title').textContent = emp ? 'Edit employee' : 'Add employee';
  $('hr-emp-id').value = emp?.id || '';
  const set = (id, v) => { const el = $(id); if (el) el.value = v ?? ''; };
  set('hr-emp-name', emp?.name);
  set('hr-emp-email', emp?.email);
  set('hr-emp-phone', emp?.phone);
  set('hr-emp-dob', emp?.dob);
  set('hr-emp-gender', emp?.gender || 'male');
  set('hr-emp-blood', emp?.blood_group);
  set('hr-emp-marital', emp?.marital_status || 'single');
  set('hr-emp-address', emp?.address);
  set('hr-emp-city', emp?.city);
  set('hr-emp-state', emp?.state || 'Karnataka');
  set('hr-emp-pincode', emp?.pincode);
  set('hr-emp-emergency-name', emp?.emergency_name);
  set('hr-emp-emergency-relation', emp?.emergency_relation);
  set('hr-emp-emergency-phone', emp?.emergency_phone);
  set('hr-emp-branch-input', emp?.branch_id || hrScope() || branches()[0]?.id);
  set('hr-emp-dept-input', emp?.department || departments()[0]?.key);
  set('hr-emp-designation', emp?.designation);
  set('hr-emp-manager', emp?.manager_id || '');
  set('hr-emp-doj', emp?.doj || ymd(new Date()));
  set('hr-emp-type', emp?.employment_type || 'full_time');
  set('hr-emp-status-input', emp?.status || 'probation');
  set('hr-emp-mode', emp?.work_mode || 'office');
  set('hr-emp-shift', emp?.shift_id || 1);
  set('hr-emp-ctc', emp?.ctc || '');
  set('hr-emp-pan', emp?.pan);
  set('hr-emp-aadhaar', emp?.aadhaar_last4);
  set('hr-emp-uan', emp?.uan);
  set('hr-emp-esic', emp?.esic);
  set('hr-emp-pf', emp?.pf_no);
  set('hr-emp-bank', emp?.bank_name);
  set('hr-emp-account', emp?.bank_account_last4);
  set('hr-emp-ifsc', emp?.ifsc);
  openDialog($('modal-hr-employee'));
  $('hr-emp-name').focus();
}

async function save(e) {
  e.preventDefault();
  const err = $('hr-emp-error');
  showError(err, '');
  const name = $('hr-emp-name').value.trim();
  const email = $('hr-emp-email').value.trim();
  const designation = $('hr-emp-designation').value.trim();
  const ctc = num($('hr-emp-ctc').value);
  if (!name) { showError(err, 'Enter the full name.'); $('hr-emp-name').focus(); return; }
  if (!designation) { showError(err, 'Enter the designation.'); $('hr-emp-designation').focus(); return; }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { showError(err, 'Enter a valid email address.'); $('hr-emp-email').focus(); return; }
  if (ctc === null || ctc <= 0) { showError(err, 'Enter the annual CTC.'); $('hr-emp-ctc').focus(); return; }

  const payload = {
    id: $('hr-emp-id').value || undefined,
    name,
    email,
    phone: $('hr-emp-phone').value.trim(),
    dob: $('hr-emp-dob').value,
    gender: $('hr-emp-gender').value,
    blood_group: $('hr-emp-blood').value,
    marital_status: $('hr-emp-marital').value,
    address: $('hr-emp-address').value.trim(),
    city: $('hr-emp-city').value.trim(),
    state: $('hr-emp-state').value.trim(),
    pincode: $('hr-emp-pincode').value.trim(),
    emergency_name: $('hr-emp-emergency-name').value.trim(),
    emergency_relation: $('hr-emp-emergency-relation').value,
    emergency_phone: $('hr-emp-emergency-phone').value.trim(),
    branch_id: $('hr-emp-branch-input').value,
    department: $('hr-emp-dept-input').value,
    designation,
    manager_id: $('hr-emp-manager').value || null,
    doj: $('hr-emp-doj').value,
    employment_type: $('hr-emp-type').value,
    status: $('hr-emp-status-input').value,
    work_mode: $('hr-emp-mode').value,
    shift_id: $('hr-emp-shift').value,
    ctc,
    pan: $('hr-emp-pan').value.trim().toUpperCase(),
    aadhaar_last4: $('hr-emp-aadhaar').value.trim().slice(-4),
    uan: $('hr-emp-uan').value.trim(),
    esic: $('hr-emp-esic').value.trim(),
    pf_no: $('hr-emp-pf').value.trim(),
    bank_name: $('hr-emp-bank').value,
    bank_account_last4: $('hr-emp-account').value.trim().slice(-4),
    ifsc: $('hr-emp-ifsc').value.trim().toUpperCase(),
  };
  await withLoading($('btn-hr-save-employee'), async () => {
    try {
      const saved = upsertEmployee(payload);
      closeDialog($('modal-hr-employee'));
      toast(payload.id ? 'Employee updated' : 'Employee added', `${saved.name} · ${saved.emp_code}`, 'success');
      load();
      if (!$('modal-hr-profile').open) return;
      openProfile(saved);
    } catch (ex) {
      showError(err, ex.message);
    }
  });
}

// ---------- profile ----------
function infoList(container, rowsData) {
  if (!container) return;
  container.textContent = '';
  for (const [label, value] of rowsData) {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value === '' || value === null || value === undefined ? '-' : String(value);
    container.append(dt, dd);
  }
}

function profileTab(name) {
  for (const btn of document.querySelectorAll('[data-hr-tab]')) btn.setAttribute('aria-selected', String(btn.dataset.hrTab === name));
  for (const panel of document.querySelectorAll('[data-hr-panel]')) panel.hidden = panel.dataset.hrPanel !== name;
}

function openProfile(emp) {
  if (!emp) return;
  const dlg = $('modal-hr-profile');
  if (!dlg) return;
  dlg.dataset.empId = emp.id;
  const head = $('hr-profile-head');
  if (head) {
    head.textContent = '';
    head.appendChild(avatar(emp, 'avatar avatar-lg'));
    const box = document.createElement('div');
    box.className = 'profile-head-text';
    const h = document.createElement('h2');
    h.textContent = emp.name;
    const meta = document.createElement('p');
    meta.className = 'profile-meta';
    meta.textContent = `${emp.designation} · ${departmentName(emp.department)} · ${branchName(emp.branch_id)}`;
    const chips = document.createElement('p');
    chips.className = 'profile-chips';
    for (const [text, value] of [[statusName(emp.status), statusOf(emp)], [emp.emp_code, ''], [typeName(emp.employment_type), '']]) {
      const c = document.createElement('span');
      c.className = 'chip';
      if (value) c.dataset.value = value;
      c.textContent = text;
      chips.appendChild(c);
    }
    box.append(h, meta, chips);
    head.appendChild(box);
  }

  infoList($('hr-profile-overview'), [
    ['Employee code', emp.emp_code], ['Work email', emp.email], ['Phone', emp.phone],
    ['Date of birth', fmtDay(emp.dob)], ['Gender', emp.gender], ['Blood group', emp.blood_group],
    ['Marital status', emp.marital_status], ['Address', [emp.address, emp.city, emp.state, emp.pincode].filter(Boolean).join(', ')],
    ['Emergency contact', emp.emergency_name], ['Relation', emp.emergency_relation], ['Emergency phone', emp.emergency_phone],
  ]);

  infoList($('hr-profile-job'), [
    ['Designation', emp.designation], ['Department', departmentName(emp.department)], ['Branch', branchName(emp.branch_id)],
    ['Reports to', managerName(emp)], ['Date of joining', fmtDay(emp.doj)], ['Tenure', tenure(emp.doj)],
    ['Employment type', typeName(emp.employment_type)], ['Work mode', emp.work_mode], ['Shift', shiftName(emp.shift_id)],
    ['Status', statusName(emp.status)],
  ]);

  const st = salaryStructure(emp);
  infoList($('hr-profile-pay'), [
    ['Annual CTC', money(emp.ctc)], ['Monthly gross', money(st.gross)],
    ['Basic', money(st.basic)], ['HRA', money(st.hra)], ['Conveyance', money(st.conveyance)], ['Special allowance', money(st.special)],
    ['Employee PF', money(st.pf)], ['Professional tax', money(st.pt)], ['TDS (monthly)', money(st.tds)],
    ['PAN', emp.pan], ['Aadhaar', emp.aadhaar_last4 ? `XXXX XXXX ${emp.aadhaar_last4}` : ''], ['UAN', emp.uan], ['ESIC', emp.esic], ['PF number', emp.pf_no],
    ['Bank', emp.bank_name], ['Account', emp.bank_account_last4 ? `XXXX${emp.bank_account_last4}` : ''], ['IFSC', emp.ifsc],
  ]);

  const docsBox = $('hr-profile-docs');
  if (docsBox) {
    docsBox.textContent = '';
    const list = documents({ employee_id: emp.id });
    if (!list.length) {
      const p = document.createElement('p');
      p.className = 'empty-state';
      p.textContent = 'No documents on file.';
      docsBox.appendChild(p);
    }
    for (const d of list) {
      const row = document.createElement('div');
      row.className = 'doc-row';
      const main = document.createElement('div');
      main.className = 'doc-main';
      const t = document.createElement('strong');
      t.textContent = documentTypes()[d.type] || d.type;
      const s = document.createElement('span');
      s.className = 'muted';
      s.textContent = `${d.number || 'No number'}${d.expires_on ? ` · expires ${fmtDay(d.expires_on)}` : ' · no expiry'}`;
      main.append(t, s);
      const chip = document.createElement('span');
      chip.className = 'chip';
      const status = documentStatus(d);
      chip.dataset.value = status;
      chip.textContent = status === 'valid' ? 'Valid' : status === 'expiring' ? 'Expiring' : 'Expired';
      row.append(main, chip);
      docsBox.appendChild(row);
    }
  }

  const month = monthKey(new Date());
  const sum = employeeMonthSummary(emp, month);
  const attBox = $('hr-profile-att');
  if (attBox) {
    attBox.textContent = '';
    const summary = document.createElement('div');
    summary.className = 'mini-stats';
    const cells = [
      ['Attendance', `${sum.attendance_pct}%`], ['Present', sum.present], ['Late', sum.late],
      ['Leave', sum.leave], ['Absent', sum.absent], ['Overtime', `${Math.round(sum.ot_min / 60)}h`],
    ];
    for (const [k, v] of cells) {
      const cell = document.createElement('div');
      cell.className = 'mini-stat';
      const a = document.createElement('span');
      a.textContent = k;
      const b = document.createElement('strong');
      b.textContent = v;
      cell.append(a, b);
      summary.appendChild(cell);
    }
    attBox.appendChild(summary);
    const table = document.createElement('table');
    table.className = 'table table-sm';
    table.innerHTML = '<thead><tr><th>Date</th><th>Status</th><th>In</th><th>Out</th><th>Worked</th><th>OT</th></tr></thead>';
    const tbody = document.createElement('tbody');
    for (const rec of attendanceForEmployee(emp.id, month).slice(0, 12)) {
      const tr = document.createElement('tr');
      const cellsData = [
        fmtDay(rec.date), rec.status.replace('_', ' '), rec.in || '-', rec.out || '-',
        rec.worked_min ? `${Math.floor(rec.worked_min / 60)}h ${rec.worked_min % 60}m` : '-',
        rec.ot_min ? `${rec.ot_min}m` : '-',
      ];
      for (const c of cellsData) {
        const td = document.createElement('td');
        td.textContent = c;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    attBox.appendChild(table);
  }

  profileTab('overview');
  openDialog(dlg);
}

// ---------- export ----------
function exportCsv() {
  const head = ['Code', 'Name', 'Designation', 'Department', 'Branch', 'Email', 'Phone', 'DOJ', 'Type', 'Status', 'CTC'];
  const body = rows.map((e) => [
    e.emp_code, e.name, e.designation, departmentName(e.department), branchName(e.branch_id),
    e.email, e.phone, e.doj, typeName(e.employment_type), statusName(e.status), e.ctc,
  ]);
  downloadCsv(`track-karo-employees-${ymd(new Date())}.csv`, [head, ...body]);
}

function init() {
  fillBranches($('hr-emp-branch'));
  lockScope($('hr-emp-branch'));
  fillDepartments($('hr-emp-dept'));
  fillFormOptions();
  const re = debounce(load, 250);
  $('hr-emp-q')?.addEventListener('input', re);
  for (const id of ['hr-emp-dept', 'hr-emp-branch', 'hr-emp-status']) $(id)?.addEventListener('change', load);
  $('btn-hr-add-employee')?.addEventListener('click', () => openForm(null));
  $('btn-hr-emp-export')?.addEventListener('click', exportCsv);
  $('form-hr-employee')?.addEventListener('submit', save);
  $('hr-emp-table')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    const tr = btn?.closest('tr[data-emp-id]');
    if (!tr) return;
    const emp = employee(tr.dataset.empId);
    if (!emp) return;
    if (btn.dataset.action === 'view') openProfile(emp);
    if (btn.dataset.action === 'edit') openForm(emp);
  });
  $('btn-hr-profile-edit')?.addEventListener('click', () => {
    const dlg = $('modal-hr-profile');
    const emp = employee(dlg?.dataset.empId);
    closeDialog(dlg);
    if (emp) openForm(emp);
  });
  for (const btn of document.querySelectorAll('[data-hr-tab]')) {
    btn.addEventListener('click', () => profileTab(btn.dataset.hrTab));
  }
  $('btn-hr-emp-deactivate')?.addEventListener('click', async () => {
    const dlg = $('modal-hr-profile');
    const emp = employee(dlg?.dataset.empId);
    if (!emp) return;
    const ok = await confirmDialog({
      title: 'Mark employee inactive?',
      message: `${emp.name} (${emp.emp_code}) will be removed from active headcount.`,
      okText: 'Mark inactive',
    });
    if (!ok) return;
    setEmployeeStatus(emp.id, 'inactive');
    closeDialog(dlg);
    toast('Employee marked inactive', emp.name, 'success');
    load();
  });
}

export default {
  init,
  show() {
    fillBranches($('hr-emp-branch'));
    lockScope($('hr-emp-branch'));
    fillDepartments($('hr-emp-dept'));
    fillFormOptions();
    load();
  },
};
