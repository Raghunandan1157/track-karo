/* ==========================================================================
   Track_karo CRM - Blacklist view
   ========================================================================== */
(function () {
  'use strict';

  var CRM = window.CRM = window.CRM || {};
  CRM.views = CRM.views || {};

  var state = { q: '', branch: '' };

  function blacklistRows() {
    var u = CRM.ui;
    var store = CRM.store;
    var q = state.q.trim().toLowerCase();
    var list = store.blacklistStats().list.filter(function (c) {
      if (state.branch && c.branch !== state.branch) return false;
      if (q) {
        var hay = (c.name + ' ' + c.phone + ' ' + c.area + ' ' + c.branch + ' ' + (c.blacklistReason || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    }).sort(function (a, b) { return Date.parse(b.blacklistedAt || 0) - Date.parse(a.blacklistedAt || 0); });

    if (!list.length) return u.emptyState('No blacklisted customers match this filter.', 'ban');

    return '<div class="card"><div class="card-body card-body--flush"><div class="cust-list">' + list.map(function (c) {
      var summary = store.customerSummary(c.id);
      return '<div class="cust-row" data-customer="' + u.esc(c.id) + '">' +
        u.avatar(c.name) +
        '<div class="cust-main">' +
          '<div class="cust-name"><span>' + u.esc(c.name) + '</span>' + u.badge('Blacklisted', 'red') + '</div>' +
          '<span class="cust-meta">' + u.esc(c.phone) + ' &middot; ' + u.esc(c.area) + '</span>' +
          '<span class="cust-meta" style="color:var(--red)">' + u.esc(c.blacklistReason || 'No reason recorded') + '</span>' +
          '<span class="cust-mobile-tags">' + u.badge('Since ' + u.fmtDate(c.blacklistedAt), 'red') +
            '<span class="cust-mobile-stat">' + summary.calls + ' calls &middot; ' + Math.round(summary.positiveRate * 100) + '% positive</span></span>' +
        '</div>' +
        '<div class="cust-branch"><b>' + u.esc(c.branch) + '</b>' + u.esc(c.agent) + '</div>' +
        '<div class="cust-stat"><b>Since ' + u.esc(u.fmtDate(c.blacklistedAt)) + '</b>' + summary.calls + ' calls</div>' +
        '<div class="cust-stat"><b>' + Math.round(summary.positiveRate * 100) + '%</b>positive</div>' +
        '<div class="cust-actions">' +
          '<button type="button" class="icon-btn" data-view-profile="' + u.esc(c.id) + '" title="View profile" aria-label="View ' + u.esc(c.name) + '">' + u.icon('arrow') + '</button>' +
          '<button type="button" class="icon-btn" data-remove-blacklist="' + u.esc(c.id) + '" title="Remove from blacklist" aria-label="Remove ' + u.esc(c.name) + ' from blacklist">' + u.icon('refresh') + '</button>' +
        '</div>' +
      '</div>';
    }).join('') + '</div></div></div>';
  }

  function resultMarkup() {
    var u = CRM.ui;
    var total = CRM.store.customers.filter(function (c) { return !state.branch || c.branch === state.branch; }).length;
    var count = CRM.store.blacklistStats().list.filter(function (c) { return !state.branch || c.branch === state.branch; }).length;
    return '<div class="filter-summary"><span><strong>' + count + '</strong> of ' + total + ' customers blacklisted</span>' +
      '<span class="faint">' + u.pct(count, total, 1) + ' of customer base</span></div>' + blacklistRows();
  }

  function render() {
    var u = CRM.ui;
    var store = CRM.store;
    var black = store.blacklistStats();
    var suggestions = store.suggestedForReview().filter(function (item) {
      return !state.branch || item.customer.branch === state.branch;
    });

    var branchOptions = '<option value="">All branches</option>' + store.BRANCHES.map(function (b) {
      return '<option value="' + u.esc(b) + '"' + (state.branch === b ? ' selected' : '') + '>' + u.esc(b) + '</option>';
    }).join('');

    var suggestionMarkup = suggestions.length
      ? '<div class="mini-list">' + suggestions.map(function (item) {
          var c = item.customer;
          return '<div class="mini-item">' +
            u.avatar(c.name, 'avatar--sm') +
            '<main><strong>' + u.esc(c.name) + ' &middot; ' + item.angryCount + ' angry calls</strong>' +
              '<span>' + u.esc(item.latest.feedback || '') + '</span></main>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-view="' + u.esc(c.id) + '">View</button>' +
            '<button type="button" class="btn btn-danger btn-sm" data-blacklist="' + u.esc(c.id) + '">Blacklist</button>' +
          '</div>';
        }).join('') + '</div>'
      : u.emptyState('No customers need review right now.', 'check');

    return '<section class="page">' +
      '<div class="page-head">' +
        '<div><h2>Blacklist</h2><p>Customers marked do-not-call, and customers with repeated angry responses.</p></div>' +
        '<div class="page-actions">' +
          '<button type="button" class="btn btn-ghost" data-export-blacklist>' + u.icon('download') + '<span>Export list</span></button>' +
        '</div>' +
      '</div>' +

      '<div class="kpi-grid kpi-grid--3">' +
        '<article class="kpi kpi--red"><div class="kpi-top"><span class="kpi-label">Blacklisted customers</span><span class="kpi-icon">' + u.icon('ban') + '</span></div><div class="kpi-value">' + black.count + '</div><div class="kpi-sub">Do-not-call list</div></article>' +
        '<article class="kpi kpi--amber"><div class="kpi-top"><span class="kpi-label">Share of customers</span><span class="kpi-icon">' + u.icon('chart') + '</span></div><div class="kpi-value">' + u.pct(black.count, black.total, 1) + '</div><div class="kpi-sub">' + black.count + ' of ' + black.total + ' customers</div></article>' +
        '<article class="kpi kpi--purple"><div class="kpi-top"><span class="kpi-label">Added this month</span><span class="kpi-icon">' + u.icon('calendar') + '</span></div><div class="kpi-value">' + black.thisMonth + '</div><div class="kpi-sub">New blacklist entries</div></article>' +
      '</div>' +

      '<div class="card mt-16">' +
        '<div class="card-head"><div><div class="card-title">Needs review</div><div class="card-sub">Active customers with 2 or more angry calls in the last 30 days</div></div>' +
          u.badge(String(suggestions.length) + ' suggested', suggestions.length ? 'red' : 'green') + '</div>' +
        '<div class="card-body">' + suggestionMarkup + '</div>' +
      '</div>' +

      '<div class="filter-bar mt-16">' +
        '<div class="field search-field"><label for="black-q">Search</label>' +
          '<div class="input-wrap">' + u.icon('search') + '<input id="black-q" class="input" type="search" placeholder="Name, phone, area or reason" value="' + u.esc(state.q) + '"></div>' +
        '</div>' +
        '<div class="field"><label for="black-branch">Branch</label><select id="black-branch" class="select" data-black-filter="branch">' + branchOptions + '</select></div>' +
        '<button type="button" class="btn btn-ghost" data-clear>Clear</button>' +
      '</div>' +

      '<div data-blacklist-result>' + resultMarkup() + '</div>' +
    '</section>';
  }

  function updateResults(root) {
    var box = root.querySelector('[data-blacklist-result]');
    if (box) box.innerHTML = resultMarkup();
  }

  function mount(root) {
    var u = CRM.ui;

    var box = root.querySelector('[data-blacklist-result]');
    if (box) {
      box.addEventListener('click', function (e) {
        var viewProfile = e.target.closest('[data-view-profile]');
        if (viewProfile) { CRM.actions.openCustomer(viewProfile.dataset.viewProfile); return; }
        var remove = e.target.closest('[data-remove-blacklist]');
        if (remove) { CRM.views.customers.removeBlacklist(remove.dataset.removeBlacklist); return; }
        var row = e.target.closest('[data-customer]');
        if (row) CRM.actions.openCustomer(row.dataset.customer);
      });
      box.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var row = e.target.closest('[data-customer]');
        if (row) { e.preventDefault(); CRM.actions.openCustomer(row.dataset.customer); }
      });
    }

    var q = root.querySelector('#black-q');
    if (q) q.addEventListener('input', u.debounce(function () { state.q = q.value; updateResults(root); }, 180));

    root.querySelectorAll('[data-black-filter]').forEach(function (select) {
      select.addEventListener('change', function () {
        state[select.dataset.blackFilter] = select.value;
        updateResults(root);
      });
    });

    var clear = root.querySelector('[data-clear]');
    if (clear) clear.addEventListener('click', function () {
      state.q = '';
      state.branch = '';
      CRM.app.refresh();
    });

    root.querySelectorAll('[data-view]').forEach(function (btn) {
      btn.addEventListener('click', function () { CRM.actions.openCustomer(btn.dataset.view); });
    });

    root.querySelectorAll('[data-blacklist]').forEach(function (btn) {
      btn.addEventListener('click', function () { CRM.views.customers.openBlacklist(btn.dataset.blacklist); });
    });

    var exportBtn = root.querySelector('[data-export-blacklist]');
    if (exportBtn) exportBtn.addEventListener('click', function () {
      var list = CRM.store.blacklistStats().list.filter(function (c) { return !state.branch || c.branch === state.branch; });
      var lines = [['Customer', 'Phone', 'Branch', 'Agent', 'Reason', 'Since'].map(u.csvCell).join(',')];
      list.forEach(function (c) {
        lines.push([c.name, c.phone, c.branch, c.agent, c.blacklistReason || '', u.fmtDateLong(c.blacklistedAt)].map(u.csvCell).join(','));
      });
      u.download('crm-blacklist-' + u.isoDate(new Date()) + '.csv', '\ufeff' + lines.join('\r\n'));
      u.toast('Blacklist exported', list.length + ' customers included.');
    });
  }

  CRM.views.blacklist = {
    title: 'Blacklist',
    subtitle: 'Do-not-call customers and risk review',
    render: render,
    mount: mount
  };
})();
