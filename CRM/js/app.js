/* ==========================================================================
   Track_karo CRM - app shell, router and shared actions
   ========================================================================== */
(function () {
  'use strict';

  var CRM = window.CRM = window.CRM || {};

  var ROUTES = {
    dashboard: CRM.views.dashboard,
    calls: CRM.views.calls,
    customers: CRM.views.customers,
    reports: CRM.views.reports,
    blacklist: CRM.views.blacklist
  };

  var state = { route: 'dashboard' };

  function routeFromHash() {
    var name = (location.hash || '').replace(/^#\/?/, '').split(/[/?]/)[0];
    return ROUTES[name] ? name : 'dashboard';
  }

  function setActiveNav(name) {
    document.querySelectorAll('[data-route]').forEach(function (el) {
      var active = el.dataset.route === name;
      el.classList.toggle('is-active', active);
      if (active) el.setAttribute('aria-current', 'page');
      else el.removeAttribute('aria-current');
    });
  }

  function updateFollowBadge() {
    var badge = document.getElementById('nav-follow-badge');
    if (badge) {
      var count = CRM.store.followUpsDue().length;
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.hidden = !count;
    }
    var blackBadge = document.getElementById('nav-black-badge');
    if (blackBadge) {
      var blackCount = CRM.store.blacklistStats().count;
      blackBadge.textContent = blackCount > 99 ? '99+' : String(blackCount);
      blackBadge.hidden = !blackCount;
    }
  }

  function refresh() {
    var name = routeFromHash();
    var view = ROUTES[name];
    if (!view) return;
    state.route = name;

    var root = document.getElementById('app');
    if (!root) return;
    root.innerHTML = view.render();
    view.mount(root);

    setActiveNav(name);
    var titleEl = document.getElementById('page-title');
    var subEl = document.getElementById('page-sub');
    if (titleEl) titleEl.textContent = view.title || name;
    if (subEl) subEl.textContent = view.subtitle || '';
    document.title = (view.title || 'CRM') + ' - Track_karo CRM';
    updateFollowBadge();
    window.scrollTo(0, 0);
  }

  /* ---------- customer drawer ---------- */
  function openCustomer(customerId) {
    var u = CRM.ui;
    var store = CRM.store;
    var c = store.customerById(customerId);
    if (!c) return;

    var summary = store.customerSummary(c.id);
    var calls = store.callsForCustomer(c.id).slice(0, 10);

    var history = calls.length ? calls.map(function (k) {
      var o = store.outcome(k.outcome);
      var tone = o ? o.color : '#2F6DB5';
      return '<div class="tl-item" style="--tone:' + tone + '">' +
        '<div class="tl-top">' + u.outcomeBadge(k.outcome) + u.sentimentBadge(k.sentiment) +
          '<time>' + u.esc(u.fmtDateTime(k.ts)) + '</time></div>' +
        (k.feedback ? '<div class="tl-note">' + u.esc(k.feedback) + '</div>' : '') +
        '<div class="tl-sub">' + u.esc(k.agent || '') +
          (k.followUp ? ' &middot; Follow-up on ' + u.esc(u.fmtDate(k.followUp)) : '') + '</div>' +
      '</div>';
    }).join('') : u.emptyState('No calls logged for this customer yet.', 'phone');

    var blackNote = c.blacklisted
      ? '<div class="callout callout--red mt-16">' + u.icon('ban') +
          '<span class="callout-main"><strong>Blacklisted on ' + u.esc(u.fmtDateLong(c.blacklistedAt)) + '</strong>' +
          '<span>' + u.esc(c.blacklistReason || 'No reason recorded') + '</span></span></div>'
      : '';

    var body =
      '<div class="detail-head">' +
        u.avatar(c.name, 'avatar--lg') +
        '<main>' +
          '<h3>' + u.esc(c.name) + '</h3>' +
          '<p>' + u.esc(c.phone) + ' &middot; ' + u.esc(c.area) + ', ' + u.esc(c.branch) + '</p>' +
          '<div class="detail-badges">' + u.statusBadge(c) + u.badge(c.product, 'blue') + u.badge(c.language, 'slate') + '</div>' +
        '</main>' +
      '</div>' +

      '<div class="detail-meta">' +
        '<div><dt>Branch</dt><dd>' + u.esc(c.branch) + '</dd></div>' +
        '<div><dt>Assigned agent</dt><dd>' + u.esc(c.agent) + '</dd></div>' +
        '<div><dt>Product</dt><dd>' + u.esc(c.product) + '</dd></div>' +
        '<div><dt>Customer since</dt><dd>' + u.esc(u.fmtDateLong(c.createdAt)) + '</dd></div>' +
      '</div>' +

      '<div class="detail-stats">' +
        '<div class="detail-stat"><span>Calls</span><b>' + summary.calls + '</b></div>' +
        '<div class="detail-stat"><span>Answered</span><b>' + u.pct(summary.answered, summary.calls) + '</b></div>' +
        '<div class="detail-stat"><span>Positive</span><b>' + Math.round(summary.positiveRate * 100) + '%</b></div>' +
        '<div class="detail-stat"><span>Angry</span><b>' + summary.angry + '</b></div>' +
      '</div>' +

      '<div class="detail-actions">' +
        '<button type="button" class="btn btn-primary" data-drawer-log>' + u.icon('phone') + ' Log a call</button>' +
        (c.blacklisted
          ? '<button type="button" class="btn btn-ghost" data-drawer-remove>' + u.icon('refresh') + ' Remove from blacklist</button>'
          : '<button type="button" class="btn btn-ghost" data-drawer-blacklist>' + u.icon('ban') + ' Blacklist</button>') +
      '</div>' +

      blackNote +

      '<div class="section-label">Call history <span>' + summary.calls + ' total</span></div>' +
      '<div class="timeline">' + history + '</div>';

    var handle = u.openModal({
      title: 'Customer profile',
      size: 'modal--lg',
      body: body,
      footer: '<button type="button" class="btn btn-ghost" data-close-drawer>Close</button>',
      onMount: function (el, close) {
        el.querySelector('[data-close-drawer]').addEventListener('click', close);

        var logBtn = el.querySelector('[data-drawer-log]');
        if (logBtn) logBtn.addEventListener('click', function () {
          close();
          CRM.actions.openCallForm(c.id);
        });

        var blackBtn = el.querySelector('[data-drawer-blacklist]');
        if (blackBtn) blackBtn.addEventListener('click', function () {
          close();
          CRM.views.customers.openBlacklist(c.id);
        });

        var removeBtn = el.querySelector('[data-drawer-remove]');
        if (removeBtn) removeBtn.addEventListener('click', function () {
          close();
          CRM.views.customers.removeBlacklist(c.id);
        });
      }
    });

    return handle;
  }

  function resetDemo() {
    var u = CRM.ui;
    u.confirmDialog({
      title: 'Reset demo data?',
      message: 'This will replace every customer, call and blacklist entry in this browser with a fresh demo set.',
      confirmLabel: 'Reset data',
      danger: true
    }).then(function (ok) {
      if (!ok) return;
      CRM.store.reset();
      refresh();
      u.toast('Demo data reset', 'Fresh customers and calls are ready.');
    });
  }

  CRM.app = { refresh: refresh };
  CRM.actions = {
    openCallForm: function (customerId) { CRM.views.calls.openForm(customerId); },
    openFollowUps: function () { CRM.views.calls.openFollowUps(); },
    openCustomer: openCustomer,
    openAddCustomer: function () { CRM.views.customers.openAdd(); },
    openBlacklist: function (id) { CRM.views.customers.openBlacklist(id); },
    resetDemo: resetDemo
  };

  /* ---------- shell ---------- */
  function setSidebar(open) {
    var sidebar = document.getElementById('sidebar');
    var backdrop = document.getElementById('sidebar-backdrop');
    var menuBtn = document.getElementById('btn-menu');
    if (!sidebar) return;
    sidebar.classList.toggle('is-open', open);
    if (backdrop) backdrop.classList.toggle('is-open', open);
    if (menuBtn) menuBtn.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('sidebar-open', open);
  }

  function initShell() {
    var menuBtn = document.getElementById('btn-menu');
    var closeBtn = document.getElementById('btn-sidebar-close');
    var backdrop = document.getElementById('sidebar-backdrop');
    var skipLink = document.querySelector('.skip-link');

    if (skipLink) skipLink.addEventListener('click', function (e) {
      e.preventDefault();
      var app = document.getElementById('app');
      if (app) app.focus();
    });

    if (menuBtn) menuBtn.addEventListener('click', function () {
      setSidebar(!document.getElementById('sidebar').classList.contains('is-open'));
    });
    if (closeBtn) closeBtn.addEventListener('click', function () { setSidebar(false); });
    if (backdrop) backdrop.addEventListener('click', function () { setSidebar(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.getElementById('sidebar').classList.contains('is-open')) setSidebar(false);
    });

    document.querySelectorAll('[data-route]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        var route = el.dataset.route;
        if (location.hash === '#' + route) refresh();
        else location.hash = '#' + route;
        if (window.matchMedia('(max-width: 1023px)').matches) setSidebar(false);
      });
    });

    var logBtn = document.getElementById('btn-log-call');
    if (logBtn) logBtn.addEventListener('click', function () { CRM.actions.openCallForm(); });

    var fab = document.getElementById('btn-fab-call');
    if (fab) fab.addEventListener('click', function () { CRM.actions.openCallForm(); });

    var resetBtn = document.getElementById('btn-reset');
    if (resetBtn) resetBtn.addEventListener('click', resetDemo);

    window.addEventListener('hashchange', refresh);
  }

  function boot() {
    initShell();
    if (!location.hash) history.replaceState(null, '', '#dashboard');
    refresh();

    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(function () { /* UI still works without it */ });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
