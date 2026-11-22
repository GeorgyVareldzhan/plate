/** Переключение экранов и подсветка таббара */

const handlers = new Map();

/** Текущий экран — чтобы вернуться на него после перезагрузки */
export const currentView = { name: null, args: [] };

// Экраны, которые не являются вкладками, подсвечивают родительскую вкладку
const TAB_OF = { day: 'days', dish: 'dishes' };

export function registerView(name, onShow) {
  handlers.set(name, onShow);
}

/** Показать экран. Обработчик может вернуть false, чтобы отменить переход. */
export async function go(name, ...args) {
  const onShow = handlers.get(name);
  if (onShow && (await onShow(...args)) === false) return;

  for (const view of document.querySelectorAll('.view')) {
    view.hidden = view.id !== `view-${name}`;
  }
  document.body.dataset.view = name;
  currentView.name = name;
  currentView.args = args;

  const tab = TAB_OF[name] || name;
  for (const button of document.querySelectorAll('.tabbar button')) {
    if (button.dataset.tab === tab) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
  window.scrollTo(0, 0);
}
