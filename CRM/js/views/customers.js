/* ==========================================================================
   Track_karo CRM - Customers view, add-customer and blacklist forms
   ========================================================================== */
(function () {
  'use strict';

  var CRM = window.CRM = window.CRM || {};
  CRM.views = CRM.views || {};

  var state = { q: '', status: 'all', branch: '', response: '' };

  function filtered() {
    var store = CRM.store;
    var q = state.q.trim().toLowerCase();
    return store.customers.filter(function (c) {
      if (state.status === 'active' && c.blacklisted) return false;
      if (state.status === 'blacklisted' && !c.blacklisted) return false;
      if (state.branch && c.branch !== state.branch) return false;
      if (state.response) {
        var latest = store.latestCallFor(c.id);
        if (!latest || latest.sentiment !== state.response) return false;
      }
      if (q) {
        var hay = (c.name + ' ' + c.phone + ' ' + c.area + ' ' + c.branch + ' ' + c.product).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    }).sort(function (a, b) { return a.name.localeCompare(b.name); });
  }

  function rowMarkup(c) {
    var u = CRM.ui;
    var store = CRM.store;
    var summary = store.customerSummary(c.id);
    var latest = summary.latest;
    var nameBadges = (c.blacklisted ? u.badge('Blacklisted', 'red') : '');
    var latestCell = latest
      ? '<span class="cust-latest">' + u.outcomeBadge(latest.outcome) + (latest.sentiment ? u.sentimentBadge(latest.sentiment) : '') + '</span>' +
        '<span class="cust-meta">' + u.esc(u.timeAgo(latest.ts)) + '</span>'
      : '<span class="faint">No calls</span>';

    var mobileTags = '<span class="cust-mobile-tags">' +
      (latest ? u.outcomeBadge(latest.outcome) + u.sentimentBadge(latest.sentiment) : '<span class="faint">No calls yet</span>') +
      '<span class="cust-mobile-stat">' + summary.calls + ' calls &middot; ' + Math.round(summary.positiveRate * 100) + '% positive</span>' +
    '</span>';

    return '<div class="cust-row" data-customer="' + u.esc(c.id) + '">' +
      u.avatar(c.name) +
      '<div class="cust-main">' +
        '<div class="cust-name"><span>' + u.esc(c.name) + '</span>' + nameBadges + '</div>' +
        '<span class="cust-meta">' + u.esc(c.phone) + ' &middot; ' + u.esc(c.area) + '</span>' +
        mobileTags +
      '</div>' +
      '<div class="cust-branch"><b>' + u.esc(c.branch) + '</b>' + u.esc(c.agent) + '</div>' +
      '<div class="cust-stat">' + latestCell + '</div>' +
      '<div class="cust-stat"><b>' + summary.calls + ' calls</b>' + Math.round(summary.positiveRate * 100) + '% positive</div>' +
      '<div class="cust-actions">' +
        '<button type="button" class="icon-btn" data-view-profile="' + u.esc(c.id) + '" title="View profile" aria-label="View ' + u.esc(c.name) + '">' + u.icon('arrow') + '</button>' +
        '<button type="button" class="icon-btn" data-log="' + u.esc(c.id) + '" title="Log a call" aria-label="Log a call for ' + u.esc(c.name) + '">' + u.icon('phone') + '</button>' +
        (c.blacklisted
          ? '<button type="button" class="icon-btn" data-remove-blacklist="' + u.esc(c.id) + '" title="Remove from blacklist" aria-label="Remove ' + u.esc(c.name) + ' from blacklist">' + u.icon('refresh') + '</button>'
          : '<button type="button" class="icon-btn" data-blacklist="' + u.esc(c.id) + '" title="Blacklist customer" aria-label="Blacklist ' + u.esc(c.name) + '">' + u.icon('ban') + '</button>') +
      '</div>' +
    '</div>';
  }

  function resultsMarkup() {
    var u = CRM.ui;
    var list = filtered();
    var summary = '<div class="filter-summary"><span><strong>' + list.length + '</strong> customer' + (list.length === 1 ? '' : 's') + ' shown</span>' +
      '<span class="faint">' + CRM.store.blacklistStats().count + ' blacklisted</span></div>';

    var body = list.length
      ? '<div class="card"><div class="card-body card-body--flush"><div class="cust-list">' + list.map(rowMarkup).join('') + '</div></div></div>'
      : '<div class="card">' + u.emptyState('No customers match these filters.', 'users') + '</div>';

    return summary + body;
  }

  function render() {
    var u = CRM.ui;
    var store = CRM.store;

    var branchOptions = '<option value="">All branches</option>' + store.BRANCHES.map(function (b) {
      return '<option value="' + u.esc(b) + '"' + (state.branch === b ? ' selected' : '') + '>' + u.esc(b) + '</option>';
    }).join('');

    var responseOptions = '<option value="">Any response</option>' + store.SENTIMENTS.map(function (s) {
      return '<option value="' + s.id + '"' + (state.response === s.id ? ' selected' : '') + '>' + u.esc(s.label) + '</option>';
    }).join('');

    return '<section class="page">' +
      '<div class="page-head">' +
        '<div><h2>Customers</h2><p>Calling history, response and blacklist status for every customer.</p></div>' +
        '<div class="page-actions">' +
          '<button type="button" class="btn btn-ghost" data-add-customer>' + u.icon('plus') + '<span>Add customer</span></button>' +
          '<button type="button" class="btn btn-primary" data-log-call>' + u.icon('phone') + '<span>Log a call</span></button>' +
        '</div>' +
      '</div>' +
      '<div class="filter-bar">' +
        '<div class="field search-field"><label for="cust-q">Search</label>' +
          '<div class="input-wrap">' + u.icon('search') + '<input id="cust-q" class="input" type="search" placeholder="Name, phone, area or branch" value="' + u.esc(state.q) + '"></div>' +
        '</div>' +
        '<div class="field"><label for="cust-status">Status</label><select id="cust-status" class="select" data-filter="status">' +
          '<option value="all"' + (state.status === 'all' ? ' selected' : '') + '>All customers</option>' +
          '<option value="active"' + (state.status === 'active' ? ' selected' : '') + '>Active only</option>' +
          '<option value="blacklisted"' + (state.status === 'blacklisted' ? ' selected' : '') + '>Blacklisted only</option>' +
        '</select></div>' +
        '<div class="field"><label for="cust-response">Latest response</label><select id="cust-response" class="select" data-filter="response">' + responseOptions + '</select></div>' +
        '<div class="field"><label for="cust-branch">Branch</label><select id="cust-branch" class="select" data-filter="branch">' + branchOptions + '</select></div>' +
        '<button type="button" class="btn btn-ghost" data-clear>Clear</button>' +
      '</div>' +
      '<div data-cust-result>' + resultsMarkup() + '</div>' +
    '</section>';
  }

  function updateResults(root) {
    var box = root.querySelector('[data-cust-result]');
    if (box) box.innerHTML = resultsMarkup();
  }

  function bindRowActions(root) {
    var box = root.querySelector('[data-cust-result]');
    if (!box) return;

    box.addEventListener('click', function (e) {
      var viewProfile = e.target.closest('[data-view-profile]');
      if (viewProfile) { CRM.actions.openCustomer(viewProfile.dataset.viewProfile); return; }
      var log = e.target.closest('[data-log]');
      if (log) { openCallForm(log.dataset.log); return; }
      var black = e.target.closest('[data-blacklist]');
      if (black) { openBlacklistForm(black.dataset.blacklist); return; }
      var remove = e.target.closest('[data-remove-blacklist]');
      if (remove) { removeBlacklist(remove.dataset.removeBlacklist); return; }
      var row = e.target.closest('[data-customer]');
      if (row) CRM.actions.openCustomer(row.dataset.customer);
    });

    box.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var row = e.target.closest('[data-customer]');
      if (row) { e.preventDefault(); CRM.actions.openCustomer(row.dataset.customer); }
    });
  }

  function mount(root) {
    var u = CRM.ui;

    bindRowActions(root);

    root.querySelectorAll('[data-log-call]').forEach(function (btn) {
      btn.addEventListener('click', function () { openCallForm(); });
    });

    var add = root.querySelector('[data-add-customer]');
    if (add) add.addEventListener('click', openAddCustomer);

    var q = root.querySelector('#cust-q');
    if (q) q.addEventListener('input', u.debounce(function () { state.q = q.value; updateResults(root); }, 180));

    root.querySelectorAll('[data-filter]').forEach(function (select) {
      select.addEventListener('change', function () {
        state[select.dataset.filter] = select.value;
        updateResults(root);
      });
    });

    var clear = root.querySelector('[data-clear]');
    if (clear) clear.addEventListener('click', function () {
      state.q = '';
      state.status = 'all';
      state.branch = '';
      state.response = '';
      CRM.app.refresh();
    });
  }

  /* ---------- add customer ---------- */
  function openAddCustomer() {
    var u = CRM.ui;
    var store = CRM.store;

    var branchOptions = store.BRANCHES.map(function (b) {
      return '<option value="' + u.esc(b) + '">' + u.esc(b) + '</option>';
    }).join('');
    var agentOptions = store.AGENTS.map(function (a) {
      return '<option value="' + u.esc(a) + '">' + u.esc(a) + '</option>';
    }).join('');
    var productOptions = store.PRODUCTS.map(function (p) {
      return '<option value="' + u.esc(p) + '">' + u.esc(p) + '</option>';
    }).join('');

    var body =
      '<form id="customer-form" novalidate>' +
        '<div class="form-grid">' +
          '<div class="field field--full"><label for="cust-name">Full name</label><input id="cust-name" name="name" class="input" type="text" placeholder="Customer name" required></div>' +
          '<div class="field"><label for="cust-phone">Phone number</label><input id="cust-phone" name="phone" class="input" type="tel" inputmode="numeric" placeholder="10-digit mobile number" required></div>' +
          '<div class="field"><label for="cust-area">Area / locality</label><input id="cust-area" name="area" class="input" type="text" placeholder="T Nagar"></div>' +
          '<div class="field"><label for="cust-branch">Branch</label><select id="cust-branch" name="branch" class="select">' + branchOptions + '</select></div>' +
          '<div class="field"><label for="cust-agent">Assigned agent</label><select id="cust-agent" name="agent" class="select">' + agentOptions + '</select></div>' +
          '<div class="field"><label for="cust-product">Product</label><select id="cust-product" name="product" class="select">' + productOptions + '</select></div>' +
        '</div>' +
        '<p class="form-error" id="customer-error" hidden></p>' +
        '<p class="hint mt-8">Demo mode - the customer is saved in this browser only.</p>' +
      '</form>';

    u.openModal({
      title: 'Add a customer',
      body: body,
      footer: '<button type="button" class="btn btn-ghost" data-cancel>Cancel</button>' +
        '<button type="submit" form="customer-form" class="btn btn-primary">' + u.icon('check') + ' Add customer</button>',
      onMount: function (el, close) {
        var form = el.querySelector('#customer-form');
        var error = el.querySelector('#customer-error');

        el.querySelector('[data-cancel]').addEventListener('click', close);

        form.addEventListener('submit', function (e) {
          e.preventDefault();
          error.hidden = true;
          var data = new FormData(form);
          var name = String(data.get('name') || '').trim();
          var phone = String(data.get('phone') || '').replace(/[^\d+]/g, '');

          if (name.length < 2) {
            error.textContent = 'Please enter the customer name.';
            error.hidden = false;
            return;
          }
          if (phone.replace(/\D/g, '').length < 10) {
            error.textContent = 'Please enter a valid phone number (at least 10 digits).';
            error.hidden = false;
            return;
          }

          var customer = store.addCustomer({
            name: name,
            phone: phone,
            area: data.get('area'),
            branch: data.get('branch'),
            agent: data.get('agent'),
            product: data.get('product')
          });

          close();
          u.toast('Customer added', customer.name);
          CRM.app.refresh();
        });
      }
    });
  }

  /* ---------- blacklist ---------- */
  function openBlacklistForm(customerId) {
    var u = CRM.ui;
    var customer = CRM.store.customerById(customerId);
    if (!customer) return;

    var reasons = [
      'Repeated abusive calls',
      'Loan default - legal notice sent',
      'Requested no contact',
      'Fraud suspicion under review'
    ];

    var body =
      '<div class="callout callout--red" style="margin-bottom:16px">' + u.icon('ban') +
        '<span class="callout-main"><strong>Blacklisting ' + u.esc(customer.name) + '</strong>' +
        '<span>The customer will be removed from calling lists and marked as do-not-call.</span></span></div>' +
      '<form id="blacklist-form" novalidate>' +
        '<div class="field"><label for="blacklist-reason">Reason</label>' +
          '<textarea id="blacklist-reason" name="reason" class="textarea" placeholder="Why is this customer being blacklisted?" required></textarea>' +
        '</div>' +
        '<div class="pill-group mt-8">' + reasons.map(function (r, idx) {
          return '<button type="button" class="btn btn-ghost btn-sm" data-reason="' + u.esc(r) + '">' + u.esc(r) + '</button>';
        }).join('') + '</div>' +
        '<p class="form-error" id="blacklist-error" hidden></p>' +
      '</form>';

    u.openModal({
      title: 'Blacklist customer',
      body: body,
      footer: '<button type="button" class="btn btn-ghost" data-cancel>Cancel</button>' +
        '<button type="submit" form="blacklist-form" class="btn btn-danger">' + u.icon('ban') + ' Blacklist</button>',
      onMount: function (el, close) {
        var form = el.querySelector('#blacklist-form');
        var textarea = el.querySelector('#blacklist-reason');
        var error = el.querySelector('#blacklist-error');

        el.querySelector('[data-cancel]').addEventListener('click', close);
        el.querySelectorAll('[data-reason]').forEach(function (btn) {
          btn.addEventListener('click', function () { textarea.value = btn.dataset.reason; textarea.focus(); });
        });

        form.addEventListener('submit', function (e) {
          e.preventDefault();
          error.hidden = true;
          var reason = textarea.value.trim();
          if (reason.length < 4) {
            error.textContent = 'Please give a short reason for blacklisting.';
            error.hidden = false;
            return;
          }
          CRM.store.setBlacklisted(customerId, reason);
          close();
          u.toast('Customer blacklisted', customer.name);
          CRM.app.refresh();
        });
      }
    });
  }

  function removeBlacklist(customerId) {
    var u = CRM.ui;
    var customer = CRM.store.customerById(customerId);
    if (!customer) return;

    u.confirmDialog({
      title: 'Remove from blacklist?',
      message: customer.name + ' will become an active customer again and can be added back to calling lists.',
      confirmLabel: 'Remove from blacklist'
    }).then(function (ok) {
      if (!ok) return;
      CRM.store.removeBlacklist(customerId);
      u.toast('Removed from blacklist', customer.name);
      CRM.app.refresh();
    });
  }

  function openCallForm(customerId) {
    if (CRM.views.calls && CRM.views.calls.openForm) CRM.views.calls.openForm(customerId);
  }

  CRM.views.customers = {
    title: 'Customers',
    subtitle: 'Customer base and response history',
    render: render,
    mount: mount,
    openAdd: openAddCustomer,
    openBlacklist: openBlacklistForm,
    removeBlacklist: removeBlacklist
  };
})();
