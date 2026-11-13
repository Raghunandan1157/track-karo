// Team: users list with filters, add/edit dialog, deactivate.
import { get, post, put, del } from '../api.js';
import {
  $, cloneTpl, fill, setEmpty, chip, label, toast, toastError, withLoading, showError,
  confirmDialog, openDialog, closeDialog, ROLE_LABELS, num,
} from '../ui.js';
import { state, fillBranchSelect, lockBranchSelect, isManager, loadOfficers } from '../state.js';

let loaded = false;
let users = [];
let seq = 0;

const canManage = (u) => !isManager() || u.role === 'field_officer';

function render() {
  const tbody = $('team-table');
  tbody.textContent = '';
  for (const u of users) {
    const tr = cloneTpl('tpl-user-row');
    tr.dataset.userId = u.id;
    const active = u.active !== false && u.active !== 0;
    tr.classList.toggle('is-inactive', !active);
    fill(tr, {
      name: u.name,
      userid: u.userid,
      role: chip(label(ROLE_LABELS, u.role), u.role || ''),
      branch_name: u.branch_name,
      phone: u.phone,
      active: active ? chip('Active', 'active') : chip('Inactive', 'inactive'),
    });
    const editBtn = tr.querySelector('[data-action="edit"]');
    const deBtn = tr.querySelector('[data-action="deactivate"]');
    const self = String(u.id) === String(state.user?.id);
    if (editBtn) editBtn.hidden = !canManage(u);
    if (deBtn) deBtn.hidden = !canManage(u) || !active || self;
    tbody.appendChild(tr);
  }
  setEmpty('team', users.length === 0);
}

async function load() {
  const my = ++seq;
  const tbody = $('team-table');
  tbody.classList.add('is-loading');
  try {
    const r = await get('/users', { role: $('team-role').value, branch_id: $('team-branch').value });
    if (my !== seq) return;
    users = (r.users || []).slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    loaded = true;
    render();
  } catch (err) {
    if (my === seq) toastError(err, 'Could not load users');
  } finally {
    if (my === seq) tbody.classList.remove('is-loading');
  }
}

function syncBranchRequirement() {
  const role = $('user-role-select').value;
  const sel = $('user-branch-select');
  sel.required = role === 'branch_manager' || role === 'field_officer';
}

async function openUser(u) {
  $('form-user').reset();
  showError($('user-error'), '');
  const editing = !!u;
  $('modal-user-title').textContent = editing ? 'Edit user' : 'Add user';
  $('user-id').value = editing ? u.id : '';
  $('user-userid').value = u?.userid || '';
  $('user-userid').disabled = editing; // user ID cannot be changed
  $('user-fullname').value = u?.name || '';
  $('user-password').value = '';
  $('user-password').required = !editing;
  $('user-password').placeholder = editing ? 'Leave empty to keep current password' : '';
  $('user-password-help').textContent = editing
    ? 'Leave empty to keep the current password.'
    : 'Required for a new user (at least 6 characters).';
  const roleSel = $('user-role-select');
  roleSel.value = u?.role && Array.from(roleSel.options).some((o) => o.value === u.role) ? u.role : 'field_officer';
  roleSel.disabled = editing || isManager(); // role is fixed after creation; managers only add field officers
  try { await fillBranchSelect($('user-branch-select')); } catch { /* ignore */ }
  $('user-branch-select').value = u?.branch_id ? String(u.branch_id) : ($('team-branch').value || '');
  lockBranchSelect($('user-branch-select'));
  $('user-phone').value = u?.phone || '';
  $('user-active').checked = editing ? u.active !== false && u.active !== 0 : true;
  $('user-active').closest('label').hidden = !editing;
  syncBranchRequirement();
  openDialog($('modal-user'));
  (editing ? $('user-fullname') : $('user-userid')).focus();
}

async function saveUser(e) {
  e.preventDefault();
  const err = $('user-error');
  showError(err, '');
  const id = $('user-id').value;
  const role = $('user-role-select').value;
  const branchRaw = $('user-branch-select').value;
  const password = $('user-password').value;
  const name = $('user-fullname').value.trim();
  const userid = $('user-userid').value.trim();
  if (!id && !userid) { showError(err, 'Enter a user ID.'); $('user-userid').focus(); return; }
  if (!name) { showError(err, 'Enter the name.'); $('user-fullname').focus(); return; }
  if (!id && !password) { showError(err, 'Enter a password for the new user.'); $('user-password').focus(); return; }
  if (password && password.length < 6) { showError(err, 'Password must be at least 6 characters.'); $('user-password').focus(); return; }
  if ((role === 'branch_manager' || role === 'field_officer') && !branchRaw) {
    showError(err, 'Select a branch.'); $('user-branch-select').focus(); return;
  }
  const branch_id = branchRaw ? (num(branchRaw) ?? branchRaw) : null;
  const phone = $('user-phone').value.trim();
  await withLoading($('btn-save-user'), async () => {
    try {
      if (id) {
        const body = { name, branch_id, phone, active: $('user-active').checked };
        if (password) body.password = password;
        await put(`/users/${encodeURIComponent(id)}`, body);
      } else {
        await post('/users', { userid, name, password, role, branch_id, phone });
      }
      closeDialog($('modal-user'));
      toast(id ? 'User updated' : 'User added', name, 'success');
      if (role === 'field_officer') loadOfficers(true).catch(() => {});
      load();
    } catch (ex) {
      showError(err, ex.message);
    }
  });
}

async function deactivate(u) {
  const ok = await confirmDialog({
    title: 'Deactivate user?',
    message: `${u.name} (${u.userid}) will no longer be able to sign in.`,
    okText: 'Deactivate',
  });
  if (!ok) return;
  try {
    await del(`/users/${encodeURIComponent(u.id)}`);
    toast('User deactivated', u.name, 'success');
    load();
  } catch (err) {
    toastError(err, 'Could not deactivate the user');
  }
}

function init() {
  $('team-role').addEventListener('change', load);
  $('team-branch').addEventListener('change', load);
  $('btn-add-user').addEventListener('click', () => openUser(null));
  $('form-user').addEventListener('submit', saveUser);
  $('user-role-select').addEventListener('change', syncBranchRequirement);
  $('team-table').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    const tr = btn?.closest('tr[data-user-id]');
    if (!tr) return;
    const u = users.find((x) => String(x.id) === tr.dataset.userId);
    if (!u) return;
    if (btn.dataset.action === 'edit') openUser(u);
    if (btn.dataset.action === 'deactivate') deactivate(u);
  });
}

export default {
  init,
  async show() {
    if (loaded) return;
    loaded = true;
    try { await fillBranchSelect($('team-branch')); } catch { /* ignore */ }
    await load();
  },
  refresh: load,
};
