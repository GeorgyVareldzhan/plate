/** Account: sign-in errors, setup of a new account, sync status and logging out */
import { shallowRef } from 'vue';
import { terminate, clearIndexedDbPersistence } from 'firebase/firestore';
import { firestore, logOut } from './firebase.js';
import { db } from './db.js';

/** Firebase error code → translation key */
export const AUTH_ERRORS = {
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

export const authErrorKey = (error) => AUTH_ERRORS[error?.code] ?? 'auth.err.other';

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

/* ---------- Sync status ---------- */

/** Writes not yet confirmed by the server, and whether the device is online */
export const syncState = shallowRef({ pending: 0, online: navigator.onLine });

export function watchSyncState() {
  const update = () => { syncState.value = { pending: db.pending(), online: navigator.onLine }; };
  db.onStatusChange(update);
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

/** Log out and remove the user's data from the device, then start over */
export async function logOutAndClear() {
  await logOut();
  await terminate(firestore);
  await clearIndexedDbPersistence(firestore).catch((error) => console.error(error));
  location.reload();
}
