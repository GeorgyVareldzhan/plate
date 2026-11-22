import { db } from './db.js';
import { registerView, go } from './nav.js';
import { initProducts, showProducts } from './products.js';
import { initDays, showDays, showDay } from './days.js';
import { initDishes, showDishes, showDish } from './dishes.js';
import { initPicker } from './picker.js';
import { setupAutoUpdate, takeRestoredView } from './update.js';

registerView('days', showDays);
registerView('day', showDay);
registerView('products', showProducts);
registerView('dishes', showDishes);
registerView('dish', showDish);

// Кнопки «Отмена» в модальных окнах
document.addEventListener('click', (e) => {
  const button = e.target.closest('[data-close]');
  if (button) button.closest('dialog')?.close();
});

for (const button of document.querySelectorAll('.tabbar button')) {
  button.addEventListener('click', () => go(button.dataset.tab));
}

try {
  await db.open();
  initProducts();
  initDays();
  initDishes();
  initPicker();
  await go(...(takeRestoredView() || ['days']));
} catch (error) {
  console.error(error);
  alert('Не удалось открыть базу данных. Возможно, включён режим «Частный доступ».');
}

// Просим браузер не удалять данные при нехватке места
navigator.storage?.persist?.().catch(() => {});

setupAutoUpdate();
