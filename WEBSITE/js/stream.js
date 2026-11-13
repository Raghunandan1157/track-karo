// Track_karo - ONE Server-Sent Events stream for the whole app (no polling).
// Closed while the tab is hidden, reopened when visible (and the visible view refetches once).
import { getToken, get } from './api.js';
import { applyLocation, emit } from './state.js';

let es = null;
let retryTimer = null;
let retryDelay = 3000;
let started = false;
let hiddenSince = 0;

function setStatus(stateName) {
  const box = document.getElementById('live-status');
  const txt = document.getElementById('live-status-text');
  const labels = { live: 'Live', reconnecting: 'Reconnecting', paused: 'Paused' };
  if (box) box.dataset.state = stateName;
  if (txt) txt.textContent = labels[stateName] || stateName;
  emit('stream:status', stateName);
}

function parse(e) {
  try { return JSON.parse(e.data); } catch { return null; }
}

function open() {
  clearTimeout(retryTimer);
  if (es) return;
  const token = getToken();
  if (!token) return;
  setStatus('reconnecting');
  es = new EventSource('/api/stream?token=' + encodeURIComponent(token));

  es.onopen = () => { retryDelay = 3000; setStatus('live'); };
  es.onerror = () => {
    if (!es) return;
    if (es.readyState === EventSource.CLOSED) {
      // The browser gave up (e.g. HTTP error). Check the session, then retry with backoff.
      es.close();
      es = null;
      setStatus('reconnecting');
      get('/me').catch(() => { /* a 401 redirects to sign-in inside api() */ });
      retryTimer = setTimeout(() => { if (!document.hidden) open(); }, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 60000);
    } else {
      // Normal: server ends the stream every ~4 min; EventSource reconnects by itself.
      setStatus('reconnecting');
    }
  };

  es.addEventListener('location', (e) => {
    const d = parse(e);
    if (!d) return;
    const officer = applyLocation(d);
    emit('location', { event: d, officer });
  });
  es.addEventListener('customer', (e) => {
    const d = parse(e);
    if (d) emit('customer', d);
  });
  es.addEventListener('alert', (e) => {
    const d = parse(e);
    if (d) emit('alert', d);
  });
  es.addEventListener('ping', () => { if (es && es.readyState === EventSource.OPEN) setStatus('live'); });
}

function close() {
  clearTimeout(retryTimer);
  if (es) { es.close(); es = null; }
}

function onVisibility() {
  if (document.hidden) {
    hiddenSince = Date.now();
    close();
    setStatus('paused');
  } else {
    open();
    // Events were missed while hidden: refetch the visible view once.
    if (hiddenSince) emit('stream:resume', { hiddenMs: Date.now() - hiddenSince });
    hiddenSince = 0;
  }
}

export function startStream() {
  if (started) return;
  started = true;
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', close);
  window.addEventListener('pageshow', (e) => {
    if (e.persisted && !document.hidden) { open(); emit('stream:resume', { hiddenMs: 0 }); }
  });
  if (document.hidden) { hiddenSince = Date.now(); setStatus('paused'); }
  else open();
}

export function stopStream() {
  close();
  setStatus('paused');
}
