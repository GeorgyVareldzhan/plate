/**
 * Search helpers for SearchBar.vue and the lists under it: animated jumps to a section, the
 * scrollspy that follows the section at the top, and search match highlighting.
 */

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

/**
 * Name split into parts for highlighting search matches: [{ text, mark }]; ranges — [[start, end]…],
 * positions in `text`
 */
export function highlightParts(text, ranges) {
  if (!ranges?.length) return [{ text, mark: false }];
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
    if (s > at) parts.push({ text: text.slice(at, s), mark: false });
    parts.push({ text: text.slice(s, e), mark: true });
    at = e;
  }
  if (at < text.length) parts.push({ text: text.slice(at), mark: false });
  return parts;
}

/**
 * Follow the section at the top of the screen while scrolling (scrollspy): onActive(id) gets its id,
 * and its chip is scrolled into view in the chip row. scrollRoot — window or the scrolling dialog;
 * enabled() — false while searching, when chips are filters instead.
 */
export function initScrollSpy({ list, searchBar, chips, scrollRoot, enabled, onActive }) {
  let frame = 0;
  let current = null;

  const setActive = (id) => {
    if (id === current) return;
    current = id;
    onActive(id);
    const activeChip = [...chips().querySelectorAll('.chip')].find((chip) => chip.dataset.id === id);
    if (activeChip) {
      // Scroll the chip row only, not the page
      const row = chips();
      const left = activeChip.offsetLeft - (row.clientWidth - activeChip.offsetWidth) / 2;
      row.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
    }
  };

  const update = () => {
    frame = 0;
    if (!enabled() || jumping() || !list()) return;
    const line = searchBar().getBoundingClientRect().bottom + 8;
    const titles = list().querySelectorAll('[data-section]');
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

  const onScroll = () => { frame ||= requestAnimationFrame(update); };
  scrollRoot.addEventListener('scroll', onScroll, { passive: true });

  return {
    /** Call after the list or chips were re-rendered */
    refresh() {
      current = null;
      update();
    },
    /** Section jump: highlight its chip right away and keep it after landing — until the user scrolls */
    follow(id) {
      setActive(id);
    },
    stop() {
      cancelAnimationFrame(frame);
      scrollRoot.removeEventListener('scroll', onScroll);
    },
  };
}
