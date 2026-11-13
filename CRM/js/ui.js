/* ==========================================================================
   Track_karo CRM - shared UI helpers
   ========================================================================== */
(function () {
  'use strict';

  var CRM = window.CRM = window.CRM || {};

  var ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 16v-4M12 16V8M17 16V5"/>',
    ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
    printer: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    check: '<path d="m20 6-11 11-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    home: '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M9 22V12h6v10"/>',
    refresh: '<path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.8-3.4L23 10M1 14l4.7 4.4A9 9 0 0 0 20.5 15"/>',
    filter: '<path d="M22 3H2l8 9.46V19l4 2v-8.54Z"/>',
    note: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8M10 9H8"/>',
    alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
    smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'
  };

  function icon(name, cls) {
    return '<svg class="icon ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (ICONS[name] || '') + '</svg>';
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function fmtInt(n) { return new Intl.NumberFormat('en-IN').format(Number(n) || 0); }

  function pctNum(part, total) { return total ? (part / total) * 100 : 0; }

  function pct(part, total, digits) {
    if (!total) return '0%';
    var value = (part / total) * 100;
    var text = digits ? value.toFixed(digits).replace(/\.0+$/, '') : String(Math.round(value));
    return text + '%';
  }

  function fmtDate(value) {
    if (!value) return '-';
    var d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  }

  function fmtDateLong(value) {
    if (!value) return '-';
    var d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function fmtDateTime(value) {
    if (!value) return '-';
    var d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return '-';
    return fmtDate(d) + ', ' + d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  function fmtTime(value) {
    if (!value) return '-';
    var d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  function timeAgo(value) {
    if (!value) return '-';
    var d = new Date(value);
    var now = new Date();
    var startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    var startThat = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    var diffDays = Math.round((startToday - startThat) / 86400000);
    if (diffDays === 0) return 'Today, ' + fmtTime(d);
    if (diffDays === 1) return 'Yesterday, ' + fmtTime(d);
    if (diffDays < 7) return diffDays + ' days ago';
    return fmtDateTime(d);
  }

  function isoDate(value) {
    var d = value instanceof Date ? value : new Date(value);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function startOfToday() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function initials(name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    var first = parts[0].charAt(0);
    var last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
    return (first + last).toUpperCase();
  }

  function avatar(name, cls) {
    return '<span class="avatar ' + (cls || '') + '" aria-hidden="true">' + esc(initials(name)) + '</span>';
  }

  function badge(text, tone, plain) {
    return '<span class="badge badge--' + (tone || 'grey') + (plain ? ' badge--plain' : '') + '">' + esc(text) + '</span>';
  }

  function outcomeBadge(id) {
    var o = CRM.store.outcome(id);
    return o ? badge(o.label, o.tone) : '<span class="faint">-</span>';
  }

  function sentimentBadge(id) {
    var s = CRM.store.sentiment(id);
    return s ? badge(s.label, s.tone) : '<span class="faint">-</span>';
  }

  function statusBadge(customer) {
    if (customer && customer.blacklisted) return badge('Blacklisted', 'red');
    return badge('Active', 'green');
  }

  function donut(segments, size, thickness) {
    size = size || 168;
    thickness = thickness || 22;
    var total = segments.reduce(function (sum, s) { return sum + Number(s.value || 0); }, 0);
    var r = (size - thickness) / 2;
    var cx = size / 2;
    var cy = size / 2;
    var circumference = 2 * Math.PI * r;
    var offset = 0;

    var arcs = segments.filter(function (s) { return Number(s.value) > 0; }).map(function (s) {
      var share = circumference * Number(s.value) / total;
      var length = Math.max(share - 2, 0.5);
      var arc = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + s.color +
        '" stroke-width="' + thickness + '" stroke-dasharray="' + length + ' ' + (circumference - length) +
        '" stroke-dashoffset="' + (-offset) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')"/>';
      offset += share;
      return arc;
    }).join('');

    return '<svg class="donut" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="Breakdown chart">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#EEF2F7" stroke-width="' + thickness + '"/>' +
      (arcs || '') +
      '</svg>';
  }

  function emptyState(text, iconName) {
    return '<div class="empty-state">' + icon(iconName || 'search') + '<div>' + esc(text) + '</div></div>';
  }

  function callRow(call) {
    var customer = CRM.store.customerById(call.customerId);
    if (!customer) return '';
    return '<button type="button" class="call-row" data-customer="' + esc(customer.id) + '">' +
      avatar(customer.name) +
      '<span class="call-main">' +
        '<span class="call-name">' + esc(customer.name) + '</span>' +
        '<span class="call-meta">' + esc(customer.phone) + ' &middot; ' + esc(customer.branch) + '</span>' +
        (call.feedback ? '<span class="call-note">&ldquo;' + esc(call.feedback) + '&rdquo;</span>' : '') +
      '</span>' +
      '<span class="call-tags">' + outcomeBadge(call.outcome) + sentimentBadge(call.sentiment) + '</span>' +
      '<span class="call-side"><time>' + esc(fmtDateTime(call.ts)) + '</time><small>' + esc(call.agent || '') + '</small></span>' +
    '</button>';
  }

  var toastTimer = null;
  function toast(title, detail, kind) {
    var stack = document.getElementById('toast-stack');
    if (!stack) return null;
    var el = document.createElement('div');
    el.className = 'toast' + (kind === 'error' ? ' toast--error' : '');
    el.setAttribute('role', 'status');
    el.innerHTML = icon(kind === 'error' ? 'alert' : 'check') +
      '<div><strong>' + esc(title) + '</strong>' + (detail ? '<span>' + esc(detail) + '</span>' : '') + '</div>';
    stack.appendChild(el);
    while (stack.children.length > 3) stack.removeChild(stack.firstChild);
    var remove = function () { if (el.parentNode) el.parentNode.removeChild(el); };
    el.addEventListener('click', remove);
    setTimeout(remove, 4200);
    return el;
  }

  var modalStack = [];

  function openModal(opts) {
    opts = opts || {};
    var root = document.getElementById('modal-root');
    if (!root) return null;

    var wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML =
      '<div class="modal ' + (opts.size || '') + '" role="dialog" aria-modal="true" aria-labelledby="modal-title">' +
        '<header class="modal-head"><h2 id="modal-title">' + esc(opts.title || '') + '</h2>' +
          '<button type="button" class="icon-btn" data-modal-close aria-label="Close">' + icon('x') + '</button>' +
        '</header>' +
        '<div class="modal-body">' + (opts.body || '') + '</div>' +
        (opts.footer ? '<footer class="modal-foot">' + opts.footer + '</footer>' : '') +
      '</div>';
    root.appendChild(wrap);
    document.body.classList.add('modal-open');

    var modal = wrap.querySelector('.modal');
    var closed = false;

    function close() {
      if (closed) return;
      closed = true;
      wrap.remove();
      modalStack = modalStack.filter(function (x) { return x !== close; });
      document.removeEventListener('keydown', onKey);
      if (!root.children.length) document.body.classList.remove('modal-open');
      if (typeof opts.onClose === 'function') opts.onClose();
    }

    modalStack.push(close);
    wrap.addEventListener('mousedown', function (e) { if (e.target === wrap) close(); });
    wrap.querySelector('[data-modal-close]').addEventListener('click', close);

    var onKey = function (e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
    };
    document.addEventListener('keydown', onKey);

    if (typeof opts.onMount === 'function') opts.onMount(modal, close);

    requestAnimationFrame(function () {
      var target = modal.querySelector('input:not([type=hidden]), select, textarea, button');
      if (target) target.focus();
    });

    return { el: wrap, modal: modal, close: close };
  }

  function confirmDialog(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var settled = false;
      function finish(value) {
        if (settled) return;
        settled = true;
        resolve(value);
      }
      var handle = openModal({
        title: opts.title || 'Are you sure?',
        size: 'modal--sm',
        body: '<p class="confirm-text">' + esc(opts.message || '') + '</p>',
        footer: '<button type="button" class="btn btn-ghost" data-cancel>Cancel</button>' +
          '<button type="button" class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') + '" data-ok>' + esc(opts.confirmLabel || 'Confirm') + '</button>',
        onMount: function (el) {
          el.querySelector('[data-cancel]').addEventListener('click', function () { finish(false); handle.close(); });
          el.querySelector('[data-ok]').addEventListener('click', function () { finish(true); handle.close(); });
        },
        onClose: function () { finish(false); }
      });
    });
  }

  function customerOptions(selectedId) {
    var list = CRM.store.customers.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
    return '<option value="">Select a customer...</option>' + list.map(function (c) {
      return '<option value="' + esc(c.id) + '"' + (c.id === selectedId ? ' selected' : '') + '>' +
        esc(c.name) + ' - ' + esc(c.phone) + (c.blacklisted ? ' (blacklisted)' : '') + '</option>';
    }).join('');
  }

  function customerChip(customer) {
    if (!customer) return '';
    return '<span class="mini-item" style="display:inline-flex;padding:4px 8px;border-radius:999px">' +
      '<strong style="font-size:.74rem">' + esc(customer.name) + '</strong>' +
      '<span style="font-size:.7rem">' + esc(customer.phone) + '</span></span>';
  }

  function csvCell(value) {
    var text = String(value == null ? '' : value);
    if (/^[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function download(filename, text, type) {
    var blob = new Blob([text], { type: type || 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function debounce(fn, delay) {
    var timer = null;
    return function () {
      var args = arguments;
      var self = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(self, args); }, delay || 150);
    };
  }

  function periodTabs(active, cls) {
    var options = [['today', 'Today'], ['7d', '7 days'], ['30d', '30 days'], ['all', 'All']];
    return '<div class="segmented ' + (cls || '') + '" role="tablist" aria-label="Period">' +
      options.map(function (opt) {
        return '<button type="button" role="tab" data-period="' + opt[0] + '"' +
          (opt[0] === active ? ' class="is-active" aria-selected="true"' : ' aria-selected="false"') + '>' + opt[1] + '</button>';
      }).join('') + '</div>';
  }

  CRM.ui = {
    icon: icon,
    esc: esc,
    fmtInt: fmtInt,
    pct: pct,
    pctNum: pctNum,
    fmtDate: fmtDate,
    fmtDateLong: fmtDateLong,
    fmtDateTime: fmtDateTime,
    fmtTime: fmtTime,
    timeAgo: timeAgo,
    isoDate: isoDate,
    startOfToday: startOfToday,
    initials: initials,
    avatar: avatar,
    badge: badge,
    outcomeBadge: outcomeBadge,
    sentimentBadge: sentimentBadge,
    statusBadge: statusBadge,
    donut: donut,
    emptyState: emptyState,
    callRow: callRow,
    toast: toast,
    openModal: openModal,
    confirmDialog: confirmDialog,
    customerOptions: customerOptions,
    customerChip: customerChip,
    csvCell: csvCell,
    download: download,
    debounce: debounce,
    periodTabs: periodTabs
  };
})();
