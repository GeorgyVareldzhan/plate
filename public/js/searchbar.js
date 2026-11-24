/**
 * Search bar as in iOS: the field stays on top while scrolling, ⓧ clears it, "Cancel" leaves
 * the search, scrolling the results hides the keyboard. Below it — a row of section chips:
 * filters while searching, quick jumps to sections otherwise.
 */
import { h } from './dom.js';

/**
 * root — the .search-bar element; scrollArea — element whose touch scrolling hides the
 * keyboard; onInput — called whenever the query changes.
 */
export function initSearchBar(root, { scrollArea, onInput }) {
  const input = root.querySelector('input[type="search"]');
  const clear = root.querySelector('.search__clear');
  const cancel = root.querySelector('.search-cancel');

  const sync = () => {
    clear.hidden = !input.value;
    root.classList.toggle('is-active', Boolean(input.value) || document.activeElement === input);
  };
  const changed = () => { sync(); onInput(); };

  input.addEventListener('input', changed);
  input.addEventListener('focus', sync);
  input.addEventListener('blur', sync);
  // "Search" on the keyboard: the results are already shown — just hide the keyboard
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });

  // Keep the focus (and the keyboard) when pressing the buttons
  for (const button of [clear, cancel]) button.addEventListener('pointerdown', (e) => e.preventDefault());
  clear.addEventListener('click', () => {
    input.value = '';
    changed();
    input.focus();
  });
  cancel.addEventListener('click', () => {
    input.value = '';
    input.blur();
    changed();
  });

  let startY = null;
  scrollArea.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; }, { passive: true });
  scrollArea.addEventListener('touchmove', (e) => {
    if (document.activeElement !== input || startY === null || root.contains(e.target)) return;
    if (Math.abs(e.touches[0].clientY - startY) > 10) input.blur();
  }, { passive: true });

  sync();
  return {
    input,
    query: () => input.value.trim(),
    reset() {
      input.value = '';
      sync();
    },
  };
}

/** Chips: [{ id, label, count? }]; active — id of the pressed chip (filters) or null (jumps) */
export function renderChips(container, chips, { active = null, onPick }) {
  container.hidden = chips.length < 2;
  container.replaceChildren(...chips.map(({ id, label, count }) => h('button', {
    type: 'button',
    class: 'chip',
    'data-id': id,
    'aria-pressed': String(id === active),
    onclick: () => onPick(id),
  }, label, count != null ? h('span', { class: 'chip__count' }, String(count)) : null)));
}

// Section jumps take the same time over any distance: fast enough for 500 products,
// smooth enough to show where the list went
const JUMP_MS = 420;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

let jump = null; // { cancel } of the running jump

/** True while a section jump is animating — the scrollspy waits for it to finish */
export const jumping = () => jump !== null;

/** Animate scrolling of window or an element to `top`; a touch or wheel stops it */
function animateScroll(root, top) {
  jump?.cancel();
  const isWindow = root === window;
  const from = isWindow ? window.scrollY : root.scrollTop;
  const max = isWindow
    ? document.documentElement.scrollHeight - window.innerHeight
    : root.scrollHeight - root.clientHeight;
  const to = Math.max(0, Math.min(top, max));
  const set = (y) => (isWindow ? window.scrollTo(0, y) : (root.scrollTop = y));
  return new Promise((resolve) => {
    const start = performance.now();
    let frame = 0;
    const stop = () => {
      cancelAnimationFrame(frame);
      removeEventListener('touchstart', stop, true);
      removeEventListener('wheel', stop, true);
      jump = null;
      resolve();
    };
    const step = (now) => {
      const t = Math.min(1, (now - start) / JUMP_MS);
      set(from + (to - from) * easeInOut(t));
      if (t < 1) frame = requestAnimationFrame(step);
      else stop();
    };
    addEventListener('touchstart', stop, { capture: true, passive: true });
    addEventListener('wheel', stop, { capture: true, passive: true });
    jump = { cancel: stop };
    frame = requestAnimationFrame(step);
  });
}

/**
 * Smoothly scroll a list to a section title, leaving room for the sticky search bar above it.
 * scrollRoot — window or the scrolling dialog.
 */
export function scrollToSection(list, searchBar, id, scrollRoot = window) {
  const title = [...list.querySelectorAll('[data-section]')].find((el) => el.dataset.section === id);
  if (!title) return Promise.resolve();
  const stickyTop = parseFloat(getComputedStyle(searchBar).top) || 0;
  const gap = stickyTop + searchBar.offsetHeight + 4;
  const rootTop = scrollRoot === window ? 0 : scrollRoot.getBoundingClientRect().top;
  const current = scrollRoot === window ? window.scrollY : scrollRoot.scrollTop;
  return animateScroll(scrollRoot, current + title.getBoundingClientRect().top - rootTop - gap);
}

/** Name text with highlighted ranges ([[start, end]…], positions in `text`) */
export function highlight(text, ranges) {
  if (!ranges?.length) return [text];
  const sorted = ranges.map(([s, e]) => [Math.max(0, s), Math.min(text.length, e)]).filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const r of sorted) {
    const last = merged.at(-1);
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  const parts = [];
  let at = 0;
  for (const [s, e] of merged) {
    if (s > at) parts.push(text.slice(at, s));
    parts.push(h('mark', { class: 'hl' }, text.slice(s, e)));
    at = e;
  }
  if (at < text.length) parts.push(text.slice(at));
  return parts;
}

/**
 * Highlight the chip of the section at the top of the screen while scrolling (scrollspy) and
 * keep that chip visible in the chip row. scrollRoot — window or the scrolling dialog;
 * enabled() — false while searching, when chips are filters instead.
 */
export function initScrollSpy({ list, searchBar, chips, scrollRoot, enabled }) {
  let frame = 0;
  let current = null;

  const setActive = (id) => {
    if (id === current) return;
    current = id;
    let activeChip = null;
    for (const chip of chips.querySelectorAll('.chip')) {
      const on = chip.dataset.id === id;
      chip.setAttribute('aria-pressed', String(on));
      if (on) activeChip = chip;
    }
    if (activeChip) {
      // Scroll the chip row only, not the page
      const left = activeChip.offsetLeft - (chips.clientWidth - activeChip.offsetWidth) / 2;
      chips.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
    }
  };

  const update = () => {
    frame = 0;
    if (!enabled() || jumping()) return;
    const line = searchBar.getBoundingClientRect().bottom + 8;
    const titles = list.querySelectorAll('[data-section]');
    let id = titles[0]?.dataset.section ?? null;
    // Not on screen yet (the view or dialog is still hidden): start with the first section
    if (!titles.length || !titles[0].getClientRects().length) {
      setActive(id);
      return;
    }
    for (const title of titles) {
      if (title.getBoundingClientRect().top <= line) id = title.dataset.section;
      else break;
    }
    setActive(id);
  };

  scrollRoot.addEventListener('scroll', () => { frame ||= requestAnimationFrame(update); }, { passive: true });
  return {
    /** Call after the list or chips were re-rendered */
    refresh() {
      current = null;
      update();
    },
    setActive,
    /**
     * Section jump: highlight its chip right away and keep it after landing, even when the
     * section is too short to reach the top (the last ones) — until the user scrolls
     */
    follow(id) {
      setActive(id);
    },
  };
}
