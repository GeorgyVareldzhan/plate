/** Dates of days: ISO strings (YYYY-MM-DD) and their titles in the UI language */
import { t, locale } from './i18n.js';

export function todayIso(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseIso(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Date formats follow the UI language; created on demand because the language is set at startup
export const dateFormat = (options) => new Intl.DateTimeFormat(locale(), options);
const fmtShort = { format: (d) => dateFormat({ weekday: 'short', day: 'numeric', month: 'long' }).format(d) };
const fmtShortYear = { format: (d) => dateFormat({ day: 'numeric', month: 'long', year: 'numeric' }).format(d) };
export const fmtFull = { format: (d) => dateFormat({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d) };
export const fmtWeekday = { format: (d) => dateFormat({ weekday: 'short' }).format(d) };

/** "Today", "Yesterday", "Tomorrow" or a short date */
export function dateTitle(iso) {
  if (iso === todayIso()) return t('day.today');
  if (iso === todayIso(-1)) return t('day.yesterday');
  if (iso === todayIso(1)) return t('day.tomorrow');
  const date = parseIso(iso);
  return capitalize((date.getFullYear() === new Date().getFullYear() ? fmtShort : fmtShortYear).format(date));
}

/** Full date: "Saturday, 22 November 2026" */
export const fullDate = (iso) => capitalize(fmtFull.format(parseIso(iso)));
