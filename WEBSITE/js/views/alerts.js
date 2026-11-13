// Alerts: list with type/unread filters, mark read, mark all read; live via stream.
import { get, post } from '../api.js';
import { $, cloneTpl, fill, setEmpty, chip, label, toastError, withLoading, fmtWhen, ALERT_LABELS, ALERT_ICONS } from '../ui.js';
import { state, on, emit, setUnread } from '../state.js';

let loaded = false;
let seq = 0;

function item(a) {
  const li = cloneTpl('tpl-alert');
  li.dataset.alertId = a.id;
  li.dataset.type = a.type || '';
  const unread = !a.read_at;
  li.classList.toggle('is-unread', unread);
  fill(li, {
    type_icon: ALERT_ICONS[a.type] || '#i-bell',
    type: chip(label(ALERT_LABELS, a.type), a.type || ''),
    title: a.title,
    body: a.body,
    officer_name: a.officer_name,
    branch_name: a.branch_name,
    created_at: fmtWhen(a.created_at),
  });
  const btn = li.querySelector('[data-action="read"]');
  if (btn) btn.hidden = !unread;
  return li;
}

function matchesFilters(a) {
  const type = $('alerts-type').value;
  if (type && a.type !== type) return false;
  if ($('alerts-unread').checked && a.read_at) return false;
  return true;
}

async function load() {
  const my = ++seq;
  const ul = $('alerts-list');
  ul.classList.add('is-loading');
  try {
    const r = await get('/alerts', { type: $('alerts-type').value, unread: $('alerts-unread').checked, limit: 100 });
    if (my !== seq) return;
    ul.textContent = '';
    (r.alerts || []).forEach((a) => ul.appendChild(item(a)));
    setEmpty('alerts', ul.children.length === 0);
    if (r.unread_count !== undefined) setUnread(r.unread_count);
    loaded = true;
  } catch (err) {
    if (my === seq) toastError(err, 'Could not load alerts');
  } finally {
    if (my === seq) ul.classList.remove('is-loading');
  }
}

function markItemRead(li) {
  li.classList.remove('is-unread');
  const btn = li.querySelector('[data-action="read"]');
  if (btn) btn.hidden = true;
  if ($('alerts-unread').checked) li.remove();
}

async function markRead(li) {
  const id = li.dataset.alertId;
  const btn = li.querySelector('[data-action="read"]');
  await withLoading(btn, async () => {
    try {
      await post(`/alerts/${encodeURIComponent(id)}/read`);
      if (li.classList.contains('is-unread')) setUnread(state.unread - 1);
      markItemRead(li);
      setEmpty('alerts', $('alerts-list').children.length === 0);
      emit('alert:read', { id });
    } catch (err) {
      toastError(err, 'Could not mark the alert read');
    }
  });
}

async function markAll() {
  await withLoading($('btn-alerts-read-all'), async () => {
    try {
      await post('/alerts/read-all');
      setUnread(0);
      Array.from($('alerts-list').querySelectorAll('.alert-item')).forEach(markItemRead);
      setEmpty('alerts', $('alerts-list').children.length === 0);
      emit('alert:read', { all: true });
    } catch (err) {
      toastError(err, 'Could not mark all alerts read');
    }
  });
}

function init() {
  $('alerts-type').addEventListener('change', load);
  $('alerts-unread').addEventListener('change', load);
  $('btn-alerts-read-all').addEventListener('click', markAll);
  $('alerts-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="read"]');
    const li = btn?.closest('[data-alert-id]');
    if (li) markRead(li);
  });
  on('alert', (a) => {
    if (!loaded || !matchesFilters(a)) return;
    const ul = $('alerts-list');
    if (ul.querySelector(`[data-alert-id="${CSS.escape(String(a.id))}"]`)) return;
    ul.prepend(item(a));
    setEmpty('alerts', false);
  });
}

export default {
  init,
  show() { if (!loaded) load(); },
  refresh: load,
};
