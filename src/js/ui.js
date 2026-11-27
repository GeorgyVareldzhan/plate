/** Shared UI helpers: motion preference, progress colors, system icon paths, the action sheet state */
import { shallowRef } from 'vue';
import { statusClass } from './calc.js';

/** The user asked the system for less motion: skip decorative animations */
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- System icons (SF Symbols style), drawn by AppIcon.vue ---------- */

export const ICON_PATHS = {
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  chevronLeft: 'M15 5l-7 7 7 7',
  chevronRight: 'M9 5l7 7-7 7',
  chevronDown: 'M6 9l6 6 6-6',
  arrowUp: 'M12 19V5M6 11l6-6 6 6',
  arrowDown: 'M12 5v14M6 13l6 6 6-6',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  copy: 'M8 8h11v11H8zM5 16V5h11',
  target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zM12 11.5v1',
  calendar: 'M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 10h16M9 3v4M15 3v4',
  close: 'M6 6l12 12M18 6L6 18',
  account: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21c1-4 4.5-6 8-6s7 2 8 6',
};

/* ---------- Progress colors ---------- */

/** Mix of two color variables: share 0 — `from`, 1 — `to` */
const mix = (from, to, share) => `color-mix(in srgb, var(${to}) ${Math.round(share * 100)}%, var(${from}))`;

/** Class and style for an element colored by target status, or red → orange → green by progress */
export const progressClass = (status, progress) => (progress == null ? statusClass(status) : 'has-progress');

export function progressStyle(progress) {
  if (progress == null) return '';
  const [text, fill] = progress < 0.5
    ? [mix('--bad', '--warn', progress * 2), mix('--bad', '--warn-fill', progress * 2)]
    : [mix('--warn', '--ok', progress * 2 - 1), mix('--warn-fill', '--ok-fill', progress * 2 - 1)];
  return `--progress-text:${text};--progress-fill:${fill}`;
}

/* ---------- Bottom action sheet (ActionSheet.vue) ---------- */

/** { id, title, actions } of the open action sheet, or null */
export const actionSheetState = shallowRef(null);
let lastSheetId = 0;

/**
 * Show an action sheet. actions: [{ label, onClick, danger? }].
 * Closes on "Cancel" or a tap on the backdrop. onClick runs within the tap (share and file
 * pickers need a user gesture).
 */
export function actionSheet(title, actions) {
  actionSheetState.value = { id: ++lastSheetId, title, actions };
}
