// Track_karo - sign-in page (index.html)
import { api, saveAuth, getToken, tokenLooksValid, clearAuth } from './api.js';

const WEB_ROLES = ['admin', 'branch_manager'];

function init() {
  const stored = getToken();
  if (stored && tokenLooksValid(stored)) {
    location.replace('app.html');
    return;
  }
  if (stored) clearAuth();

  const form = document.getElementById('form-login');
  const useridEl = document.getElementById('login-userid');
  const pwEl = document.getElementById('login-password');
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('btn-login');
  const toggle = document.getElementById('btn-toggle-password');

  const showError = (msg) => {
    errEl.textContent = msg || '';
    errEl.hidden = !msg;
  };

  toggle?.addEventListener('click', () => {
    const show = pwEl.type === 'password';
    pwEl.type = show ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(show));
    toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    toggle.classList.toggle('is-active', show);
    const eye = toggle.querySelector('.icon-eye');
    const eyeOff = toggle.querySelector('.icon-eye-off');
    if (eye) eye.toggleAttribute('hidden', show);
    if (eyeOff) eyeOff.toggleAttribute('hidden', !show);
    pwEl.focus();
  });

  [useridEl, pwEl].forEach((el) => el.addEventListener('input', () => showError('')));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userid = useridEl.value.trim();
    const password = pwEl.value;
    if (!userid || !password) {
      showError('Enter your user ID and password.');
      (userid ? pwEl : useridEl).focus();
      return;
    }
    showError('');
    btn.disabled = true;
    btn.classList.add('is-loading');
    try {
      const { token, user } = await api('/login', { method: 'POST', body: { userid, password }, auth: false });
      if (!token || !user) throw new Error('Unexpected response from server.');
      if (!WEB_ROLES.includes(user.role)) {
        showError(user.role === 'field_officer'
          ? 'Field officers should use the Track_karo mobile app.'
          : 'This account cannot use the admin website.');
        return;
      }
      saveAuth(token, user);
      location.replace('app.html');
    } catch (err) {
      showError(err.status === 401 ? 'Wrong user ID or password.' : (err.message || 'Sign-in failed.'));
    } finally {
      btn.disabled = false;
      btn.classList.remove('is-loading');
    }
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
