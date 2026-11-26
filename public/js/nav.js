/** Screen switching and tab bar highlighting */

const handlers = new Map();

/** Current screen — to return to it after a reload */
export const currentView = { name: null, args: [] };

// Screens that are not tabs highlight their parent tab
const TAB_OF = { day: 'days', dish: 'dishes' };

export function registerView(name, onShow) {
  handlers.set(name, onShow);
}

/** Show a screen. The handler may return false to cancel the navigation. */
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

/** Redraw the current screen in place (data changed on another device) */
export async function refresh() {
  const onShow = handlers.get(currentView.name);
  if (!onShow) return;
  const y = window.scrollY;
  await onShow(...currentView.args);
  window.scrollTo(0, y);
}
