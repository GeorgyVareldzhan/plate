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

// Numbers kept per value: the first one is the usual answer, the rest are for photos where a
// unit was misread as a digit ("углеводы, 7 30" for "углеводы, г 30")
const MAX_CANDIDATES = 3;

const isEnergy = (text, x) => KCAL_UNIT.test(text.slice(x.end)) || KJ_UNIT.test(text.slice(x.end));

/** { protein: [values…], fat: […], carbs: […] } */
function parseMacros(text, nums) {
  const positions = MACROS.map((key) => [key, find(text, LABEL_WORDS[key])]).filter(([, at]) => at >= 0);
  const starts = positions.map(([, at]) => at).sort((a, b) => a - b);
  const ordered = [...positions].sort((a, b) => a[1] - b[1]);
  const result = {};

  const inline = (at) => {
    const next = starts.find((s) => s > at) ?? Infinity;
    return nums.filter((x) => x.start >= at && x.start < Math.min(next, at + 40) && !isEnergy(text, x));
  };
  // Column layout: the first word has no number before the next word —
  // the words come first, then their numbers in the same order
  const columns = ordered.length > 1 && !inline(ordered[0][1]).length;

  if (!columns) {
    // Inline layout: the numbers follow their word before the next word
    for (const [key, at] of positions) {
      const values = inline(at).map((x) => x.value).filter((v) => v <= 100);
      if (values.length) result[key] = values.slice(0, MAX_CANDIDATES);
    }
  } else {
    const after = nums.filter((x) => x.start > ordered.at(-1)[1] && !isEnergy(text, x));
    ordered.forEach(([key], i) => {
      if (after[i] && after[i].value <= 100) result[key] = [after[i].value];
    });
  }
  return result;
}

/** Calorie candidates, most likely first */
function parseKcal(text, nums) {
  const found = [];
  // "Энергетическая ценность 1046 кДж / 250 ккал", "калорийность 290 / 116 ккал" (per 100 g first):
  // numbers after the word that are not kJ and not a weight like "на 100 г"
  const energy = find(text, LABEL_WORDS.energy);
  if (energy >= 0) {
    found.push(...nums.filter((x) => x.start >= energy && x.start < energy + 40
      && !KJ_UNIT.test(text.slice(x.end)) && !WEIGHT_UNIT.test(text.slice(x.end))).map((x) => x.value));
  }
  found.push(...nums.filter((x) => KCAL_UNIT.test(text.slice(x.end))).map((x) => x.value));
  // "ккал 250" or "ккал/кДж 250/1046": the unit comes before the number
  const unit = find(text, /ккал|kcal/);
  if (unit >= 0) found.push(...nums.filter((x) => x.start >= unit && x.start < unit + 20).map((x) => x.value));
  const kj = nums.find((x) => KJ_UNIT.test(text.slice(x.end)));
  if (kj) found.push(Math.round(kj.value / KJ_PER_KCAL));
  return [...new Set(found.filter((v) => v > 0 && v <= 900))].slice(0, MAX_CANDIDATES);
}

// Latin letters that look like Cyrillic ones — recognized text often mixes them in a word
const LATIN_TO_CYRILLIC = { a: 'а', e: 'е', o: 'о', p: 'р', c: 'с', x: 'х', y: 'у', k: 'к', m: 'м', t: 'т' };

/**
 * Typical recognition mistakes: Latin look-alikes inside Russian words ("бeлки"), letters
 * instead of digits inside numbers ("З,2" → "3,2", "1О" → "10"), a space before the decimal
 * comma ("3 ,2").
 */
function fixRecognized(text) {
  return text
    .replace(/[a-zа-я]+/g, (word) => (/[а-я]/.test(word)
      ? word.replace(/[aeopcxykmt]/g, (ch) => LATIN_TO_CYRILLIC[ch])
      : word))
    .replace(/[\dоoзl|.,]*\d[\dоoзl|.,]*/g, (token) => token
      .replace(/[оo]/g, '0').replace(/з/g, '3').replace(/[l|]/g, '1'))
    .replace(/(\d)\s+([,.]\d)/g, '$1$2');
}

/**
 * Candidate values: { kcal?: [...], protein?: [...], fat?: [...], carbs?: [...] }, the most
 * likely first. Used for photos, where the calorie balance picks the right candidate.
 */
export function parseLabelCandidates(raw) {
  const text = fixRecognized(normalizeSearch(String(raw).replace(/\u00a0/g, ' ')));
  const nums = numbers(text);
  const result = parseMacros(text, nums);
  const kcal = parseKcal(text, nums);
  if (kcal.length) result.kcal = kcal;
  return result;
}

/** { kcal?, protein?, fat?, carbs? } — only the values found */
export function parseLabel(raw) {
  return Object.fromEntries(Object.entries(parseLabelCandidates(raw)).map(([key, values]) => [key, values[0]]));
}
