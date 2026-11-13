// Track_karo - API client (same-origin /api). Token + user live in localStorage.

const TOKEN_KEY = 'tk_token';
const USER_KEY = 'tk_user';

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}

export function getStoredUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
}

export function saveAuth(token, user) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch { /* storage blocked: session will not persist */ }
}

export function saveUser(user) { saveAuth(null, user); }

/** Local-only demo session used by the Recovery module preview. */
export const DEMO_TOKEN = 'demo-recovery';

export function isDemoSession() {
  return getToken() === DEMO_TOKEN;
}

export function startDemoSession(user) {
  saveAuth(DEMO_TOKEN, user);
}

export function clearAuth() {
  try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); } catch { /* ignore */ }
}

/** True when the JWT exists and its `exp` (if readable) is in the future. */
export function tokenLooksValid(token = getToken()) {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return true; // not a JWT we can read; let the server decide
  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json);
    return !payload.exp || payload.exp * 1000 > Date.now();
  } catch { return true; }
}

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

let redirecting = false;
export function logoutAndRedirect() {
  clearAuth();
  if (redirecting) return;
  redirecting = true;
  location.replace('index.html');
}

/** Build "?a=1&b=2", skipping empty/null values. */
export function qs(params = {}) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '' || v === false) continue;
    sp.set(k, v === true ? '1' : String(v));
  }
  const s = sp.toString();
  return s ? '?' + s : '';
}

/**
 * Call the API. path is relative to /api (e.g. '/me').
 * opts: { method, body, query, auth (default true) }
 */
export async function api(path, { method = 'GET', body, query, auth = true } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = getToken();
    if (!token) { logoutAndRedirect(); throw new ApiError('Not signed in', 401); }
    headers.Authorization = 'Bearer ' + token;
  }
  let res;
  try {
    res = await fetch('/api' + path + (query ? qs(query) : ''), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new ApiError('Network error. Check your connection and try again.', 0);
  }
  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = null; }
  }
  if (res.status === 401 && auth) {
    logoutAndRedirect();
    throw new ApiError((data && data.error) || 'Session expired', 401, data);
  }
  if (!res.ok) {
    const msg = (data && data.error) || `Request failed (${res.status})`;
    throw new ApiError(msg, res.status, data);
  }
  return data ?? {};
}

export const get = (path, query) => api(path, { query });
export const post = (path, body = {}) => api(path, { method: 'POST', body });
export const put = (path, body = {}) => api(path, { method: 'PUT', body });
export const del = (path) => api(path, { method: 'DELETE' });
