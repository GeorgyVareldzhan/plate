/**
 * Auto-update.
 *
 * The service worker checks for a new version when the app is opened and when it returns from the background.
 * The new version installs itself (skipWaiting + clients.claim in sw.js), after which the page reloads
 * once. If the user is typing or a card is open at that moment, the reload waits until they are
 * done. Edits are saved before the reload, and the same screen is reopened after it.
 */
import { currentView } from './nav.js';
import { flushDay } from './days.js';
import { flushDish } from './dishes.js';

const RESTORE_KEY = 'restore-view';

let pending = false;
let reloading = false;

/** Screen that was open before the auto-reload: [name, ...args] or null */
export function takeRestoredView() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(RESTORE_KEY));
    sessionStorage.removeItem(RESTORE_KEY);
    if (saved?.name) return [saved.name, ...(saved.args || [])];
  } catch { /* no access to sessionStorage — open the default screen */ }
  return null;
}

export function setupAutoUpdate() {
  if (!('serviceWorker' in navigator)) return;

  // No controller — this is the first install (or a hard reload): the page is already fresh
  const hadController = Boolean(navigator.serviceWorker.controller);

  navigator.serviceWorker.register('sw.js')
    .then((registration) => {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) registration.update().catch(() => {});
      });
    })
    .catch(() => {});

  if (!hadController) return;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    pending = true;
    tryReload();
  });

  // Retry when the user finishes typing or closes a dialog
  document.addEventListener('visibilitychange', tryReload);
  document.addEventListener('focusout', () => setTimeout(tryReload, 300));
  document.addEventListener('close', tryReload, true); // <dialog>'s close event doesn't bubble
}

function isBusy() {
  if (document.querySelector('dialog[open]')) return true;
  const tag = document.activeElement?.tagName;
  return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
}

async function tryReload() {
  if (!pending || reloading) return;
  if (!document.hidden && isBusy()) return;
  reloading = true;

  try {
    await Promise.all([flushDay(), flushDish()]);
  } catch (error) {
    console.error(error);
  }
  try {
    sessionStorage.setItem(RESTORE_KEY, JSON.stringify(currentView));
  } catch { /* not a big deal — the day list will open */ }

  location.reload();
}
