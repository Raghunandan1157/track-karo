// Track_karo admin website - entry point (app.html).
import { getToken, getStoredUser, saveUser, get, logoutAndRedirect, clearAuth, isDemoSession } from './api.js';
import { $, $$, initDialogs, initConfirm, toast, label, ROLE_LABELS, ALERT_LABELS } from './ui.js';
import { state, on, setUnread, bumpUnread, fillBranchSelect } from './state.js';
import { startStream, stopStream } from './stream.js';

import dashboard from './views/dashboard.js';
import live from './views/live.js';
import replay from './views/replay.js';
import tasks from './views/tasks.js';
import reports from './views/reports.js';
import alerts from './views/alerts.js';
import customers from './views/customers.js';
import team from './views/team.js';
import branches from './views/branches.js';
import settings from './views/settings.js';
import recovery from './views/recovery.js';
import recoveryCases from './views/recovery-cases.js';
import recoveryCase from './views/recovery-case.js';
import recoveryNotices from './views/recovery-notices.js';
import recoverySettlements from './views/recovery-settlements.js';
import recoveryReports from './views/recovery-reports.js';
import recoveryStages from './views/recovery-stages.js';

const VIEWS = {
  dashboard, live, replay, tasks, reports, alerts, customers, team, branches, settings,
  recovery,
  'recovery-cases': recoveryCases,
  'recovery-case': recoveryCase,
  'recovery-notices': recoveryNotices,
  'recovery-settlements': recoverySettlements,
  'recovery-reports': recoveryReports,
  'recovery-stages': recoveryStages,
};
const WEB_ROLES = ['admin', 'branch_manager', 'recovery_manager'];
const MOBILE_QUERY = window.matchMedia('(max-width: 900px)');

// ---------- auth ----------
if (!getToken()) {
  location.replace('index.html');
  throw new Error('Not signed in');
}

function applyUser(user) {
  state.user = user;
  document.body.dataset.role = user?.role || '';
  $('user-name').textContent = user?.name || user?.userid || '';
  $('user-role').textContent = label(ROLE_LABELS, user?.role);
  const branchEl = $('user-branch');
  branchEl.textContent = user?.branch_name || '';
  branchEl.hidden = !user?.branch_name;
}

/** Remove elements whose data-roles does not include the current role. */
function applyRoleGating() {
  const role = state.user?.role;
  for (const el of $$('[data-roles]')) {
    const roles = el.dataset.roles.split(/[\s,]+/).filter(Boolean);
    if (roles.includes(role)) continue;
    if (el.classList.contains('view')) { el.hidden = true; el.dataset.removed = 'true'; continue; }
    el.remove();
  }
  // The recovery manager desk is scoped to the recovery module only.
  if (role === 'recovery_manager') {
    for (const sec of $$('.view')) {
      if (String(sec.dataset.view || '').startsWith('recovery')) continue;
      sec.hidden = true;
      sec.dataset.removed = 'true';
    }
    for (const btn of $$('.nav-item[data-view]')) {
      if (!String(btn.dataset.view || '').startsWith('recovery')) btn.remove();
    }
    $('btn-bell')?.remove();
    $('live-status')?.remove();
  }
}

const defaultView = () => (state.user?.role === 'recovery_manager' ? 'recovery' : 'dashboard');

/** The recovery desk uses the society's own logo; the rest of the app keeps Track_karo branding. */
function applyBrand(viewName) {
  const recovery = String(viewName || '').startsWith('recovery');
  const logo = document.querySelector('.sidebar-logo');
  const brand = document.querySelector('.sidebar-brand');
  if (!logo || !brand) return;
  logo.src = recovery ? 'assets/hccs-logo.png' : 'assets/logo.png';
  logo.alt = recovery ? 'HINDUSTHAN Co-op Credit Society Ltd' : 'Track_karo logo';
  logo.classList.toggle('is-recovery-logo', recovery);
  brand.classList.toggle('is-recovery-brand', recovery);
}

const viewAllowed = (name) => {
  const sec = $('view-' + name);
  return !!VIEWS[name] && !!sec && sec.dataset.removed !== 'true';
};

// ---------- sidebar ----------
function setSidebar(open) {
  $('sidebar').classList.toggle('is-open', open);
  $('sidebar-backdrop').classList.toggle('is-open', open);
  $('sidebar-backdrop').hidden = !open;
  $('btn-menu').setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('sidebar-open', open);
}

