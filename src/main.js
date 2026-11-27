/** Startup: language, user, data, then the Vue app */
import { createApp } from 'vue';
import { db } from './js/db.js';
import { initLanguage, t } from './js/i18n.js';
import { currentUser } from './js/firebase.js';
import { setupAccount, watchSyncState } from './js/account.js';
import { isDragging } from './js/reorder.js';
import { remoteTick, flushEdits } from './js/store.js';
import { router, session } from './js/router.js';
import { setupAutoUpdate } from './js/update.js';
import { initScrollLock } from './js/scrolllock.js';
import { initSheetSwipe } from './js/sheetswipe.js';
import App from './App.vue';

initScrollLock();
initSheetSwipe();

try {
  initLanguage();
  const user = await currentUser();
  if (user) {
    await db.start(user.uid);
    await setupAccount();
    watchSyncState();
    session.signedIn = true;
    db.onRemoteChange(refreshSoon);
  }
} catch (error) {
  console.error(error);
  alert(t('app.dbError'));
}

const app = createApp(App);
app.use(router);
app.mount('#app');
await router.isReady();
hideSplash();

/** Fade out the startup screen once the first screen is drawn */
function hideSplash() {
  const splash = document.querySelector('#splash');
  splash.classList.add('is-hidden');
  splash.addEventListener('transitionend', () => splash.remove(), { once: true });
  setTimeout(() => splash.remove(), 600); // no transition (reduced motion, hidden tab)
}

// Data changed on another device: lists follow by themselves; open editors reload their copy
// unless the user is in the middle of something
let refreshTimer = 0;
function refreshSoon() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(async () => {
    const busy = document.querySelector('dialog[open]') || isDragging()
      || document.activeElement?.matches('input, textarea, select');
    if (busy) return refreshSoon();
    await flushEdits(); // keep edits not saved yet
    remoteTick.value += 1;
  }, 500);
}

// Ask the browser not to evict data when storage is low
navigator.storage?.persist?.().catch(() => {});

setupAutoUpdate();
