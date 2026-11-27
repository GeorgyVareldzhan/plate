/**
 * Auto-update.
 *
 * The service worker checks for a new version when the app is opened and when it returns from the background.
 * The new version installs itself (skipWaiting + clients.claim in sw.js), after which the page reloads
 * once. If the user is typing or a card is open at that moment, the reload waits until they are
 * done. Edits are saved before the reload; the same screen opens after it, as it is in the URL.
 */
import { flushEdits } from './store.js';

let pending = false;
let reloading = false;

export function setupAutoUpdate() {
  // No service worker on the dev server: it would serve stale files
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;

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
    await flushEdits();
  } catch (error) {
    console.error(error);
  }
  location.reload();
}
