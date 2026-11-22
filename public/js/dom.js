/** Мелкие помощники для работы с DOM и числами */

export const $ = (selector, root = document) => root.querySelector(selector);

/**
 * Создать элемент: h('li', { class: 'x', onclick: fn }, 'текст', child).
 * Строки вставляются как текст, поэтому пользовательские данные безопасны.
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'style') el.style.cssText = value;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else if (key in el) el[key] = value;
    else el.setAttribute(key, value);
  }
  el.append(...children.flat().filter((c) => c != null && c !== false));
  return el;
}

export const fmt0 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
export const fmt1 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });

/** Число из поля ввода: понимает запятую, пустая строка — NaN */
export function num(value) {
  const s = String(value ?? '').trim().replace(',', '.');
  return s === '' ? NaN : Number(s);
}

/** Число для поля ввода: 12.5 → «12,5» */
export const toInput = (value) => String(value ?? '').replace('.', ',');

export function macrosLine(n) {
  return `Б ${fmt1.format(n.protein)} · Ж ${fmt1.format(n.fat)} · У ${fmt1.format(n.carbs)}`;
}

export function plural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

/** Отложенный вызов с flush() — выполнить сейчас и cancel() — отменить */
export function debounce(fn, ms) {
  let timer = null;
  let lastArgs = [];
  const debounced = (...args) => {
    lastArgs = args;
    clearTimeout(timer);
    timer = setTimeout(() => { timer = null; fn(...lastArgs); }, ms);
  };
  debounced.flush = () => {
    if (timer === null) return undefined;
    clearTimeout(timer);
    timer = null;
    return fn(...lastArgs);
  };
  debounced.cancel = () => { clearTimeout(timer); timer = null; };
  return debounced;
}
