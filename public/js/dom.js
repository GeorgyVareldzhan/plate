/** Small helpers for the DOM and numbers */

export const $ = (selector, root = document) => root.querySelector(selector);

/**
 * Create an element: h('li', { class: 'x', onclick: fn }, 'text', child).
 * Strings are inserted as text, so user data is safe.
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

// Number formats follow the UI language (set by i18n.js via setNumberLocale)
let nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
let nf1 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
let decimalComma = false;

export function setNumberLocale(locale) {
  nf0 = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  nf1 = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  decimalComma = new Intl.NumberFormat(locale).format(1.5).includes(',');
}

export const fmt0 = { format: (n) => nf0.format(n) };
export const fmt1 = { format: (n) => nf1.format(n) };

/** Number from an input: accepts both a comma and a dot; empty string — NaN */
export function num(value) {
  const s = String(value ?? '').trim().replace(',', '.');
  return s === '' ? NaN : Number(s);
}

/** Number for an input in the UI language: 12.5 → "12,5" in Russian, "12.5" in English */
export const toInput = (value) => (decimalComma ? String(value ?? '').replace('.', ',') : String(value ?? ''));

/** Debounced call with flush() — run now, and cancel() — cancel */
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
