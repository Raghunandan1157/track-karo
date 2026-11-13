/* ==========================================================================
   Track_karo CRM - local demo data store
   NO database, NO server. Everything is kept in localStorage on this device.
   ========================================================================== */
(function () {
  'use strict';

  window.CRM = window.CRM || {};

  var KEY = 'trackkaro.crm.v1';
  var VERSION = 1;

  var OUTCOMES = [
    { id: 'answered',     label: 'Answered',      tone: 'green',  color: '#1E8E4E' },
    { id: 'not_answered', label: 'Not Answered',  tone: 'amber',  color: '#E0A02B' },
    { id: 'not_connected',label: 'Not Connected', tone: 'slate',  color: '#64748B' },
    { id: 'switched_off', label: 'Switched Off',  tone: 'red',    color: '#C62828' },
    { id: 'busy',         label: 'Busy',          tone: 'purple', color: '#6D3FC0' },
    { id: 'wrong_number', label: 'Wrong Number',  tone: 'grey',   color: '#8A95A5' }
  ];

  var SENTIMENTS = [
    { id: 'positive',       label: 'Positive',       tone: 'green',  color: '#1E8E4E' },
    { id: 'polite',         label: 'Polite',         tone: 'blue',   color: '#2F6DB5' },
    { id: 'neutral',        label: 'Neutral',        tone: 'slate',  color: '#94A3B8' },
    { id: 'angry',          label: 'Angry',          tone: 'red',    color: '#C62828' },
    { id: 'not_interested', label: 'Not Interested', tone: 'amber',  color: '#B26A00' }
  ];

  var BRANCHES = ['Chennai - T Nagar', 'Chennai - Anna Nagar', 'Coimbatore', 'Madurai', 'Salem'];
  var AGENTS = ['Priya Raman', 'Arun Kumar', 'Divya Lakshmi', 'Karthik Raja', 'Meena Sundar'];
  var PRODUCTS = ['Micro Loan', 'Gold Loan', 'Personal Loan', 'Two-Wheeler Loan', 'Insurance'];
  var AREAS = ['T Nagar', 'Anna Nagar', 'Adyar', 'Velachery', 'Tambaram', 'Porur', 'Chromepet', 'Guindy', 'Gandhipuram', 'RS Puram', 'KK Nagar', 'Villapuram'];

  var FIRST = ['Anitha', 'Ramesh', 'Sundari', 'Vijay', 'Meenakshi', 'Prakash', 'Lakshmi', 'Suresh', 'Kavitha', 'Ganesh', 'Deepa', 'Bharath', 'Revathi', 'Mohan', 'Saranya', 'Anand', 'Nithya', 'Karthik', 'Padma', 'Ravi', 'Sandhya', 'Senthil', 'Vani', 'Ashok', 'Preethi', 'Dinesh', 'Gayathri', 'Muthu', 'Bhavani', 'Arjun', 'Sowmya', 'Naveen', 'Chitra', 'Prabhu', 'Aishwarya', 'Sathish', 'Malathi', 'Vignesh', 'Keerthana', 'Rajesh', 'Sudha', 'Yogesh', 'Divya', 'Hari', 'Nandhini', 'Sakthi'];
  var LAST = ['Krishnan', 'Babu', 'Devi', 'Anand', 'Rajan', 'Kumar', 'Narayanan', 'Moorthy', 'Sundaram', 'Prasad', 'Selvam', 'Raman', 'Vijayan', 'Murugan', 'Balaji', 'Sekar', 'Chandran', 'Kannan', 'Manikandan', 'Srinivasan'];

  var FEEDBACK = {
    positive: [
      'Interested in the new loan offer. Asked for a callback tomorrow.',
      'Happy with the service. Confirmed renewal next week.',
      'Wants complete details about the gold loan scheme.',
      'Confirmed the EMI date and thanked the team.',
      'Ready to refer two family members for a loan.',
      'Said the new offer looks useful. Wants a field visit.',
      'Agreed to share documents this week.',
      'Very satisfied with the quick disbursement last time.'
    ],
    polite: [
      'Spoke politely, asked us to call after 6 PM.',
      'Listened patiently and said she will think about it.',
      'Busy at work but polite. Requested a WhatsApp brochure.',
      'Acknowledged the reminder and asked to call next week.',
      'Polite throughout. Wants to discuss with family first.',
      'Said she is travelling and asked to call after the weekend.',
      'Thanked us for the call and asked for more time.'
    ],
    neutral: [
      'Said he is not looking for a loan right now.',
      'No clear answer, asked to call again later.',
      'Only wanted the account balance details.',
      'Not sure yet, will discuss with family.',
      'Said the current EMI is manageable. No new requirement.',
      'Asked about branch timings and ended the call.'
    ],
    angry: [
      'Complained about repeated calls. Very upset.',
      'Raised voice about the EMI reminder timing.',
      'Angry that the loan was not disbursed on time.',
      'Said stop calling. Do not disturb.',
      'Upset about a wrong EMI deduction and demanded a fix.',
      'Complained that promises were not kept by the branch.'
    ],
    not_interested: [
      'Clearly said not interested in any new loan.',
      'Already has a loan elsewhere. Declined the offer.',
      'Asked to remove the number from the calling list.',
      'Said there is no requirement. Do not call again.',
      'Not interested now, may consider next year.'
    ],
    not_answered: ['Rang, no reply.', 'Call went unanswered.', 'Tried twice, no response.', 'Rang for 30 seconds, no answer.'],
    not_connected: ['Call failed - network not reachable.', 'Number temporarily unreachable.', 'Call dropped before connecting.', 'No network at the customer end.'],
    switched_off: ['Phone switched off.', 'Switched off when called.', 'Could not reach - phone switched off.', 'Phone is switched off since morning.'],
    busy: ['Line busy.', 'Busy tone on both attempts.', 'Customer was on another call.'],
    wrong_number: ['Number belongs to someone else.', 'Wrong number - asked to remove.', 'Connected to a different person.']
  };

  var BLACKLIST_REASONS = [
    'Repeated abusive calls',
    'Loan default - legal notice sent',
    'Requested no contact',
    'Fraud suspicion under review'
  ];

  /* ---------- helpers ---------- */
  function uid(prefix) {
    var rand = Math.random().toString(36).slice(2, 8);
    return prefix + Date.now().toString(36).slice(-5) + rand;
  }

  function isoDate(value) {
    var d = value instanceof Date ? value : new Date(value);
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(rand, list) { return list[Math.floor(rand() * list.length)]; }

  /* ---------- seed ---------- */
  function seed() {
    var rand = mulberry32(20261113);
    var now = Date.now();
    var customers = [];
    var phones = {};

    for (var i = 0; i < FIRST.length; i++) {
      var phone;
      do {
        phone = String([9, 8, 7, 6][i % 4]);
        for (var d = 0; d < 9; d++) phone += Math.floor(rand() * 10);
      } while (phones[phone]);
      phones[phone] = true;

      var blacklisted = [3, 14, 27, 38].indexOf(i) !== -1;
      customers.push({
        id: 'c' + (i + 1),
        name: FIRST[i] + ' ' + LAST[i % LAST.length],
        phone: phone,
        area: AREAS[i % AREAS.length],
        branch: BRANCHES[i % BRANCHES.length],
        agent: AGENTS[i % AGENTS.length],
        product: PRODUCTS[i % PRODUCTS.length],
        language: i % 3 === 0 ? 'English' : 'Tamil',
        createdAt: new Date(now - (60 + Math.floor(rand() * 900)) * 86400000).toISOString(),
        blacklisted: blacklisted,
        blacklistReason: blacklisted ? BLACKLIST_REASONS[[3, 14, 27, 38].indexOf(i) % BLACKLIST_REASONS.length] : '',
        blacklistedAt: blacklisted ? new Date(now - (5 + Math.floor(rand() * 40)) * 86400000).toISOString() : null
      });
    }

    var calls = [];
    var callSeq = 0;

    function addCall(customer, outcome, sentiment, minutesAgo, followUp) {
      callSeq += 1;
      var ts = now - minutesAgo * 60000;
      var feedbackKey = outcome === 'answered' && sentiment ? sentiment : outcome;
      var bank = FEEDBACK[feedbackKey] || FEEDBACK.neutral;
      calls.push({
        id: 'k' + callSeq,
        customerId: customer.id,
        agent: customer.agent,
        ts: new Date(ts).toISOString(),
        outcome: outcome,
        sentiment: outcome === 'answered' ? sentiment : null,
        feedback: pick(rand, bank),
        followUp: followUp || null,
        source: 'demo'
      });
    }

    customers.forEach(function (c) {
      var count = 2 + Math.floor(rand() * 5); // 2-6 calls
      var reach = 0.34 + rand() * 0.46;       // answered probability
      var mood = rand();                      // happier customers answer + react better

      for (var j = 0; j < count; j++) {
        var minutesAgo;
        if (rand() < 0.07) minutesAgo = 20 + Math.floor(rand() * 640);       // recent
        else minutesAgo = 720 + Math.floor(rand() * (30 * 24 * 60 - 720));   // up to 30 days

        var outcome;
        var r = rand();
        if (r < reach) {
          outcome = 'answered';
        } else {
          var rest = rand();
          if (rest < 0.34) outcome = 'not_answered';
          else if (rest < 0.62) outcome = 'not_connected';
          else if (rest < 0.82) outcome = 'switched_off';
          else if (rest < 0.93) outcome = 'busy';
          else outcome = 'wrong_number';
        }

        var sentiment = null;
        if (outcome === 'answered') {
          var s = rand();
          if (s < 0.18 + mood * 0.26) sentiment = 'positive';
          else if (s < 0.56) sentiment = 'polite';
          else if (s < 0.76) sentiment = 'neutral';
          else if (s < 0.91) sentiment = 'angry';
          else sentiment = 'not_interested';
        }

        var followUp = null;
        if (sentiment === 'positive' || sentiment === 'polite') {
          if (rand() < 0.4) {
            var offset = -2 + Math.floor(rand() * 10); // -2 .. +7 days
            followUp = isoDate(new Date(now - minutesAgo * 60000 + offset * 86400000));
          }
        }

        addCall(c, outcome, sentiment, minutesAgo, followUp);
      }
    });

    // Guarantee meaningful "Today" numbers on the dashboard.
    var todayMix = [
      ['answered', 'positive'],
      ['answered', 'positive'],
      ['answered', 'polite'],
      ['answered', 'angry'],
      ['answered', 'neutral'],
      ['not_answered', null],
      ['not_connected', null],
      ['switched_off', null],
      ['answered', 'positive'],
      ['answered', 'polite']
    ];
    todayMix.forEach(function (mix, idx) {
      var c = customers[(idx * 7 + 3) % customers.length];
      var followUp = null;
      if (mix[1] === 'positive' && idx < 4) followUp = isoDate(new Date(now + (idx + 1) * 86400000));
      addCall(c, mix[0], mix[1], 8 + idx * 27, followUp);
    });

    calls.sort(function (a, b) { return Date.parse(b.ts) - Date.parse(a.ts); });

    return {
      version: VERSION,
      createdAt: new Date(now).toISOString(),
      customers: customers,
      calls: calls
    };
  }

  /* ---------- persistence ---------- */
  var db = null;

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* private mode: keep in memory */ }
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.version === VERSION && Array.isArray(parsed.customers) && Array.isArray(parsed.calls)) {
          return parsed;
        }
      }
    } catch (e) { /* ignore corrupt data */ }
    var fresh = seed();
    try { localStorage.setItem(KEY, JSON.stringify(fresh)); } catch (e) { /* ignore */ }
    return fresh;
  }

  db = load();

  /* ---------- queries ---------- */
  function customerById(id) {
    for (var i = 0; i < db.customers.length; i++) if (db.customers[i].id === id) return db.customers[i];
    return null;
  }

  function callsForCustomer(id) {
    return db.calls.filter(function (k) { return k.customerId === id; })
      .sort(function (a, b) { return Date.parse(b.ts) - Date.parse(a.ts); });
  }

  function latestCallFor(id) {
    return callsForCustomer(id)[0] || null;
  }

  function periodStart(period) {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    if (period === 'today') return d.getTime();
    if (period === '7d') { d.setDate(d.getDate() - 6); return d.getTime(); }
    if (period === '30d') { d.setDate(d.getDate() - 29); return d.getTime(); }
    return 0;
  }

  function filteredCalls(opts) {
    opts = opts || {};
    var since = periodStart(opts.period || 'all');
    var q = (opts.q || '').trim().toLowerCase();
    var byId = {};
    db.customers.forEach(function (c) { byId[c.id] = c; });

    return db.calls.filter(function (k) {
      if (since && Date.parse(k.ts) < since) return false;
      var c = byId[k.customerId];
      if (!c) return false;
      if (opts.branch && c.branch !== opts.branch) return false;
      if (opts.agent && c.agent !== opts.agent) return false;
      if (opts.outcome && k.outcome !== opts.outcome) return false;
      if (opts.sentiment && k.sentiment !== opts.sentiment) return false;
      if (opts.followUpDue) {
        var today = isoDate(new Date());
        if (!k.followUp || k.followUp > today) return false;
      }
      if (q) {
        var hay = (c.name + ' ' + c.phone + ' ' + c.area + ' ' + c.branch + ' ' + (k.feedback || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    }).sort(function (a, b) { return Date.parse(b.ts) - Date.parse(a.ts); });
  }

  function statsFor(calls) {
    var outcomes = {};
    var sentiments = {};
    OUTCOMES.forEach(function (o) { outcomes[o.id] = 0; });
    SENTIMENTS.forEach(function (s) { sentiments[s.id] = 0; });

    calls.forEach(function (k) {
      outcomes[k.outcome] = (outcomes[k.outcome] || 0) + 1;
      if (k.outcome === 'answered' && k.sentiment) sentiments[k.sentiment] = (sentiments[k.sentiment] || 0) + 1;
    });

    var answered = outcomes.answered || 0;
    var positive = sentiments.positive || 0;
    return {
      total: calls.length,
      outcomes: outcomes,
      sentiments: sentiments,
      answered: answered,
      positive: positive,
      positiveRate: answered ? positive / answered : 0
    };
  }

  function customerSummary(id) {
    var calls = callsForCustomer(id);
    var answered = calls.filter(function (k) { return k.outcome === 'answered'; });
    var positive = answered.filter(function (k) { return k.sentiment === 'positive'; }).length;
    var angry = answered.filter(function (k) { return k.sentiment === 'angry'; }).length;
    return {
      calls: calls.length,
      answered: answered.length,
      positive: positive,
      angry: angry,
      positiveRate: answered.length ? positive / answered.length : 0,
      latest: calls[0] || null
    };
  }

  function followUpsDue() {
    var latest = {};
    db.calls.forEach(function (k) {
      var cur = latest[k.customerId];
      if (!cur || Date.parse(k.ts) > Date.parse(cur.ts)) latest[k.customerId] = k;
    });
    var today = isoDate(new Date());
    var out = [];
    Object.keys(latest).forEach(function (cid) {
      var k = latest[cid];
      var c = customerById(cid);
      if (!c || c.blacklisted) return;
      if (k.followUp && k.followUp <= today) out.push({ customer: c, call: k });
    });
    return out.sort(function (a, b) { return a.call.followUp.localeCompare(b.call.followUp); });
  }

  function blacklistStats() {
    var total = db.customers.length;
    var list = db.customers.filter(function (c) { return c.blacklisted; });
    var month = isoDate(new Date()).slice(0, 7);
    var thisMonth = list.filter(function (c) { return c.blacklistedAt && isoDate(c.blacklistedAt).slice(0, 7) === month; }).length;
    return {
      total: total,
      count: list.length,
      pct: total ? list.length / total : 0,
      thisMonth: thisMonth,
      list: list
    };
  }

  function suggestedForReview() {
    var since = Date.now() - 30 * 86400000;
    var out = [];
    db.customers.forEach(function (c) {
      if (c.blacklisted) return;
      var angry = db.calls.filter(function (k) {
        return k.customerId === c.id && k.sentiment === 'angry' && Date.parse(k.ts) >= since;
      });
      if (angry.length >= 2) {
        angry.sort(function (a, b) { return Date.parse(b.ts) - Date.parse(a.ts); });
        out.push({ customer: c, angryCount: angry.length, latest: angry[0] });
      }
    });
    return out.sort(function (a, b) { return b.angryCount - a.angryCount; });
  }

  /* ---------- mutations ---------- */
  function addCall(data) {
    var call = {
      id: uid('k'),
      customerId: data.customerId,
      agent: data.agent || (customerById(data.customerId) || {}).agent || AGENTS[0],
      ts: data.ts || new Date().toISOString(),
      outcome: data.outcome,
      sentiment: data.outcome === 'answered' ? (data.sentiment || null) : null,
      feedback: (data.feedback || '').trim(),
      followUp: data.followUp || null,
      source: 'manual'
    };
    db.calls.push(call);
    save();
    return call;
  }

  function addCustomer(data) {
    var customer = {
      id: uid('c'),
      name: (data.name || '').trim(),
      phone: (data.phone || '').trim(),
      area: (data.area || '').trim(),
      branch: data.branch || BRANCHES[0],
      agent: data.agent || AGENTS[0],
      product: data.product || PRODUCTS[0],
      language: data.language || 'Tamil',
      createdAt: new Date().toISOString(),
      blacklisted: false,
      blacklistReason: '',
      blacklistedAt: null
    };
    db.customers.push(customer);
    save();
    return customer;
  }

  function updateCustomer(id, patch) {
    var c = customerById(id);
    if (!c) return null;
    Object.keys(patch || {}).forEach(function (k) { c[k] = patch[k]; });
    save();
    return c;
  }

  function setBlacklisted(id, reason) {
    var c = customerById(id);
    if (!c) return null;
    c.blacklisted = true;
    c.blacklistReason = (reason || '').trim();
    c.blacklistedAt = new Date().toISOString();
    save();
    return c;
  }

  function removeBlacklist(id) {
    var c = customerById(id);
    if (!c) return null;
    c.blacklisted = false;
    c.blacklistReason = '';
    c.blacklistedAt = null;
    save();
    return c;
  }

  function resetDemo() {
    db = seed();
    save();
    return db;
  }

  function outcome(id) {
    for (var i = 0; i < OUTCOMES.length; i++) if (OUTCOMES[i].id === id) return OUTCOMES[i];
    return null;
  }

  function sentiment(id) {
    for (var i = 0; i < SENTIMENTS.length; i++) if (SENTIMENTS[i].id === id) return SENTIMENTS[i];
    return null;
  }

  CRM.store = {
    OUTCOMES: OUTCOMES,
    SENTIMENTS: SENTIMENTS,
    BRANCHES: BRANCHES,
    AGENTS: AGENTS,
    PRODUCTS: PRODUCTS,
    AREAS: AREAS,
    get customers() { return db.customers; },
    get calls() { return db.calls; },
    get createdAt() { return db.createdAt; },
    save: save,
    reset: resetDemo,
    addCall: addCall,
    addCustomer: addCustomer,
    updateCustomer: updateCustomer,
    setBlacklisted: setBlacklisted,
    removeBlacklist: removeBlacklist,
    customerById: customerById,
    callsForCustomer: callsForCustomer,
    latestCallFor: latestCallFor,
    filteredCalls: filteredCalls,
    statsFor: statsFor,
    customerSummary: customerSummary,
    followUpsDue: followUpsDue,
    blacklistStats: blacklistStats,
    suggestedForReview: suggestedForReview,
    periodStart: periodStart,
    outcome: outcome,
    sentiment: sentiment
  };
})();
