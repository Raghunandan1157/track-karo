/* ==========================================================================
   Track_karo CRM - Dashboard view
   ========================================================================== */
(function () {
  'use strict';

  var CRM = window.CRM = window.CRM || {};
  CRM.views = CRM.views || {};

  var state = { period: '30d' };

  function kpiCard(tone, iconName, label, value, sub) {
    var u = CRM.ui;
    return '<article class="kpi kpi--' + tone + '">' +
      '<div class="kpi-top"><span class="kpi-label">' + u.esc(label) + '</span>' +
        '<span class="kpi-icon">' + u.icon(iconName) + '</span></div>' +
      '<div class="kpi-value">' + u.esc(value) + '</div>' +
      '<div class="kpi-sub">' + sub + '</div>' +
    '</article>';
  }

  function trendMarkup() {
    var u = CRM.ui;
    var days = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      days.push({
        key: u.isoDate(d),
        date: d,
        yes: 0,
        no: 0
      });
    }
    var map = {};
    days.forEach(function (day) { map[day.key] = day; });
    CRM.store.calls.forEach(function (k) {
      var day = map[u.isoDate(k.ts)];
      if (!day) return;
      if (k.outcome === 'answered') day.yes += 1;
      else day.no += 1;
    });

    var max = 1;
    days.forEach(function (day) { max = Math.max(max, day.yes + day.no); });

    return days.map(function (day) {
      var total = day.yes + day.no;
      var yesH = (day.yes / max) * 100;
      var noH = (day.no / max) * 100;
      return '<div class="trend-day" title="' + u.esc(u.fmtDate(day.date)) + ': ' + day.yes + ' answered, ' + day.no + ' not answered">' +
        '<span class="trend-val">' + total + '</span>' +
        '<span class="trend-stack">' +
          '<span class="trend-seg trend-seg--yes" style="height:' + yesH + '%"></span>' +
          '<span class="trend-seg trend-seg--no" style="height:' + noH + '%"></span>' +
        '</span>' +
        '<span class="trend-label">' + day.date.toLocaleDateString('en-IN', { weekday: 'short' }) + ' ' + day.date.getDate() + '</span>' +
      '</div>';
    }).join('');
  }

  function render() {
    var u = CRM.ui;
    var store = CRM.store;
    var calls = store.filteredCalls({ period: state.period });
    var stats = store.statsFor(calls);
    var black = store.blacklistStats();
    var follow = store.followUpsDue();
    var totalCustomers = store.customers.length;
    var missed = (stats.outcomes.not_answered || 0) + (stats.outcomes.not_connected || 0) + (stats.outcomes.switched_off || 0);
    var recent = calls.slice(0, 6);
    var uniqueCustomers = {};
    calls.forEach(function (k) { uniqueCustomers[k.customerId] = true; });
    var uniqueCount = Object.keys(uniqueCustomers).length;
    var callsPerCustomer = uniqueCount ? (stats.total / uniqueCount).toFixed(1) : '0';

    var outcomeRows = store.OUTCOMES.map(function (o) {
      var count = stats.outcomes[o.id] || 0;
      var share = u.pctNum(count, stats.total);
      return '<div class="bar-row">' +
        '<span class="bar-label" style="color:' + o.color + '"><i class="bar-dot" style="background:' + o.color + '"></i><span style="color:var(--text)">' + u.esc(o.label) + '</span></span>' +
        '<span class="bar-track"><span class="bar-fill" style="width:' + share + '%;background:' + o.color + '"></span></span>' +
        '<span class="bar-value"><b>' + count + '</b>' + u.pct(count, stats.total) + '</span>' +
      '</div>';
    }).join('');

    var segments = store.SENTIMENTS.map(function (s) {
      return { label: s.label, value: stats.sentiments[s.id] || 0, color: s.color, tone: s.tone };
    });
    var legend = segments.map(function (s) {
      return '<div class="legend-row">' +
        '<i class="bar-dot" style="background:' + s.color + '"></i>' +
        '<span>' + u.esc(s.label) + '</span>' +
        '<b>' + s.value + '</b>' +
        '<small>' + u.pct(s.value, stats.answered) + '</small>' +
      '</div>';
    }).join('');

    var blackItems = black.list.slice(0, 4).map(function (c) {
      return '<button type="button" class="mini-item" data-customer="' + u.esc(c.id) + '" style="text-align:left;width:100%">' +
        u.avatar(c.name, 'avatar--sm') +
        '<main><strong>' + u.esc(c.name) + '</strong><span>' + u.esc(c.blacklistReason || 'No reason recorded') + '</span></main>' +
        u.badge(u.fmtDate(c.blacklistedAt), 'red', true) +
      '</button>';
    }).join('');

    var followCallout = follow.length ? (
      '<button type="button" class="callout callout--amber" data-followups>' +
        u.icon('clock') +
        '<span class="callout-main"><strong>' + follow.length + ' follow-up' + (follow.length === 1 ? '' : 's') + ' due</strong>' +
          '<span>Customers are waiting for a callback today.</span></span>' +
        '<span class="callout-arrow">' + u.icon('arrow') + '</span>' +
      '</button>'
    ) : '';

    return '<section class="page">' +
      '<div class="page-head">' +
        '<div><h2>Calling overview</h2><p>One place to see how your customer calls are going.</p></div>' +
        '<div class="page-actions">' + u.periodTabs(state.period) +
          '<button type="button" class="btn btn-primary" data-log-call>' + u.icon('plus') + '<span>Log a call</span></button>' +
        '</div>' +
      '</div>' +

      followCallout +

      '<div class="kpi-grid">' +
        kpiCard('blue', 'phone', 'Calls made', u.fmtInt(stats.total), 'Across ' + u.fmtInt(totalCustomers) + ' customers') +
        kpiCard('green', 'check', 'Answered', u.fmtInt(stats.answered), u.pct(stats.answered, stats.total) + ' of all calls') +
        kpiCard('purple', 'smile', 'Positive response', Math.round(stats.positiveRate * 100) + '%', stats.positive + ' of ' + stats.answered + ' answered calls') +
        kpiCard('amber', 'alert', 'Not reachable', u.fmtInt(missed), (stats.outcomes.not_answered || 0) + ' no answer &middot; ' + (stats.outcomes.not_connected || 0) + ' not connected &middot; ' + (stats.outcomes.switched_off || 0) + ' off') +
        kpiCard('red', 'ban', 'Blacklisted', u.fmtInt(black.count), u.pct(black.count, totalCustomers) + ' of customer base') +
        kpiCard('slate', 'calendar', 'Follow-ups due', u.fmtInt(follow.length), follow.length ? 'Pending today' : 'Nothing pending') +
      '</div>' +

      '<div class="grid grid--dashboard">' +
        '<article class="card">' +
          '<div class="card-head"><div><div class="card-title">Call outcome</div><div class="card-sub">Share of every call in the selected period</div></div>' +
            '<a class="card-link" href="#calls">Call log</a></div>' +
          '<div class="card-body"><div class="bar-list">' + outcomeRows + '</div>' +
            (stats.total ? '<div class="card-foot"><span>Customers called <b>' + uniqueCount + '</b></span><span>Calls per customer <b>' + callsPerCustomer + '</b></span></div>' : u.emptyState('No calls in this period.', 'phone')) +
          '</div>' +
        '</article>' +

        '<article class="card">' +
          '<div class="card-head"><div><div class="card-title">Customer response</div><div class="card-sub">How customers reacted on answered calls</div></div></div>' +
          '<div class="card-body">' +
            '<div class="donut-wrap">' +
              '<div class="donut-box">' + u.donut(segments, 168, 22) +
                '<div class="donut-center"><strong>' + Math.round(stats.positiveRate * 100) + '%</strong><span>Positive</span></div>' +
              '</div>' +
              '<div class="legend">' + legend + '</div>' +
            '</div>' +
            '<div class="donut-note"><b>Positive response</b> = customer showed interest, agreed to a next step, or asked for more details.</div>' +
          '</div>' +
        '</article>' +
      '</div>' +

      '<div class="grid grid--2">' +
        '<article class="card">' +
          '<div class="card-head"><div><div class="card-title">Calls in the last 7 days</div><div class="card-sub">Answered versus not answered</div></div></div>' +
          '<div class="card-body">' +
            '<div class="trend">' + trendMarkup() + '</div>' +
            '<div class="trend-legend"><span><i style="background:var(--green)"></i>Answered</span><span><i style="background:#C9D3E1"></i>Not answered</span></div>' +
          '</div>' +
        '</article>' +

        '<article class="card">' +
          '<div class="card-head"><div><div class="card-title">Blacklisted customers</div><div class="card-sub">' + u.pct(black.count, totalCustomers) + ' of all customers</div></div>' +
            '<a class="card-link" href="#blacklist">Manage</a></div>' +
          '<div class="card-body">' +
            (blackItems ? '<div class="mini-list">' + blackItems + '</div>' : u.emptyState('No blacklisted customers.', 'ban')) +
          '</div>' +
        '</article>' +
      '</div>' +

      '<div class="grid">' +
        '<article class="card">' +
          '<div class="card-head"><div><div class="card-title">Recent calls</div><div class="card-sub">Latest feedback from the field</div></div>' +
            '<a class="card-link" href="#calls">View all calls</a></div>' +
          '<div class="card-body card-body--flush">' +
            (recent.length ? '<div class="call-list">' + recent.map(u.callRow).join('') + '</div>' : u.emptyState('No calls logged yet.', 'phone')) +
          '</div>' +
        '</article>' +
      '</div>' +
    '</section>';
  }

  function mount(root) {
    var u = CRM.ui;
    root.querySelectorAll('[data-period]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.period = btn.dataset.period;
        CRM.app.refresh();
      });
    });

    var logButtons = root.querySelectorAll('[data-log-call]');
    logButtons.forEach(function (btn) {
      btn.addEventListener('click', function () { CRM.actions.openCallForm(); });
    });

    root.querySelectorAll('[data-customer]').forEach(function (el) {
      el.addEventListener('click', function () { CRM.actions.openCustomer(el.dataset.customer); });
    });

    var followBtn = root.querySelector('[data-followups]');
    if (followBtn) followBtn.addEventListener('click', function () { CRM.actions.openFollowUps(); });

    if (!u) return;
  }

  CRM.views.dashboard = {
    title: 'Dashboard',
    subtitle: 'Calling performance at a glance',
    render: render,
    mount: mount
  };
})();
