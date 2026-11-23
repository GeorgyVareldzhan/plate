/**
 * Nutrition values from label text — e.g. text copied from a photo with iOS Live Text.
 *
 * Handles the usual layouts:
 *   "Белки 3,2 г, жиры 2,5 г, углеводы 4,7 г. Энергетическая ценность 1046 кДж / 250 ккал"
 *   a table read column by column: "Белки\nЖиры\nУглеводы\n3,2\n2,5\n4,7"
 * When a label has "per 100 g" and "per serving" columns, the first number is taken —
 * labels list per 100 g first. Values out of range are dropped.
 */
import { LABEL_WORDS, KCAL_UNIT, KJ_UNIT, WEIGHT_UNIT, PORTION_BEFORE } from './i18n/label-words.js';
import { normalizeSearch } from './i18n/search.ru.js';

const MACROS = ['protein', 'fat', 'carbs'];
const NUMBER = /(\d+(?:[.,]\d+)?)/g;
const KJ_PER_KCAL = 4.184;

/** Numbers in the text except portion sizes ("на 100 г"): [{ value, start, end }] */
function numbers(text) {
  return [...text.matchAll(NUMBER)].filter((m) => !PORTION_BEFORE.test(text.slice(0, m.index))).map((m) => ({
    value: Number(m[1].replace(',', '.')),
    start: m.index,
    end: m.index + m[0].length,
  }));
}

/** First position of a word pattern, or -1 */
function find(text, pattern) {
  const m = pattern.exec(text);
  return m ? m.index + m[0].length : -1;
}

function parseMacros(text, nums) {
  const positions = MACROS.map((key) => [key, find(text, LABEL_WORDS[key])]).filter(([, at]) => at >= 0);
  const starts = positions.map(([, at]) => at).sort((a, b) => a - b);
  const result = {};

  const ordered = [...positions].sort((a, b) => a[1] - b[1]);
  const inline = (at) => {
    const next = starts.find((s) => s > at) ?? Infinity;
    return nums.find((x) => x.start >= at && x.start < Math.min(next, at + 40) && !KJ_UNIT.test(text.slice(x.end)));
  };
  // Column layout: the first word has no number before the next word —
  // the words come first, then their numbers in the same order
  const columns = ordered.length > 1 && !inline(ordered[0][1]);

  if (!columns) {
    // Inline layout: the number follows its word before the next word
    for (const [key, at] of positions) {
      const n = inline(at);
      if (n && n.value <= 100) result[key] = n.value;
    }
  } else {
    const after = nums.filter((x) => x.start > ordered.at(-1)[1] && !KCAL_UNIT.test(text.slice(x.end)) && !KJ_UNIT.test(text.slice(x.end)));
    ordered.forEach(([key], i) => {
      if (result[key] == null && after[i] && after[i].value <= 100) result[key] = after[i].value;
    });
  }
  return result;
}

function parseKcal(text, nums) {
  // "Энергетическая ценность 1046 кДж / 250 ккал", "калорийность 290 / 116 ккал" (per 100 g first):
  // the first number after the word that is not kJ and not a weight like "на 100 г"
  const energy = find(text, LABEL_WORDS.energy);
  if (energy >= 0) {
    const n = nums.find((x) => x.start >= energy && x.start < energy + 40
      && !KJ_UNIT.test(text.slice(x.end)) && !WEIGHT_UNIT.test(text.slice(x.end)));
    if (n) return n.value;
  }
  const kcal = nums.find((x) => KCAL_UNIT.test(text.slice(x.end)));
  if (kcal) return kcal.value;
  // "ккал 250" or "ккал/кДж 250/1046": the unit comes before the number
  const unit = find(text, /ккал|kcal/);
  if (unit >= 0) {
    const n = nums.find((x) => x.start >= unit && x.start < unit + 20);
    if (n) return n.value;
  }
  const kj = nums.find((x) => KJ_UNIT.test(text.slice(x.end)));
  if (kj) return Math.round(kj.value / KJ_PER_KCAL);
  return null;
}

/** { kcal?, protein?, fat?, carbs? } — only the values found */
export function parseLabel(raw) {
  const text = normalizeSearch(String(raw).replace(/ /g, ' '));
  const nums = numbers(text);
  const result = parseMacros(text, nums);
  const kcal = parseKcal(text, nums);
  if (kcal != null && kcal <= 900) result.kcal = kcal;
  return result;
}