// ---------- router ----------
function routeFromHash() {
  const name = (location.hash || '').replace(/^#\/?/, '').split(/[/?]/)[0];
  return viewAllowed(name) ? name : defaultView();
}

function showView(name) {
  const prev = state.currentView;
  if (prev && prev !== name) VIEWS[prev]?.hide?.();
  state.currentView = name;
  for (const sec of $$('.view')) sec.hidden = sec.dataset.view !== name;
  for (const btn of $$('.nav-item[data-view]')) {
    const active = btn.dataset.view === name;
    btn.classList.toggle('is-active', active);
    if (active) btn.setAttribute('aria-current', 'page'); else btn.removeAttribute('aria-current');
  }
  const navLabel = document.querySelector(`.nav-item[data-view="${name}"] .nav-label`);
  const title = navLabel ? navLabel.textContent.trim() : name;
  $('page-title').textContent = title;
  document.title = `${title} - Track_karo`;
  applyBrand(name);
  if (MOBILE_QUERY.matches) setSidebar(false);
  $('content')?.scrollTo?.(0, 0);

  const view = VIEWS[name];
  Promise.resolve()
    .then(() => view.show?.())
    .catch((err) => console.error(`view ${name}`, err));
}

function onHashChange() {
  const name = routeFromHash();
  if (location.hash && location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
  showView(name);
}

// ---------- alerts from the stream ----------
function onStreamAlert(a) {
  if (!a) return;
  if (!a.read_at) bumpUnread(1);
  const typeLabel = label(ALERT_LABELS, a.type);
  const who = [a.officer_name, a.branch_name].filter(Boolean).join(' · ');
  const t = toast(a.title || typeLabel, [a.body, who].filter(Boolean).join(' - '), 'alert');
  if (t) t.addEventListener('click', () => { location.hash = '#alerts'; });
  if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
    try {
      const n = new Notification(`Track_karo: ${a.title || typeLabel}`, {
        body: [a.body, who].filter(Boolean).join('\n'),
        icon: 'assets/logo.png',
        tag: `tk-alert-${a.id}`,
      });
      n.onclick = () => { window.focus(); location.hash = '#alerts'; n.close(); };
    } catch { /* some browsers only allow notifications from a service worker */ }
  }
}

// ---------- boot ----------
async function refreshMe() {
  try {
    const r = await get('/me');
    if (r.user) {
      if (!WEB_ROLES.includes(r.user.role)) {
        clearAuth();
        location.replace('index.html');
        return false;
      }
      saveUser(r.user);
      applyUser(r.user);
    }
    if (r.settings) state.settings = { ...state.settings, ...r.settings };
    return true;
  } catch (err) {
    if (err.status === 401) return false;
    toast('Could not refresh your profile', err.message, 'error');
    return !!state.user;
  }
}

async function boot() {
  initDialogs();
  initConfirm();

  const demo = isDemoSession();
  const stored = getStoredUser();
  if (stored) applyUser(stored);
  const ok = demo ? true : await refreshMe();
  if (!ok || !state.user) { if (!state.user) logoutAndRedirect(); return; }
  if (!WEB_ROLES.includes(state.user.role)) { logoutAndRedirect(); return; }
  applyRoleGating();

  for (const [name, v] of Object.entries(VIEWS)) {
    if (!viewAllowed(name)) continue;
    try { v.init?.(); } catch (err) { console.error(`init ${name}`, err); }
  }

  // Navigation
  for (const btn of $$('.nav-item[data-view]')) {
    btn.addEventListener('click', () => {
      const name = btn.dataset.view;
      if (location.hash === '#' + name) showView(name);
      else location.hash = '#' + name;
    });
  }
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-view-link]');
    if (!link) return;
    e.preventDefault();
    location.hash = '#' + link.dataset.viewLink;
  });
  window.addEventListener('hashchange', onHashChange);

  // Sidebar (mobile)
  $('btn-menu').addEventListener('click', () => setSidebar(!$('sidebar').classList.contains('is-open')));
  $('btn-sidebar-close').addEventListener('click', () => setSidebar(false));
  $('sidebar-backdrop').addEventListener('click', () => setSidebar(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('sidebar').classList.contains('is-open')) setSidebar(false);
  });
  MOBILE_QUERY.addEventListener?.('change', (e) => { if (!e.matches) setSidebar(false); });

  // Bell: ask for notification permission on first click, then go to alerts.
  $('btn-bell')?.addEventListener('click', () => {
    if ('Notification' in window && Notification.permission === 'default') {
      try { Notification.requestPermission().catch(() => {}); } catch { /* old Safari: callback form */ }
    }
    location.hash = '#alerts';
  });

  // Logout
  $('btn-logout').addEventListener('click', () => {
    stopStream();
    logoutAndRedirect();
  });

  // Stream events handled app-wide
  on('alert', onStreamAlert);
  on('stream:resume', () => {
    const v = VIEWS[state.currentView];
    if (v?.refresh) Promise.resolve(v.refresh()).catch(() => {});
    refreshUnread();
  });
  on('branches:changed', () => {
    for (const id of ['live-branch-filter', 'reports-branch', 'customers-branch', 'team-branch']) {
      fillBranchSelect($(id)).catch(() => {});
    }
  });

  onHashChange();
  if (!demo) {
    refreshUnread();
    startStream();
  }
}

async function refreshUnread() {
  try {
    const r = await get('/alerts', { unread: 1, limit: 1 });
    if (r.unread_count !== undefined) setUnread(r.unread_count);
  } catch { /* badge stays as is */ }
}

boot().catch((err) => {
  console.error(err);
  toast('Could not start', err.message || String(err), 'error');
});
