/* ==========================================================================
   Track_karo CRM - Reports view (percentage reports + CSV export)
   ========================================================================== */
(function () {
  'use strict';

  var CRM = window.CRM = window.CRM || {};
  CRM.views = CRM.views || {};

  var state = { period: '30d', branch: '', agent: '' };

  var PERIOD_LABEL = { today: 'Today', '7d': 'Last 7 days', '30d': 'Last 30 days', all: 'All time' };

  function currentCalls() {
    return CRM.store.filteredCalls({ period: state.period, branch: state.branch, agent: state.agent });
  }

  function barCell(count, total, color) {
    var width = total ? (count / total) * 100 : 0;
    return '<span class="bar-track" style="display:block;width:120px;height:8px"><span class="bar-fill" style="display:block;width:' + width + '%;background:' + color + '"></span></span>';
  }

  function render() {
    var u = CRM.ui;
    var store = CRM.store;
    var calls = currentCalls();
    var stats = store.statsFor(calls);
    var black = store.blacklistStats();
    var blackList = black.list.filter(function (c) { return !state.branch || c.branch === state.branch; });
    var baseCustomers = store.customers.filter(function (c) { return !state.branch || c.branch === state.branch; });
    var totalCustomers = baseCustomers.length;
    var blackPct = totalCustomers ? blackList.length / totalCustomers : 0;

    var outcomeRows = store.OUTCOMES.map(function (o) {
      var count = stats.outcomes[o.id] || 0;
      return '<tr>' +
        '<td><span class="bar-label" style="color:' + o.color + '"><i class="bar-dot" style="background:' + o.color + '"></i><span style="color:var(--text)">' + u.esc(o.label) + '</span></span></td>' +
        '<td class="num strong">' + count + '</td>' +
        '<td class="num">' + u.pct(count, stats.total, 1) + '</td>' +
        '<td>' + barCell(count, stats.total, o.color) + '</td>' +
      '</tr>';
    }).join('');

    var responseRows = store.SENTIMENTS.map(function (s) {
      var count = stats.sentiments[s.id] || 0;
      return '<tr>' +
        '<td><span class="bar-label" style="color:' + s.color + '"><i class="bar-dot" style="background:' + s.color + '"></i><span style="color:var(--text)">' + u.esc(s.label) + '</span></span></td>' +
        '<td class="num strong">' + count + '</td>' +
        '<td class="num">' + u.pct(count, stats.answered, 1) + '</td>' +
        '<td>' + barCell(count, stats.answered, s.color) + '</td>' +
      '</tr>';
    }).join('');

    var agentRows = store.AGENTS.filter(function (agent) {
      return !state.agent || agent === state.agent;
    }).map(function (agent) {
      var agentCalls = calls.filter(function (k) { return k.agent === agent; });
      var st = store.statsFor(agentCalls);
      if (!agentCalls.length) return '';
      var follow = store.followUpsDue().filter(function (item) { return item.customer.agent === agent; }).length;
      return '<tr>' +
        '<td class="strong">' + u.esc(agent) + '</td>' +
        '<td class="num">' + st.total + '</td>' +
        '<td class="num">' + u.pct(st.answered, st.total) + '</td>' +
        '<td class="num">' + u.pct(st.positive, st.answered) + '</td>' +
        '<td class="num">' + (st.sentiments.angry || 0) + '</td>' +
        '<td class="num">' + follow + '</td>' +
      '</tr>';
    }).join('');

    var branchRows = store.BRANCHES.filter(function (branch) {
      return (!state.branch || branch === state.branch) && (!state.agent || calls.some(function (k) {
        var c = store.customerById(k.customerId);
        return c && c.branch === branch && c.agent === state.agent;
      }));
    }).map(function (branch) {
      var branchCalls = calls.filter(function (k) {
        var c = store.customerById(k.customerId);
        return c && c.branch === branch;
      });
      var st = store.statsFor(branchCalls);
      var branchCustomers = store.customers.filter(function (c) { return c.branch === branch; });
      var branchBlack = branchCustomers.filter(function (c) { return c.blacklisted; }).length;
      return '<tr>' +
        '<td class="strong">' + u.esc(branch) + '</td>' +
        '<td class="num">' + branchCustomers.length + '</td>' +
        '<td class="num">' + st.total + '</td>' +
        '<td class="num">' + u.pct(st.answered, st.total) + '</td>' +
        '<td class="num">' + u.pct(st.positive, st.answered) + '</td>' +
        '<td class="num">' + branchBlack + '</td>' +
      '</tr>';
    }).join('');

    var blackRows = blackList.slice().sort(function (a, b) {
      return Date.parse(b.blacklistedAt || 0) - Date.parse(a.blacklistedAt || 0);
    }).map(function (c) {
      return '<tr>' +
        '<td><span class="strong">' + u.esc(c.name) + '</span><div class="cust-meta">' + u.esc(c.phone) + '</div></td>' +
        '<td>' + u.esc(c.branch) + '</td>' +
        '<td class="wrap muted">' + u.esc(c.blacklistReason || '-') + '</td>' +
        '<td>' + u.fmtDate(c.blacklistedAt) + '</td>' +
      '</tr>';
    }).join('');

    var branchOptions = '<option value="">All branches</option>' + store.BRANCHES.map(function (b) {
      return '<option value="' + u.esc(b) + '"' + (state.branch === b ? ' selected' : '') + '>' + u.esc(b) + '</option>';
    }).join('');

    var agentOptions = '<option value="">All agents</option>' + store.AGENTS.map(function (a) {
      return '<option value="' + u.esc(a) + '"' + (state.agent === a ? ' selected' : '') + '>' + u.esc(a) + '</option>';
    }).join('');

    return '<section class="page">' +
      '<div class="page-head">' +
        '<div><h2>Reports</h2><p>Percentage-wise call, response and blacklist reporting.</p></div>' +
        '<div class="page-actions">' +
          '<button type="button" class="btn btn-ghost" data-export>' + u.icon('download') + '<span>Export CSV</span></button>' +
          '<button type="button" class="btn btn-ghost" data-print>' + u.icon('printer') + '<span>Print</span></button>' +
        '</div>' +
      '</div>' +

      '<div class="filter-bar">' +
        '<div class="field"><label>Period</label>' + u.periodTabs(state.period).replace('class="segmented ', 'class="segmented segmented--sm ') + '</div>' +
        '<div class="field"><label for="report-branch">Branch</label><select id="report-branch" class="select" data-report-filter="branch">' + branchOptions + '</select></div>' +
        '<div class="field"><label for="report-agent">Agent</label><select id="report-agent" class="select" data-report-filter="agent">' + agentOptions + '</select></div>' +
        '<div class="filter-summary" style="margin:0 0 0 auto;flex-direction:column;align-items:flex-end"><span>' + PERIOD_LABEL[state.period] + '</span><span class="faint">' + u.fmtDateTime(new Date()) + '</span></div>' +
      '</div>' +

      '<div class="kpi-grid kpi-grid--4">' +
        '<article class="kpi kpi--blue"><div class="kpi-top"><span class="kpi-label">Calls made</span><span class="kpi-icon">' + u.icon('phone') + '</span></div><div class="kpi-value">' + u.fmtInt(stats.total) + '</div><div class="kpi-sub">' + PERIOD_LABEL[state.period] + '</div></article>' +
        '<article class="kpi kpi--green"><div class="kpi-top"><span class="kpi-label">Answered</span><span class="kpi-icon">' + u.icon('check') + '</span></div><div class="kpi-value">' + u.pct(stats.answered, stats.total) + '</div><div class="kpi-sub">' + stats.answered + ' of ' + stats.total + ' calls</div></article>' +
        '<article class="kpi kpi--purple"><div class="kpi-top"><span class="kpi-label">Positive response</span><span class="kpi-icon">' + u.icon('smile') + '</span></div><div class="kpi-value">' + u.pct(stats.positive, stats.answered) + '</div><div class="kpi-sub">Of answered calls</div></article>' +
        '<article class="kpi kpi--red"><div class="kpi-top"><span class="kpi-label">Blacklisted</span><span class="kpi-icon">' + u.icon('ban') + '</span></div><div class="kpi-value">' + u.pct(blackList.length, totalCustomers) + '</div><div class="kpi-sub">' + blackList.length + ' of ' + totalCustomers + ' customers</div></article>' +
      '</div>' +

      '<div class="grid grid--2 report-grid">' +
        '<article class="card">' +
          '<div class="card-head"><div><div class="card-title">Call outcome report</div><div class="card-sub">Share of all calls by outcome</div></div></div>' +
          '<div class="card-body"><div class="table-wrap"><table class="table">' +
            '<thead><tr><th>Outcome</th><th class="num">Calls</th><th class="num">Share</th><th>Distribution</th></tr></thead>' +
            '<tbody>' + outcomeRows + '<tr class="total-row"><td>Total</td><td class="num">' + stats.total + '</td><td class="num">100%</td><td></td></tr></tbody>' +
          '</table></div></div>' +
        '</article>' +

        '<article class="card">' +
          '<div class="card-head"><div><div class="card-title">Customer response report</div><div class="card-sub">Share of answered calls by response</div></div></div>' +
          '<div class="card-body"><div class="table-wrap"><table class="table">' +
            '<thead><tr><th>Response</th><th class="num">Calls</th><th class="num">Share</th><th>Distribution</th></tr></thead>' +
            '<tbody>' + responseRows + '<tr class="total-row"><td>Total answered</td><td class="num">' + stats.answered + '</td><td class="num">100%</td><td></td></tr></tbody>' +
          '</table></div></div>' +
        '</article>' +
      '</div>' +

      '<div class="grid grid--2 report-grid mt-16">' +
        '<article class="card">' +
          '<div class="card-head"><div><div class="card-title">Agent performance</div><div class="card-sub">Answered and positive rates by agent</div></div></div>' +
          '<div class="card-body"><div class="table-wrap"><table class="table">' +
            '<thead><tr><th>Agent</th><th class="num">Calls</th><th class="num">Answered</th><th class="num">Positive</th><th class="num">Angry</th><th class="num">Follow-ups</th></tr></thead>' +
            '<tbody>' + (agentRows || '<tr><td colspan="6" class="muted">No calls in this period.</td></tr>') + '</tbody>' +
          '</table></div></div>' +
        '</article>' +

        '<article class="card">' +
          '<div class="card-head"><div><div class="card-title">Branch performance</div><div class="card-sub">Customer base, calls and blacklist by branch</div></div></div>' +
          '<div class="card-body"><div class="table-wrap"><table class="table">' +
            '<thead><tr><th>Branch</th><th class="num">Customers</th><th class="num">Calls</th><th class="num">Answered</th><th class="num">Positive</th><th class="num">Blacklisted</th></tr></thead>' +
            '<tbody>' + (branchRows || '<tr><td colspan="6" class="muted">No calls in this period.</td></tr>') + '</tbody>' +
          '</table></div></div>' +
        '</article>' +
      '</div>' +

      '<div class="grid mt-16">' +
        '<article class="card">' +
          '<div class="card-head"><div><div class="card-title">Blacklisted customers</div><div class="card-sub">' + blackList.length + ' customers &middot; ' + u.pct(blackList.length, totalCustomers, 1) + ' of customer base</div></div>' +
            '<a class="card-link" href="#blacklist">Manage blacklist</a></div>' +
          '<div class="card-body">' +
            (blackRows
              ? '<div class="table-wrap"><table class="table"><thead><tr><th>Customer</th><th>Branch</th><th>Reason</th><th>Since</th></tr></thead><tbody>' + blackRows + '</tbody></table></div>'
              : u.emptyState('No blacklisted customers for this filter.', 'ban')) +
          '</div>' +
        '</article>' +
      '</div>' +
    '</section>';
  }

  function buildCsv() {
    var u = CRM.ui;
    var store = CRM.store;
    var calls = currentCalls();
    var stats = store.statsFor(calls);
    var black = store.blacklistStats();
    var blackList = black.list.filter(function (c) { return !state.branch || c.branch === state.branch; });
    var baseCustomers = store.customers.filter(function (c) { return !state.branch || c.branch === state.branch; });
    var lines = [];

    lines.push(['Track_karo CRM report'].map(u.csvCell).join(','));
    lines.push(['Period', PERIOD_LABEL[state.period]].map(u.csvCell).join(','));
    lines.push(['Branch', state.branch || 'All branches'].map(u.csvCell).join(','));
    lines.push(['Agent', state.agent || 'All agents'].map(u.csvCell).join(','));
    lines.push(['Generated', new Date().toLocaleString('en-IN')].map(u.csvCell).join(','));
    lines.push('');

    lines.push(['CALL OUTCOMES'].map(u.csvCell).join(','));
    lines.push(['Outcome', 'Calls', 'Share %'].map(u.csvCell).join(','));
    store.OUTCOMES.forEach(function (o) {
      var count = stats.outcomes[o.id] || 0;
      lines.push([o.label, count, u.pctNum(count, stats.total).toFixed(1)].map(u.csvCell).join(','));
    });
    lines.push(['Total', stats.total, '100.0'].map(u.csvCell).join(','));
    lines.push('');

    lines.push(['CUSTOMER RESPONSES'].map(u.csvCell).join(','));
    lines.push(['Response', 'Calls', 'Share of answered %'].map(u.csvCell).join(','));
    store.SENTIMENTS.forEach(function (s) {
      var count = stats.sentiments[s.id] || 0;
      lines.push([s.label, count, u.pctNum(count, stats.answered).toFixed(1)].map(u.csvCell).join(','));
    });
    lines.push(['Total answered', stats.answered, '100.0'].map(u.csvCell).join(','));
    lines.push('');

    lines.push(['BLACKLISTED CUSTOMERS'].map(u.csvCell).join(','));
    lines.push(['Customer', 'Phone', 'Branch', 'Reason', 'Since'].map(u.csvCell).join(','));
    blackList.forEach(function (c) {
      lines.push([c.name, c.phone, c.branch, c.blacklistReason || '', u.fmtDateLong(c.blacklistedAt)].map(u.csvCell).join(','));
    });
    lines.push(['Blacklisted share %', u.pctNum(blackList.length, baseCustomers.length).toFixed(1)].map(u.csvCell).join(','));
    lines.push('');

    lines.push(['CALL DETAIL'].map(u.csvCell).join(','));
    lines.push(['Date', 'Customer', 'Phone', 'Branch', 'Agent', 'Outcome', 'Response', 'Feedback', 'Follow-up'].map(u.csvCell).join(','));
    calls.forEach(function (k) {
      var c = store.customerById(k.customerId) || {};
      lines.push([
        u.fmtDateTime(k.ts),
        c.name || '',
        c.phone || '',
        c.branch || '',
        k.agent || '',
        (store.outcome(k.outcome) || {}).label || k.outcome,
        (store.sentiment(k.sentiment) || {}).label || '',
        k.feedback || '',
        k.followUp || ''
      ].map(u.csvCell).join(','));
    });

    return '\ufeff' + lines.join('\r\n');
  }

  function mount(root) {
    var u = CRM.ui;

    root.querySelectorAll('[data-period]').forEach(function (btn) {
      btn.addEventListener('click', function () { state.period = btn.dataset.period; CRM.app.refresh(); });
    });

    root.querySelectorAll('[data-report-filter]').forEach(function (select) {
      select.addEventListener('change', function () {
        state[select.dataset.reportFilter] = select.value;
        CRM.app.refresh();
      });
    });

    var exportBtn = root.querySelector('[data-export]');
    if (exportBtn) exportBtn.addEventListener('click', function () {
      u.download('crm-report-' + u.isoDate(new Date()) + '.csv', buildCsv());
      u.toast('Report exported', 'CSV downloaded with percentages and call detail.');
    });

    var printBtn = root.querySelector('[data-print]');
    if (printBtn) printBtn.addEventListener('click', function () { window.print(); });
  }

  CRM.views.reports = {
    title: 'Reports',
    subtitle: 'Percentage-wise calling reports',
    render: render,
    mount: mount
  };
})();
