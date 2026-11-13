// Settings (admin): duty & alert rules.
import { get, put } from '../api.js';
import { $, toast, toastError, withLoading, showError } from '../ui.js';
import { state } from '../state.js';

const FIELDS = {
  office_start: 'setting-office-start',
  office_end: 'setting-office-end',
  lunch_allowed_min: 'setting-lunch-allowed',
  stop_min: 'setting-stop-min',
  geofence_radius_m: 'setting-geofence-radius',
  meeting_min_officers: 'setting-meeting-officers',
  meeting_radius_m: 'setting-meeting-radius',
  meeting_min_minutes: 'setting-meeting-minutes',
  no_signal_min: 'setting-no-signal',
};
const TIME_FIELDS = new Set(['office_start', 'office_end']);
let loaded = false;

function fillForm(s) {
  for (const [key, id] of Object.entries(FIELDS)) {
    const el = $(id);
    if (!el || s[key] === undefined || s[key] === null) continue;
    el.value = TIME_FIELDS.has(key) ? String(s[key]).slice(0, 5) : String(s[key]);
  }
}

async function load() {
  const form = $('form-settings');
  form.classList.add('is-loading');
  try {
    const s = await get('/settings');
    const settings = s.settings || s;
    state.settings = { ...state.settings, ...settings };
    fillForm(state.settings);
    loaded = true;
  } catch (err) {
    toastError(err, 'Could not load settings');
  } finally {
    form.classList.remove('is-loading');
  }
}

async function save(e) {
  e.preventDefault();
  const err = $('settings-error');
  showError(err, '');
  const body = {};
  for (const [key, id] of Object.entries(FIELDS)) {
    const el = $(id);
    const v = el.value.trim();
    if (!v) { showError(err, 'Fill in every setting.'); el.focus(); return; }
    if (TIME_FIELDS.has(key)) {
      if (!/^\d{2}:\d{2}/.test(v)) { showError(err, 'Enter times as HH:MM.'); el.focus(); return; }
      body[key] = v.slice(0, 5);
    } else {
      const n = Number(v);
      const min = el.min !== '' ? Number(el.min) : 0;
      if (!Number.isFinite(n) || n < min) { showError(err, `${el.labels?.[0]?.textContent || key} must be at least ${min}.`); el.focus(); return; }
      body[key] = Math.round(n);
    }
  }
  if (body.office_end <= body.office_start) { showError(err, 'Office end must be after office start.'); $('setting-office-end').focus(); return; }
  await withLoading($('btn-save-settings'), async () => {
    try {
      const s = await put('/settings', body);
      state.settings = { ...state.settings, ...(s.settings || s || body) };
      fillForm(state.settings);
      toast('Settings saved', 'New rules apply from now on.', 'success');
    } catch (ex) {
      showError(err, ex.message);
    }
  });
}

function init() {
  $('form-settings').addEventListener('submit', save);
}

export default {
  init,
  show() { if (!loaded) load(); },
  refresh: load,
};
