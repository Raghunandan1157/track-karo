/* ==========================================================================
   Track_karo CRM - Call log view + log-a-call form
   ========================================================================== */
(function () {
  'use strict';

  var CRM = window.CRM = window.CRM || {};
  CRM.views = CRM.views || {};

  var state = { q: '', outcome: '', sentiment: '', period: '30d' };

  function currentCalls() {
    return CRM.store.filteredCalls({
      period: state.period,
      outcome: state.outcome,
      sentiment: state.sentiment,
      q: state.q
    });
  }

  function resultsMarkup() {
    var u = CRM.ui;
    var list = currentCalls();
    var summary = '<div class="filter-summary"><span><strong>' + list.length + '</strong> call' + (list.length === 1 ? '' : 's') + ' found</span>' +
      '<span class="faint">Saved on this device</span></div>';
    var body = list.length
      ? '<div class="card"><div class="card-body card-body--flush"><div class="call-list">' + list.map(u.callRow).join('') + '</div></div></div>'
      : '<div class="card">' + u.emptyState('No calls match these filters. Try a different period or clear the filters.', 'phone') + '</div>';
    return summary + body;
  }

  function render() {
    var u = CRM.ui;
    var store = CRM.store;

    var outcomeOptions = '<option value="">All outcomes</option>' + store.OUTCOMES.map(function (o) {
      return '<option value="' + o.id + '"' + (state.outcome === o.id ? ' selected' : '') + '>' + u.esc(o.label) + '</option>';
    }).join('');

    var sentimentOptions = '<option value="">All responses</option>' + store.SENTIMENTS.map(function (s) {
      return '<option value="' + s.id + '"' + (state.sentiment === s.id ? ' selected' : '') + '>' + u.esc(s.label) + '</option>';
    }).join('');

    var periodOptions = [['today', 'Today'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days'], ['all', 'All time']].map(function (p) {
      return '<option value="' + p[0] + '"' + (state.period === p[0] ? ' selected' : '') + '>' + p[1] + '</option>';
    }).join('');

    return '<section class="page">' +
      '<div class="page-head">' +
        '<div><h2>Call log</h2><p>Every customer call and the feedback captured by your team.</p></div>' +
        '<div class="page-actions"><button type="button" class="btn btn-primary" data-log-call>' + u.icon('plus') + '<span>Log a call</span></button></div>' +
      '</div>' +
      '<div class="filter-bar">' +
        '<div class="field search-field"><label for="call-q">Search</label>' +
          '<div class="input-wrap">' + u.icon('search') + '<input id="call-q" class="input" type="search" placeholder="Customer, phone, area or feedback" value="' + u.esc(state.q) + '"></div>' +
        '</div>' +
        '<div class="field"><label for="call-outcome">Outcome</label><select id="call-outcome" class="select" data-filter="outcome">' + outcomeOptions + '</select></div>' +
        '<div class="field"><label for="call-sentiment">Response</label><select id="call-sentiment" class="select" data-filter="sentiment">' + sentimentOptions + '</select></div>' +
        '<div class="field"><label for="call-period">Period</label><select id="call-period" class="select" data-filter="period">' + periodOptions + '</select></div>' +
        '<button type="button" class="btn btn-ghost" data-clear>Clear</button>' +
      '</div>' +
      '<div data-calls-result>' + resultsMarkup() + '</div>' +
    '</section>';
  }

  function updateResults(root) {
    var box = root.querySelector('[data-calls-result]');
    if (box) box.innerHTML = resultsMarkup();
  }

  function mount(root) {
    var u = CRM.ui;

    root.querySelectorAll('[data-log-call]').forEach(function (btn) {
      btn.addEventListener('click', function () { openCallForm(); });
    });

    var q = root.querySelector('#call-q');
    if (q) {
      q.addEventListener('input', u.debounce(function () {
        state.q = q.value;
        updateResults(root);
      }, 180));
    }

    root.querySelectorAll('[data-filter]').forEach(function (select) {
      select.addEventListener('change', function () {
        state[select.dataset.filter] = select.value;
        updateResults(root);
      });
    });

    var clear = root.querySelector('[data-clear]');
    if (clear) {
      clear.addEventListener('click', function () {
        state.q = '';
        state.outcome = '';
        state.sentiment = '';
        state.period = '30d';
        CRM.app.refresh();
      });
    }

    var box = root.querySelector('[data-calls-result]');
    if (box) {
      box.addEventListener('click', function (e) {
        var row = e.target.closest('[data-customer]');
        if (row) CRM.actions.openCustomer(row.dataset.customer);
      });
    }
  }

  /* ---------- log a call ---------- */
  function localInputValue(date) {
    var d = new Date(date);
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function openCallForm(customerId) {
    var u = CRM.ui;
    var store = CRM.store;
    var selected = customerId ? store.customerById(customerId) : null;

    var outcomePills = store.OUTCOMES.map(function (o) {
      return '<div class="pill-radio" data-pill="' + o.tone + '">' +
        '<input type="radio" id="oc-' + o.id + '" name="outcome" value="' + o.id + '"' + (o.id === 'answered' ? ' checked' : '') + '>' +
        '<label for="oc-' + o.id + '">' + u.esc(o.label) + '</label>' +
      '</div>';
    }).join('');

    var sentimentPills = store.SENTIMENTS.map(function (s) {
      return '<div class="pill-radio" data-pill="' + s.tone + '">' +
        '<input type="radio" id="sn-' + s.id + '" name="sentiment" value="' + s.id + '">' +
        '<label for="sn-' + s.id + '">' + u.esc(s.label) + '</label>' +
      '</div>';
    }).join('');

    var agentOptions = store.AGENTS.map(function (a) {
      var isSelected = selected ? selected.agent === a : a === store.AGENTS[0];
      return '<option value="' + u.esc(a) + '"' + (isSelected ? ' selected' : '') + '>' + u.esc(a) + '</option>';
    }).join('');

    var body =
      '<form id="call-form" novalidate>' +
        '<div class="form-grid">' +
          '<div class="field field--full"><label for="call-customer">Customer</label>' +
            '<select id="call-customer" name="customerId" class="select" required>' + u.customerOptions(customerId) + '</select>' +
            '<p class="hint">Only existing customers can be selected. Add a new customer from the Customers page.</p>' +
          '</div>' +
          '<div class="field"><label for="call-agent">Agent</label><select id="call-agent" name="agent" class="select">' + agentOptions + '</select></div>' +
          '<div class="field"><label for="call-ts">Date and time</label><input id="call-ts" name="ts" type="datetime-local" class="input" value="' + localInputValue(new Date()) + '"></div>' +
        '</div>' +

        '<div class="form-section">' +
          '<div class="form-section-title">Call outcome</div>' +
          '<div class="pill-group">' + outcomePills + '</div>' +
        '</div>' +

        '<div class="form-section" id="sentiment-section">' +
          '<div class="form-section-title">Customer response</div>' +
          '<div class="pill-group" id="sentiment-pills">' + sentimentPills + '</div>' +
          '<p class="hint" id="sentiment-hint">Choose how the customer reacted. Required for answered calls.</p>' +
        '</div>' +

        '<div class="form-section">' +
          '<div class="field"><label for="call-feedback">Feedback notes</label>' +
            '<textarea id="call-feedback" name="feedback" class="textarea" placeholder="What did the customer say? Any next step agreed?"></textarea>' +
          '</div>' +
        '</div>' +

        '<div class="form-grid">' +
          '<div class="field"><label for="call-followup">Follow-up date (optional)</label><input id="call-followup" name="followUp" type="date" class="input"></div>' +
        '</div>' +

        '<p class="form-error" id="call-error" hidden></p>' +
      '</form>';

    var handle = u.openModal({
      title: 'Log a customer call',
      body: body,
      footer: '<button type="button" class="btn btn-ghost" data-cancel>Cancel</button>' +
        '<button type="submit" form="call-form" class="btn btn-primary">' + u.icon('check') + ' Save call</button>',
      onMount: function (el, close) {
        var form = el.querySelector('#call-form');
        var error = el.querySelector('#call-error');
        var sentimentSection = el.querySelector('#sentiment-section');
        var customerSelect = el.querySelector('#call-customer');
        var agentSelect = el.querySelector('#call-agent');

        function showError(message) {
          error.textContent = message;
          error.hidden = false;
          error.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }

        function syncSentiment() {
          var checked = form.querySelector('input[name="outcome"]:checked');
          var answered = !!checked && checked.value === 'answered';
          sentimentSection.style.opacity = answered ? '1' : '.55';
          form.querySelectorAll('input[name="sentiment"]').forEach(function (radio) {
            radio.disabled = !answered;
            radio.closest('.pill-radio').classList.toggle('is-disabled', !answered);
            if (!answered) radio.checked = false;
          });
        }

        form.querySelectorAll('input[name="outcome"]').forEach(function (radio) {
          radio.addEventListener('change', syncSentiment);
        });
        syncSentiment();

        customerSelect.addEventListener('change', function () {
          var customer = store.customerById(customerSelect.value);
          if (customer) agentSelect.value = customer.agent;
        });

        el.querySelector('[data-cancel]').addEventListener('click', close);

        form.addEventListener('submit', function (e) {
          e.preventDefault();
          error.hidden = true;

          var data = new FormData(form);
          var customerId = data.get('customerId');
          var outcome = data.get('outcome');
          var sentiment = data.get('sentiment');

          if (!customerId) return showError('Please choose a customer.');
          if (!outcome) return showError('Please choose a call outcome.');
          if (outcome === 'answered' && !sentiment) return showError('Please choose the customer response for an answered call.');

          var ts = data.get('ts') ? new Date(data.get('ts')) : new Date();
          if (isNaN(ts.getTime())) ts = new Date();

          var customer = store.customerById(customerId);
          store.addCall({
            customerId: customerId,
            agent: data.get('agent'),
            ts: ts.toISOString(),
            outcome: outcome,
            sentiment: sentiment,
            feedback: data.get('feedback'),
            followUp: data.get('followUp') || null
          });

          close();
          CRM.ui.toast('Call saved', (customer ? customer.name + ' - ' : '') + (store.outcome(outcome) || {}).label);
          CRM.app.refresh();
        });

        if (customerId) customerSelect.focus();
      }
    });

    return handle;
  }

  /* ---------- follow-ups ---------- */
  function openFollowUps() {
    var u = CRM.ui;
    var items = CRM.store.followUpsDue();
    var body;

    if (!items.length) {
      body = u.emptyState('No follow-ups are due today.', 'check');
    } else {
      body = '<div class="mini-list">' + items.map(function (item) {
        var c = item.customer;
        var k = item.call;
        return '<button type="button" class="mini-item" data-follow-customer="' + u.esc(c.id) + '" style="text-align:left;width:100%">' +
          u.avatar(c.name, 'avatar--sm') +
          '<main><strong>' + u.esc(c.name) + '</strong>' +
            '<span>Due ' + u.esc(u.fmtDate(k.followUp)) + ' &middot; ' + u.esc(c.phone) + '</span>' +
            '<span>' + u.esc(k.feedback || 'Follow-up requested') + '</span></main>' +
          u.outcomeBadge(k.outcome) +
        '</button>';
      }).join('') + '</div>';
    }

    var handle = u.openModal({
      title: 'Follow-ups due',
      size: 'modal--lg',
      body: body,
      footer: '<button type="button" class="btn btn-ghost" data-close-modal>Close</button>',
      onMount: function (el, close) {
        el.querySelector('[data-close-modal]').addEventListener('click', close);
        el.querySelectorAll('[data-follow-customer]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            close();
            CRM.actions.openCustomer(btn.dataset.followCustomer);
          });
        });
      }
    });

    return handle;
  }

  CRM.views.calls = {
    title: 'Call log',
    subtitle: 'Customer calls and feedback',
    render: render,
    mount: mount,
    openForm: openCallForm,
    openFollowUps: openFollowUps
  };
})();
