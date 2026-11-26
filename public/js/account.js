/** Sign-in screen, account sheet and the "unsaved changes" dot */
import { terminate, clearIndexedDbPersistence } from '../vendor/firebase/firebase-firestore.js';
import { $ } from './dom.js';
import { t, getLanguage } from './i18n.js';
import { auth, firestore, signIn, signUp, resetPassword, logOut } from './firebase.js';
import { db } from './db.js';

/* ---------- Sign in ---------- */

const ERRORS = {
  'auth/invalid-credential': 'auth.err.credentials',
  'auth/wrong-password': 'auth.err.credentials',
  'auth/user-not-found': 'auth.err.credentials',
  'auth/invalid-email': 'auth.err.email',
  'auth/missing-email': 'auth.err.email',
  'auth/email-already-in-use': 'auth.err.taken',
  'auth/weak-password': 'auth.err.weak',
  'auth/missing-password': 'auth.err.weak',
  'auth/network-request-failed': 'auth.err.network',
  'auth/too-many-requests': 'auth.err.tooMany',
};

export function initAuth() {
  const form = $('#auth-form');
  const errorEl = $('#auth-error');
  const submit = $('#auth-submit');
  const switchBtn = $('#auth-switch');
  let signingUp = false;

  const showError = (key) => {
    errorEl.textContent = t(key);
    errorEl.hidden = false;
  };
  const setMode = (up) => {
    signingUp = up;
    submit.textContent = t(up ? 'auth.signUp' : 'auth.signIn');
    switchBtn.textContent = t(up ? 'auth.toSignIn' : 'auth.toSignUp');
    form.elements.password.autocomplete = up ? 'new-password' : 'current-password';
    errorEl.hidden = true;
  };

  switchBtn.addEventListener('click', () => setMode(!signingUp));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    if (!email) return showError('auth.err.email');
    if (signingUp && password.length < 6) return showError('auth.err.weak');
    errorEl.hidden = true;
    submit.disabled = true;
    try {
      await (signingUp ? signUp : signIn)(email, password);
      location.reload(); // start over with the user's data
    } catch (error) {
      console.error(error);
      showError(ERRORS[error.code] ?? 'auth.err.other');
      submit.disabled = false;
    }
  });

  $('#auth-reset').addEventListener('click', async () => {
    const email = form.elements.email.value.trim();
    if (!email) return showError('auth.err.resetEmail');
    try {
      await resetPassword(email, getLanguage());
      errorEl.hidden = true;
      alert(t('auth.resetSent', { email }));
    } catch (error) {
      showError(ERRORS[error.code] ?? 'auth.err.other');
    }
  });
}

/* ---------- Account setup after sign-in ---------- */

/** Give a brand-new account the starter dishes. Runs on every start; does nothing once done. */
export async function setupAccount() {
  if (db.get('meta', 'account')) return;
  const onServer = await db.fetchFromServer('meta', 'account');
  if (onServer !== null) return; // exists, or offline — try next time
  const now = Date.now();
  const starters = (await db.fetchShared('starterDishes')).sort((a, b) => a.order - b.order);
  db.batch(starters.map(({ id, order, ...dish }) => ({ put: 'dishes', value: { ...dish, createdAt: now, updatedAt: now } })));
  db.put('meta', { id: 'account', createdAt: now });
}

/* ---------- Account sheet ---------- */

const dialog = $('#account-dialog');
const button = $('#account-btn');

function statusText() {
  if (!db.pending()) return t('account.synced');
  return navigator.onLine ? t('account.syncing') : t('account.offline');
}

function updateStatus() {
  button.classList.toggle('has-pending', db.pending() > 0);
  $('#account-status').textContent = statusText();
}

export function initAccount() {
  db.onStatusChange(updateStatus);
  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);
  updateStatus();

  button.addEventListener('click', () => {
    $('#account-email').textContent = auth.currentUser?.email ?? '';
    updateStatus();
    dialog.showModal();
  });

  $('#account-reset').addEventListener('click', async () => {
    const email = auth.currentUser?.email;
    try {
      await resetPassword(email, getLanguage());
      alert(t('auth.resetSent', { email }));
    } catch (error) {
      alert(t(ERRORS[error.code] ?? 'auth.err.other'));
    }
  });

  $('#account-logout').addEventListener('click', async () => {
    if (!confirm(t(db.pending() ? 'account.logOutPending' : 'account.logOutConfirm'))) return;
    await logOut();
    // Remove the user's data from the device
    await terminate(firestore);
    await clearIndexedDbPersistence(firestore).catch((error) => console.error(error));
    location.reload();
  });
}
