/**
 * Автообновление.
 *
 * Service worker проверяет новую версию при открытии приложения и при возврате к нему из фона.
 * Новая версия ставится сама (skipWaiting + clients.claim в sw.js), после чего страница один раз
 * перезагружается. Если пользователь в этот момент что-то вводит или открыта карточка, перезагрузка
 * ждёт, пока он закончит. Перед перезагрузкой правки сохраняются, после неё открывается тот же экран.
 */
import { currentView } from './nav.js';
import { flushDay } from './days.js';
import { flushDish } from './dishes.js';

const RESTORE_KEY = 'restore-view';

let pending = false;
let reloading = false;

/** Экран, который был открыт до автоперезагрузки: [name, ...args] или null */
export function takeRestoredView() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(RESTORE_KEY));
    sessionStorage.removeItem(RESTORE_KEY);
    if (saved?.name) return [saved.name, ...(saved.args || [])];
  } catch { /* нет доступа к sessionStorage — открываем экран по умолчанию */ }
  return null;
}

export function setupAutoUpdate() {
  if (!('serviceWorker' in navigator)) return;

  // Нет контроллера — это первая установка (или жёсткое обновление): страница и так свежая
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

  // Повторные попытки, когда пользователь закончил ввод или закрыл окно
  document.addEventListener('visibilitychange', tryReload);
  document.addEventListener('focusout', () => setTimeout(tryReload, 300));
  document.addEventListener('close', tryReload, true); // событие close у <dialog> не всплывает
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
  } catch { /* не страшно — откроется список дней */ }

  location.reload();
}
