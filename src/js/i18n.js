/**
 * Localization.
 *
 * English is the base language (i18n/en.js); other languages live next to it and fall back
 * to English for missing keys. On first launch the language is detected from the browser and
 * saved on the device (localStorage), so it does not change on its own later.
 *
 * Templates and code use t(key, params). The language is fixed for the session: switching it reloads the page.
 */
import en from './i18n/en.js';
import ru from './i18n/ru.js';
import { setNumberLocale, fmt0, fmt1 } from './dom.js';

const DICTIONARIES = { en, ru };

/** Languages in the switcher: [code, name in that language] */
export const LANGUAGES = [['en', 'English'], ['ru', 'Русский']];

// Browser languages that get the Russian UI by default
const RUSSIAN_BY_DEFAULT = ['ru', 'be', 'kk', 'ky'];

let language = 'en';

export const getLanguage = () => language;
export const locale = () => (language === 'ru' ? 'ru-RU' : 'en-US');

/** Language from the browser: the user's first preferred language */
export function detectLanguage() {
  const preferred = (navigator.languages?.[0] || navigator.language || 'en').toLowerCase();
  return RUSSIAN_BY_DEFAULT.includes(preferred.split('-')[0]) ? 'ru' : 'en';
}

function apply(code) {
  language = DICTIONARIES[code] ? code : 'en';
  document.documentElement.lang = language;
  setNumberLocale(locale());
}

/** Load the saved language (or detect and save it on first launch) and apply it */
export function initLanguage() {
  const saved = readSaved();
  apply(saved && DICTIONARIES[saved] ? saved : detectLanguage());
  if (!saved) saveLanguage(language);
}

const STORAGE_KEY = 'language';

function readSaved() {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

/** Save the chosen language; the caller reloads the page so every screen re-renders */
export function saveLanguage(code) {
  try { localStorage.setItem(STORAGE_KEY, code); } catch { /* private mode — detected again next time */ }
}

const pluralRules = {};

/** Translate a key. params fill {placeholders}; params.count selects a plural form. */
export function t(key, params = {}) {
  let entry = DICTIONARIES[language][key] ?? en[key] ?? key;
  if (typeof entry === 'object') {
    pluralRules[language] ??= new Intl.PluralRules(locale());
    const form = pluralRules[language].select(params.count ?? 0);
    entry = entry[form] ?? entry.other ?? Object.values(entry)[0];
  }
  return entry.replace(/\{(\w+)\}/g, (match, name) => (params[name] ?? match));
}

/** "P 12.5 · F 3 · C 40" in the current language; digits — 0 or 1 decimal places */
export function macrosLine(n, digits = 1) {
  const f = digits ? fmt1 : fmt0;
  return `${t('macro.p')} ${f.format(n.protein)} · ${t('macro.f')} ${f.format(n.fat)} · ${t('macro.c')} ${f.format(n.carbs)}`;
}

/** Section title for a product category id (brands have no translation and keep their name) */
export const categoryLabel = (id) => {
  const key = `category.${id}`;
  const label = t(key);
  return label === key ? id : label;
};
