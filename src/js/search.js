/**
 * Product and dish search: word forms, synonyms, ranking and highlight ranges.
 *
 * Every query word must match a word of the name. How well it matches sets the rank:
 *   4 — the name starts with it (after a brand prefix): "кур" → "Куриная грудка"
 *   3 — a word of the name starts with it: "груд" → "Куриная грудка"
 *   2 — the same word in another form or a synonym: "курица" → "Куриная", "Цыплёнок"
 *   1 — found inside a word: "пельм" in "Полупельмени"
 * Ties go to products eaten more often, then to shorter names.
 */
import { normalizeSearch, SYNONYMS } from './i18n/search.ru.js';

const WORD = /[\p{L}\p{N}]+/gu;

const tokens = (text) => [...text.matchAll(WORD)].map((m) => ({ word: m[0], start: m.index }));

function commonPrefix(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/**
 * Same word in another form, judged by a long enough common beginning:
 * "курица" / "куриная", "пельмень" / "пельмени", "яйца" / "яйцо". Short words must match
 * almost entirely, so "морс" does not find "морковь". Returns the common length or 0.
 */
function sameWord(query, word) {
  const common = commonPrefix(query, word);
  if (query.length >= 5) return common >= Math.max(4, query.length - 2) ? common : 0;
  if (query.length === 4) return common >= 3 && word.length <= 5 ? common : 0;
  return 0;
}

const SYNONYM_GROUPS = SYNONYMS.map((group) => group.map(normalizeSearch));

/** Synonyms of a query word: other words of the groups it belongs to */
function synonymsOf(query) {
  const found = [];
  for (const group of SYNONYM_GROUPS) {
    if (group.some((w) => (query.length >= 3 && w.startsWith(query)) || sameWord(query, w))) {
      found.push(...group.filter((w) => w !== query));
    }
  }
  return found;
}

/** Best match of one query word among the name words: { level, start, end } or null */
function matchWord(query, synonyms, words, text, firstIndex) {
  let best = null;
  const take = (level, start, end) => {
    if (!best || level > best.level) best = { level, start, end };
  };
  // A match in the first word of the name counts a bit more: "курица" → "Куриная грудка"
  // before "Яйцо куриное"
  const takeAt = (index, level, start, end) => take(index === firstIndex && level < 4 ? level + 0.5 : level, start, end);
  words.forEach(({ word, start }, index) => {
    if (word.startsWith(query)) {
      takeAt(index, index === firstIndex ? 4 : 3, start, start + query.length);
      return;
    }
    const common = sameWord(query, word);
    if (common) takeAt(index, 2, start, start + common);
    for (const synonym of synonyms) {
      if (word.startsWith(synonym)) takeAt(index, 2, start, start + synonym.length);
      else {
        const c = sameWord(synonym, word);
        if (c) takeAt(index, 2, start, start + c);
      }
    }
  });
  if (!best && query.length >= 2) {
    const at = text.indexOf(query);
    if (at >= 0) take(1, at, at + query.length);
  }
  return best;
}

/** Query words, normalized */
export const queryWords = (query) => tokens(normalizeSearch(query)).map((t) => t.word);

/**
 * Search items. getName(item) — its name; prefixLength(item) — length of a brand prefix
 * that does not count as the start of the name; usage(item) — how many times it was eaten.
 * Returns [{ item, ranges: [[start, end]…] }], best first.
 */
export function search(items, query, { getName = (x) => x.name, prefixLength = () => 0, usage = () => 0 } = {}) {
  const words = queryWords(query);
  if (!words.length) return items.map((item) => ({ item, ranges: [] }));
  const prepared = words.map((w) => [w, synonymsOf(w)]);
  const results = [];
  for (const item of items) {
    const name = getName(item);
    const text = normalizeSearch(name);
    const nameWords = tokens(text);
    const skip = prefixLength(item);
    const firstIndex = nameWords.findIndex((w) => w.start >= skip);
    let score = 0;
    const ranges = [];
    let ok = true;
    for (const [word, synonyms] of prepared) {
      const m = matchWord(word, synonyms, nameWords, text, firstIndex);
      if (!m) { ok = false; break; }
      score += m.level;
      ranges.push([m.start, m.end]);
    }
    if (!ok) continue;
    results.push({ item, ranges, score, uses: usage(item), length: name.length - skip, name });
  }
  results.sort((a, b) => b.score - a.score || b.uses - a.uses || a.length - b.length
    || a.name.localeCompare(b.name, 'ru'));
  return results.map(({ item, ranges }) => ({ item, ranges }));
}

/** Whether a name matches the query (for simple filters) */
export const matches = (name, query) => search([name], query, { getName: (x) => x }).length > 0;
