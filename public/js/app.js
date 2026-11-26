import { db } from './db.js';
import { initLanguage, t } from './i18n.js';
import { registerView, go, refresh } from './nav.js';
import { currentUser } from './firebase.js';
import { initAuth, initAccount, setupAccount } from './account.js';
import { isDragging } from './reorder.js';
import { initProducts, showProducts } from './products.js';
import { initDays, showDays, showDay, flushDay } from './days.js';
import { initDishes, showDishes, showDish, flushDish } from './dishes.js';
import { initPicker } from './picker.js';
import { setupAutoUpdate, takeRestoredView } from './update.js';
import { initScrollLock } from './scrolllock.js';
import { initBackSwipe } from './backswipe.js';
import { initSheetSwipe } from './sheetswipe.js';

registerView('auth', () => {});
registerView('days', showDays);
registerView('day', showDay);
registerView('products', showProducts);
registerView('dishes', showDishes);
registerView('dish', showDish);

initScrollLock();
initSheetSwipe();

// "Cancel" buttons in modal dialogs
document.addEventListener('click', (e) => {
  const button = e.target.closest('[data-close]');
  if (button) button.closest('dialog')?.close();
});

for (const button of document.querySelectorAll('.tabbar button')) {
  button.addEventListener('click', () => go(button.dataset.tab));
}

try {
  initLanguage();
  const user = await currentUser();
  if (!user) {
    initAuth();
    await go('auth');
  } else {
    await db.start(user.uid);
    await setupAccount();
    initAccount();
    initProducts();
    initDays();
    initDishes();
    initPicker();
    initBackSwipe({
      day: { parent: 'days', back: async () => { await flushDay(); await go('days'); } },
      dish: { parent: 'dishes', back: async () => { await flushDish(); await go('dishes'); } },
    });
    await go(...(takeRestoredView() || ['days']));
    db.onRemoteChange(refreshSoon);
  }
} catch (error) {
  console.error(error);
  alert(t('app.dbError'));
}

// Data changed on another device: redraw the open screen unless the user is in the middle of something
let refreshTimer = 0;
function refreshSoon() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(async () => {
    const busy = document.querySelector('dialog[open]') || isDragging()
      || document.activeElement?.matches('input, textarea, select');
    if (busy) return refreshSoon();
    await Promise.all([flushDay(), flushDish()]); // keep edits not saved yet
    refresh();
  }, 500);
}

// Ask the browser not to evict data when storage is low
navigator.storage?.persist?.().catch(() => {});

setupAutoUpdate();
