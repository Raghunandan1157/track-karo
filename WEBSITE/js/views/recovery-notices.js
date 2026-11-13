// Recovery notices: demand notices, legal notices and summons with a printable preview.
import {
  $, cloneTpl, fill, setEmpty, chip, toast, toastError, openDialog, closeDialog, showError,
} from '../ui.js';
import {
  CASES, NOTICES, NOTICE_TYPE_LABELS, NOTICE_STATUS_LABELS, caseById, addNotice,
  fmtDate, fmtDateShort, inr, isoIn, setNoticeStatus, todayISO,
} from '../recovery/data.js';

const SOCIETY = 'Track_karo Co-operative Credit Society Ltd.';
const SOCIETY_ADDRESS = 'Sahyadri Bhavan, Station Road, Pune 411 001 · Reg. No. PNA/(CO-OP)/2011/4471';

let previewId = null;

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function noticeTypeChip(type) {
  return chip(NOTICE_TYPE_LABELS[type] || type, type);
}

function nextStatus(notice) {
  if (notice.status === 'draft') return { status: 'dispatched', label: 'Mark dispatched' };
  if (notice.status === 'dispatched') return { status: 'delivered', label: 'Mark delivered' };
  return null;
}

function filtered() {
  const q = ($('rec-notices-search')?.value || '').trim().toLowerCase();
  const type = $('rec-notices-type')?.value || '';
  const status = $('rec-notices-status')?.value || '';
  return NOTICES.filter((n) => {
    const c = caseById(n.caseId);
    if (type && n.type !== type) return false;
    if (status && n.status !== status) return false;
    if (q) {
      const hay = `${n.id} ${n.caseId} ${c?.borrower || ''} ${c?.branch || ''} ${n.ref}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => (a.issuedAt < b.issuedAt ? 1 : a.issuedAt > b.issuedAt ? -1 : 0));
}

function renderStats() {
  const count = (s) => NOTICES.filter((n) => n.status === s).length;
  const set = (id, value) => { const node = $(id); if (node) node.textContent = String(value); };
  set('rec-notice-stat-draft', count('draft'));
  set('rec-notice-stat-dispatched', count('dispatched'));
  set('rec-notice-stat-delivered', count('delivered'));
  set('rec-notice-stat-response', NOTICES.filter((n) => n.response).length);
}

function render() {
  renderStats();
  const tbody = $('rec-notices-table');
  if (!tbody) return;
  tbody.textContent = '';
  const rows = filtered();
  for (const n of rows) {
    const c = caseById(n.caseId);
    const tr = cloneTpl('tpl-rec-notice-row');
    tr.dataset.noticeId = n.id;
    fill(tr, {
      notice_id: n.id,
      type: noticeTypeChip(n.type),
      case_id: n.caseId,
      borrower: c?.borrower || '-',
      issued: fmtDate(n.issuedAt),
      mode: n.mode,
      status: chip(NOTICE_STATUS_LABELS[n.status] || n.status, n.status),
      due: fmtDateShort(n.dueAt),
    });
    const advance = tr.querySelector('[data-action="advance"]');
    const next = nextStatus(n);
    if (advance) {
      advance.hidden = !next;
      if (next) advance.textContent = next.label;
    }
    tbody.appendChild(tr);
  }
  setEmpty('rec-notices', rows.length === 0);
  const count = $('rec-notices-count');
  if (count) count.textContent = `${rows.length} notice${rows.length === 1 ? '' : 's'}`;
}

function letterBody(n) {
  const c = caseById(n.caseId);
  if (!c) return '';
  const amount = n.type === 'demand' ? c.overdue || c.outstanding : c.outstanding;
  if (n.body) return `<p>${escapeHtml(n.body).replace(/\n/g, '<br>')}</p>`;
  if (n.type === 'legal') {
    return `<p>Under instructions from the Society and in continuation of the demand notice, this is a <strong>final notice</strong> calling upon you to clear the dues of <strong>${inr(amount)}</strong> within 15 days of receipt of this notice.</p>
      <p>Failing compliance, the Society will be constrained to initiate legal proceedings before the competent authority at your sole risk, cost and consequences, including interest and legal expenses.</p>`;
  }
  if (n.type === 'summons') {
    return `<p>You are hereby summoned to appear before the Co-operative Court, Pune, on <strong>${fmtDate(n.dueAt)}</strong> in connection with Case No. ${escapeHtml(n.ref || '-')} filed by the Society for recovery of <strong>${inr(amount)}</strong>.</p>
      <p>Kindly appear in person or through your authorised representative, failing which the matter will be proceeded with ex parte.</p>`;
  }
  return `<p>Our records show that an amount of <strong>${inr(amount)}</strong> is overdue on your ${escapeHtml(c.loanType)} account <strong>${escapeHtml(c.loanNo)}</strong>. Despite reminders, the amount remains unpaid.</p>
    <p>You are hereby called upon to pay the overdue amount within <strong>15 days</strong> of receipt of this notice, together with applicable interest and charges, failing which the Society shall be compelled to initiate recovery action, including legal proceedings, at your cost.</p>`;
}

function noticeHtml(n) {
  const c = caseById(n.caseId);
  const amount = c ? (n.type === 'demand' ? c.overdue || c.outstanding : c.outstanding) : 0;
  const typeLabel = NOTICE_TYPE_LABELS[n.type] || 'Notice';
  return `
    <article class="notice-sheet">
      <header class="notice-head">
        <div class="notice-brand">
          <span class="notice-logo">TK</span>
          <div>
            <h1>${escapeHtml(SOCIETY)}</h1>
            <p>${escapeHtml(SOCIETY_ADDRESS)}</p>
          </div>
        </div>
        <div class="notice-ref">
          <span>${typeLabel}</span>
          <strong>${escapeHtml(n.id)}</strong>
          <span>${fmtDate(n.issuedAt)}</span>
        </div>
      </header>

      <div class="notice-to">
        <p class="notice-label">To</p>
        <p><strong>${escapeHtml(c?.borrower || '-')}</strong><br>
        Member No. ${escapeHtml(c?.memberNo || '-')}<br>
        ${escapeHtml(c?.village || '')}${c?.village ? ', ' : ''}${escapeHtml(c?.branch || '')} Branch</p>
        <p>Loan: ${escapeHtml(c?.loanType || '-')} · ${escapeHtml(c?.loanNo || '-')}</p>
      </div>

      <h2 class="notice-subject">Subject: ${typeLabel} for recovery of overdue dues</h2>

      <div class="notice-body">
        <p>Dear Sir / Madam,</p>
        ${letterBody(n)}
        <table class="notice-table">
          <tbody>
            <tr><th>Total outstanding</th><td>${inr(c?.outstanding || 0)}</td></tr>
            <tr><th>Overdue amount</th><td>${inr(c?.overdue || 0)}</td></tr>
            <tr><th>Amount demanded</th><td><strong>${inr(amount)}</strong></td></tr>
            <tr><th>Payment deadline</th><td>${fmtDate(n.dueAt)}</td></tr>
          </tbody>
        </table>
        <p>Payment may be made by NEFT/UPI to the Society account or at the ${escapeHtml(c?.branch || '')} branch. This notice is issued without prejudice to the Society's rights.</p>
      </div>

      <footer class="notice-foot">
        <div>
          <p>Yours faithfully,</p>
          <p class="notice-sign">Authorised Officer</p>
          <p>Recovery Department</p>
        </div>
        <div class="notice-stamp">
          <span>${fmtDate(n.issuedAt)}</span>
          <span>${escapeHtml(n.mode)}</span>
        </div>
      </footer>
      <p class="notice-small">Ref: ${escapeHtml(n.ref || 'Pending dispatch')} · This is a computer-generated notice for the UI demo.</p>
    </article>`;
}

function openPreview(notice) {
  if (!notice) return;
  previewId = notice.id;
  $('rec-notice-sheet').innerHTML = noticeHtml(notice);
  $('modal-rec-notice-title').textContent = `${NOTICE_TYPE_LABELS[notice.type]} · ${notice.id}`;
  const action = $('btn-rec-notice-action');
  const next = nextStatus(notice);
  action.hidden = !next;
  if (next) action.textContent = next.label;
  openDialog($('modal-rec-notice-preview'));
}

export function openNoticeForm(caseId) {
  const form = $('form-rec-notice');
  if (!form) return;
  form.reset();
  showError($('rec-notice-error'), '');
  const sel = $('rec-notice-case');
  sel.textContent = '';
  sel.appendChild(new Option('Select a case', ''));
  for (const c of CASES.filter((x) => (x.status === 'active' && x.outstanding > 0) || x.id === caseId)) {
    sel.appendChild(new Option(`${c.id} · ${c.borrower} (${c.branch})`, c.id));
  }
  $('rec-notice-type').value = 'demand';
  $('rec-notice-mode').value = 'Registered post';
  $('rec-notice-due').value = isoIn(15);
  $('rec-notice-ref').value = '';
  $('rec-notice-body').value = '';
  if (caseId) {
    sel.value = caseId;
    const c = caseById(caseId);
    $('rec-notice-amount').value = c ? String(c.overdue || c.outstanding) : '';
  } else {
    $('rec-notice-amount').value = '';
  }
  openDialog($('modal-rec-notice'));
  sel.focus();
}

function submitNotice(e) {
  e.preventDefault();
  const err = $('rec-notice-error');
  showError(err, '');
  const caseId = $('rec-notice-case').value;
  const c = caseById(caseId);
  if (!c) { showError(err, 'Select a case for this notice.'); $('rec-notice-case').focus(); return; }
  const type = $('rec-notice-type').value;
  const notice = addNotice({
    caseId,
    type,
    issuedAt: todayISO(),
    dueAt: $('rec-notice-due').value || isoIn(15),
    mode: $('rec-notice-mode').value,
    ref: $('rec-notice-ref').value.trim(),
    body: $('rec-notice-body').value.trim(),
  });
  // The amount field is a visual confirmation; the letter always uses the live case balance.
  $('rec-notice-amount').value = '';
  closeDialog($('modal-rec-notice'));
  render();
  toast('Notice drafted', `${NOTICE_TYPE_LABELS[type]} ${notice.id} · ${c.borrower}`, 'success');
  openPreview(notice);
}

function printNotice(notice) {
  if (!notice) return;
  const win = window.open('', '_blank', 'width=900,height=760');
  if (!win) { toastError(new Error('Allow pop-ups to print the notice.'), 'Could not open print view'); return; }
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(notice.id)}</title>
    <style>
      body { margin: 0; padding: 24px; background: #fff; color: #111; font-family: Georgia, 'Times New Roman', serif; }
      .notice-sheet { max-width: 780px; margin: 0 auto; }
      .notice-head { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #14285A; padding-bottom: 14px; }
      .notice-brand { display: flex; gap: 12px; align-items: flex-start; }
      .notice-logo { display: inline-flex; width: 46px; height: 46px; align-items: center; justify-content: center; background: #14285A; color: #fff; border-radius: 8px; font-family: Arial, sans-serif; font-weight: 700; }
      .notice-brand h1 { margin: 0; font-size: 17px; color: #14285A; }
      .notice-brand p, .notice-ref span { margin: 3px 0 0; font-size: 10px; color: #555; font-family: Arial, sans-serif; }
      .notice-ref { text-align: right; font-family: Arial, sans-serif; font-size: 11px; }
      .notice-ref strong { display: block; font-size: 13px; color: #14285A; margin: 3px 0; }
      .notice-to { margin: 22px 0; font-size: 13px; }
      .notice-label { font-family: Arial, sans-serif; font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: #777; margin-bottom: 4px; }
      .notice-subject { font-size: 13px; text-decoration: underline; margin: 18px 0; }
      .notice-body { font-size: 13px; line-height: 1.65; }
      .notice-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-family: Arial, sans-serif; font-size: 12px; }
      .notice-table th, .notice-table td { border: 1px solid #bbb; padding: 7px 9px; text-align: left; }
      .notice-table th { background: #F3F6FA; width: 45%; }
      .notice-foot { display: flex; justify-content: space-between; margin-top: 40px; font-size: 12px; }
      .notice-sign { margin-top: 42px; border-top: 1px solid #333; display: inline-block; padding-top: 4px; font-weight: 700; }
      .notice-stamp { text-align: right; font-family: Arial, sans-serif; font-size: 10px; color: #555; }
      .notice-small { margin-top: 26px; font-family: Arial, sans-serif; font-size: 9px; color: #777; }
      @page { size: A4 portrait; margin: 16mm; }
    </style></head><body>${noticeHtml(notice)}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 300);
}

function init() {
  $('btn-rec-new-notice')?.addEventListener('click', () => openNoticeForm(null));
  $('form-rec-notice')?.addEventListener('submit', submitNotice);
  $('rec-notices-search')?.addEventListener('input', render);
  $('rec-notices-type')?.addEventListener('change', render);
  $('rec-notices-status')?.addEventListener('change', render);
  $('rec-notice-case')?.addEventListener('change', () => {
    const c = caseById($('rec-notice-case').value);
    if (c) $('rec-notice-amount').value = String($('rec-notice-type').value === 'demand' ? (c.overdue || c.outstanding) : c.outstanding);
  });
  $('rec-notice-type')?.addEventListener('change', () => {
    const c = caseById($('rec-notice-case').value);
    if (c) $('rec-notice-amount').value = String($('rec-notice-type').value === 'demand' ? (c.overdue || c.outstanding) : c.outstanding);
  });
  $('rec-notices-table')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    const tr = btn?.closest('tr[data-notice-id]');
    if (!tr) return;
    const notice = NOTICES.find((n) => n.id === tr.dataset.noticeId);
    if (!notice) return;
    if (btn.dataset.action === 'preview') openPreview(notice);
    if (btn.dataset.action === 'advance') {
      const next = nextStatus(notice);
      if (next) setNoticeStatus(notice, next.status);
      render();
      toast('Notice updated', `${notice.id} · ${NOTICE_STATUS_LABELS[notice.status]}`, 'success');
    }
  });
  $('btn-rec-notice-action')?.addEventListener('click', () => {
    const notice = NOTICES.find((n) => n.id === previewId);
    const next = nextStatus(notice);
    if (!notice || !next) return;
    setNoticeStatus(notice, next.status);
    closeDialog($('modal-rec-notice-preview'));
    render();
    toast('Notice updated', `${notice.id} · ${NOTICE_STATUS_LABELS[notice.status]}`, 'success');
  });
  $('btn-rec-print-notice')?.addEventListener('click', () => {
    printNotice(NOTICES.find((n) => n.id === previewId));
  });
}

export default {
  init,
  show: render,
};
