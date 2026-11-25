/**
 * Reordering: long press on a row lifts it, then it follows the finger and can be dropped
 * into any of the given lists (e.g. another meal). Also a plain long-press helper.
 */
import { h } from './dom.js';

const SLOP = 8; // px the finger may move before a long press is cancelled
const ROW_HOLD_MS = 300;
const EDGE = 70; // px from the viewport edge where auto-scroll starts
const MAX_SCROLL_SPEED = 14; // px per frame
const FLIP_MS = 160;

let dragging = false;
const pointY = (e) => (e.touches?.[0] ?? e.changedTouches?.[0] ?? e).clientY;

/** True while a row is being dragged — swipe and click handlers stay out of the way */
export const isDragging = () => dragging;

/**
 * callback(event) after holding a finger still for `ms`. `ignore` — selector of children
 * where the press does not count (inputs, buttons).
 */
export function onLongPress(el, ms, callback, { ignore } = {}) {
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  el.addEventListener('pointerdown', (down) => {
    if (down.pointerType === 'mouse' && down.button !== 0) return;
    if (ignore && down.target.closest(ignore)) return;
    const stop = () => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      window.removeEventListener('scroll', stop, true);
    };
    const move = (e) => {
      if (Math.hypot(e.clientX - down.clientX, e.clientY - down.clientY) > SLOP) stop();
    };
    const timer = setTimeout(() => { stop(); callback(down); }, ms);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    window.addEventListener('scroll', stop, true);
  });
}

/** Nearest scrolling ancestor, or the page */
function scrollParent(el) {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return node;
  }
  return document.scrollingElement;
}

/** Animate elements from their old positions to the new ones */
function flip(elements, mutate) {
  const before = new Map(elements.map((el) => [el, el.getBoundingClientRect().top]));
  mutate();
  for (const [el, top] of before) {
    const dy = top - el.getBoundingClientRect().top;
    if (dy) el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: FLIP_MS, easing: 'ease-out' });
  }
}

/**
 * Makes `row` (an <li> in one of `lists()`) draggable by a long press.
 * Sortable rows are list children with the `.swipe` class; other children (the "Add" row) stay last.
 * onDrop({ fromList, fromIndex, toList, toIndex }) — list indexes in `lists()`, row indexes among
 * sortable rows; called only when the place changed. It should update the data and re-render.
 */
export function sortableRow(row, { lists, onDrop }) {
  onLongPress(row, ROW_HOLD_MS, (down) => startDrag(row, down, lists(), onDrop), {
    ignore: 'input, button, .stepper, .units',
  });
}

const sortables = (list, except) => [...list.children].filter((c) => c.classList.contains('swipe') && c !== except);

function startDrag(row, down, lists, onDrop) {
  if (dragging || row.classList.contains('is-open')) return;
  dragging = true;
  const fromList = lists.findIndex((l) => l === row.parentElement);
  const fromIndex = sortables(row.parentElement).indexOf(row);
  const rect = row.getBoundingClientRect();
  const offset = down.clientY - rect.top;
  const scroller = scrollParent(row);
  let y = down.clientY;

  const placeholder = h('li', { class: 'drag-placeholder', style: `height:${rect.height}px` });
  row.before(placeholder);
  Object.assign(row.style, { position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px` });
  row.classList.add('is-dragging');
  document.body.classList.add('is-sorting');

  // Everything that may shift when the placeholder moves
  const moving = () => lists.flatMap((l) => [l.previousElementSibling, ...l.children])
    .filter((el) => el && el !== row && el !== placeholder);

  const place = () => {
    // The list under the finger, or the nearest one
    let target = lists[0];
    let best = Infinity;
    for (const list of lists) {
      const r = list.getBoundingClientRect();
      const distance = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
      if (distance < best) { best = distance; target = list; }
    }
    const rows = sortables(target, row);
    const next = rows.find((r) => {
      const b = r.getBoundingClientRect();
      return y < b.top + b.height / 2;
    }) ?? [...target.children].find((c) => !c.classList.contains('swipe') && c !== placeholder) ?? null;
    if (placeholder.parentElement === target && placeholder.nextElementSibling === next) return;
    if (next === placeholder) return;
    flip(moving(), () => target.insertBefore(placeholder, next));
  };

  const move = (e) => {
    if (e.cancelable) e.preventDefault(); // no page scroll while dragging
    y = pointY(e);
    row.style.top = `${y - offset}px`;
    place();
  };

  // Auto-scroll near the edges of the scrolling area
  let frame = requestAnimationFrame(function tick() {
    const view = scroller === document.scrollingElement
      ? { top: 0, bottom: window.innerHeight }
      : scroller.getBoundingClientRect();
    let speed = 0;
    if (y < view.top + EDGE) speed = -MAX_SCROLL_SPEED * Math.min(1, (view.top + EDGE - y) / EDGE);
    else if (y > view.bottom - EDGE) speed = MAX_SCROLL_SPEED * Math.min(1, (y - view.bottom + EDGE) / EDGE);
    if (speed) {
      const before = scroller.scrollTop;
      scroller.scrollTop += speed;
      if (scroller.scrollTop !== before) place();
    }
    frame = requestAnimationFrame(tick);
  });

  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('touchmove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', end);
    window.removeEventListener('touchend', end);
    window.removeEventListener('touchcancel', end);
    cancelAnimationFrame(frame);

    const toList = lists.indexOf(placeholder.parentElement);
    const toIndex = sortables(placeholder.parentElement, row).filter((r) =>
      r.compareDocumentPosition(placeholder) & Node.DOCUMENT_POSITION_FOLLOWING).length;
    const target = placeholder.getBoundingClientRect();
    const finish = () => {
      placeholder.replaceWith(row);
      row.removeAttribute('style');
      row.classList.remove('is-dragging');
      document.body.classList.remove('is-sorting');
      // The finger lifts over the row — not a tap
      const swallow = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
      window.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => {
        window.removeEventListener('click', swallow, { capture: true });
        dragging = false;
      }, 0);
      if (toList !== fromList || toIndex !== fromIndex) onDrop({ fromList, fromIndex, toList, toIndex });
    };
    row.animate([{ top: row.style.top }, { top: `${target.top}px` }], { duration: FLIP_MS, easing: 'ease-out' })
      .finished.then(finish, finish);
    row.style.top = `${target.top}px`;
  };

  window.addEventListener('pointermove', move);
  window.addEventListener('touchmove', move, { passive: false });
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
  window.addEventListener('touchend', end);
  window.addEventListener('touchcancel', end);
}

export { flip };
