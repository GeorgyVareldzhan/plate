/** Общие элементы интерфейса: SVG-иконки, кольцо прогресса, свайп для удаления */
import { h } from './dom.js';
import { statusClass } from './calc.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function svg(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value != null) el.setAttribute(key, value);
  }
  el.append(...children);
  return el;
}

/* ---------- Системные иконки (в духе SF Symbols) ---------- */

const PATHS = {
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  chevronLeft: 'M15 5l-7 7 7 7',
  chevronRight: 'M9 5l7 7-7 7',
  chevronDown: 'M6 9l6 6 6-6',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  copy: 'M8 8h11v11H8zM5 16V5h11',
  target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zM12 11.5v1',
  calendar: 'M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 10h16M9 3v4M15 3v4',
  close: 'M6 6l12 12M18 6L6 18',
};

/** Иконка-линия; size — в px */
export function icon(name, size = 20, extraClass = '') {
  return svg('svg', {
    class: `icon ${extraClass}`.trim(),
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    'aria-hidden': 'true',
  }, svg('path', { d: PATHS[name] }));
}

/* ---------- Кольцо прогресса ---------- */

/**
 * Кольцо как в «Фитнесе»: доля value от target.
 * status — 'ok' | 'bad' | null (цель не задана — нейтральный цвет).
 */
export function ring({ value, target, status, size = 120, stroke = 12, children = [] }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = target > 0 ? Math.min(1, Math.max(0, value / target)) : 0;
  const center = size / 2;

  return h('div', { class: `ring ${statusClass(status)}`, style: `--size:${size}px` },
    svg('svg', { width: size, height: size, viewBox: `0 0 ${size} ${size}`, 'aria-hidden': 'true' },
      svg('circle', { class: 'ring__track', cx: center, cy: center, r, 'stroke-width': stroke }),
      svg('circle', {
        class: 'ring__value',
        cx: center,
        cy: center,
        r,
        'stroke-width': stroke,
        'stroke-dasharray': c.toFixed(2),
        'stroke-dashoffset': (c * (1 - pct)).toFixed(2),
        transform: `rotate(-90 ${center} ${center})`,
        opacity: pct > 0 ? 1 : 0,
      }),
    ),
    children.length ? h('div', { class: 'ring__center' }, ...children) : null,
  );
}

/** Полоска прогресса */
export function bar(value, target, kind, status) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  return h('div', { class: `bar bar--${kind} ${statusClass(status)}` },
    h('i', { style: `width:${pct}%` }));
}

/* ---------- Свайп влево для удаления (как в iOS) ---------- */

const ACTION_WIDTH = 88;
let openRow = null;

// Тап в любом другом месте закрывает открытую строку
document.addEventListener('pointerdown', (e) => {
  if (openRow && !openRow.el.contains(e.target)) openRow.close();
}, true);

/**
 * Строка списка со свайпом: возвращает <li> с content внутри и кнопкой «Удалить» под ним.
 * Свайп не начинается на полях ввода и кнопках управления (stepper, переключатель).
 */
export function swipeRow(content, onDelete, { label = 'Удалить', className = '' } = {}) {
  const action = h('button', { type: 'button', class: 'swipe__delete', onclick: () => onDelete() }, label);
  const row = h('li', { class: `swipe ${className}`.trim() }, h('div', { class: 'swipe__actions' }, action), content);
  content.classList.add('swipe__content');

  let startX = 0;
  let startY = 0;
  let dx = 0;
  let base = 0;
  let tracking = false;
  let horizontal = false;
  let pointerId = null;

  const move = (x, animate) => {
    content.style.transition = animate ? 'transform .28s cubic-bezier(.2,.8,.2,1)' : 'none';
    content.style.transform = x ? `translateX(${x}px)` : '';
  };
  const api = {
    el: row,
    close() {
      move(0, true);
      row.classList.remove('is-open');
      if (openRow === api) openRow = null;
    },
    open() {
      if (openRow && openRow !== api) openRow.close();
      move(-ACTION_WIDTH, true);
      row.classList.add('is-open');
      openRow = api;
    },
  };

  content.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target.closest('input, .stepper, .units')) return;
    startX = e.clientX;
    startY = e.clientY;
    dx = 0;
    base = row.classList.contains('is-open') ? -ACTION_WIDTH : 0;
    tracking = true;
    horizontal = false;
    pointerId = e.pointerId;
  });

  content.addEventListener('pointermove', (e) => {
    if (!tracking || e.pointerId !== pointerId) return;
    const mx = e.clientX - startX;
    const my = e.clientY - startY;
    if (!horizontal) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      if (Math.abs(my) > Math.abs(mx)) {
        tracking = false; // вертикальная прокрутка — не наш жест
        return;
      }
      horizontal = true;
      content.setPointerCapture?.(pointerId);
    }
    dx = mx;
    let x = Math.min(0, base + dx);
    if (x < -ACTION_WIDTH) x = -ACTION_WIDTH + (x + ACTION_WIDTH) / 3; // «резинка»
    move(x, false);
  });

  const end = () => {
    if (!tracking) return;
    tracking = false;
    if (!horizontal) return;
    if (base + dx < -ACTION_WIDTH / 2) api.open();
    else api.close();
    // После свайпа не считать отпускание пальца нажатием на строку
    const swallow = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
    content.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => content.removeEventListener('click', swallow, { capture: true }), 0);
  };
  content.addEventListener('pointerup', end);
  content.addEventListener('pointercancel', end);

  return row;
}

/* ---------- Нижние «листы» с действиями ---------- */

/**
 * Показать меню действий (action sheet). actions: [{ label, onClick, danger? }].
 * Закрывается по «Отмена» или тапу по фону.
 */
export function actionSheet(title, actions) {
  const dialog = h('dialog', { class: 'action-sheet', autofocus: true, tabindex: '-1' });
  const close = () => dialog.close();
  dialog.append(
    h('div', { class: 'action-sheet__group' },
      title ? h('div', { class: 'action-sheet__title' }, title) : null,
      ...actions.map((a) => h('button', {
        type: 'button',
        class: a.danger ? 'is-danger' : '',
        onclick: () => { close(); a.onClick(); },
      }, a.label)),
    ),
    h('button', { type: 'button', class: 'action-sheet__cancel', onclick: close }, 'Отмена'),
  );
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
}
