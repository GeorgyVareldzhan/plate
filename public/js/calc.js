/** Nutrition calculations and target checks */

// Allowed deviation from the target for highlighting
export const TOLERANCE = 0.03;

// Calories per 1 g of macronutrient — for computing product calories from macros
export const KCAL_PER_GRAM = { protein: 4, fat: 9, carbs: 4 };

// [key, translation key of the one-letter label]
export const MACROS = [
  ['protein', 'macro.p'],
  ['fat', 'macro.f'],
  ['carbs', 'macro.c'],
];

// Target direction: max — "at most", min — "at least"
export const TARGET_DIRECTION = { kcal: 'max', protein: 'min', fat: 'max', carbs: 'max' };

// carryOver — calories over or under the target move to the following days
export const EMPTY_TARGETS = { kcal: null, protein: null, fat: null, carbs: null, carryOver: false };

// Carry-over: a day's calorie overage is split evenly across this many following days,
// and a day's target drops by at most this share of its base target
export const CARRY_DAYS = 2;
export const CARRY_LIMIT = 0.1;

/** Nutrition of a product portion (product values are per 100 g) */
export function portion(product, grams) {
  const k = grams / 100;
  return {
    kcal: product.kcal * k,
    protein: product.protein * k,
    fat: product.fat * k,
    carbs: product.carbs * k,
  };
}

/** Sum over items; productsById — Map id → product */
export function sumNutrition(items, productsById) {
  const total = { kcal: 0, protein: 0, fat: 0, carbs: 0 };
  for (const item of items) {
    const product = productsById.get(item.productId);
    if (!product) continue;
    const p = portion(product, item.grams);
    for (const key of Object.keys(total)) total[key] += p[key];
  }
  return total;
}

/**
 * Status of a value relative to its target, allowing for tolerance:
 * 'ok' — within target, 'bad' — off target, null — no target set.
 */
export function targetStatus(key, value, target) {
  if (!(target > 0)) return null;
  return TARGET_DIRECTION[key] === 'max'
    ? (value <= target * (1 + TOLERANCE) ? 'ok' : 'bad')
    : (value >= target * (1 - TOLERANCE) ? 'ok' : 'bad');
}

export const statusClass = (status) => (status ? `is-${status}` : '');

/** ISO date (YYYY-MM-DD) shifted by a number of days */
export function shiftIso(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** Day of the week counted from Monday: 0 — Monday … 6 — Sunday */
export function weekdayFromMonday(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/** Monday of the week the date belongs to */
export const weekStart = (iso) => shiftIso(iso, -weekdayFromMonday(iso));

/**
 * Calorie targets with carry-over. Returns day → {
 *   target, base, carry — effective target, base target and their difference;
 *   sources — [{ date, deviation, share }]: previous days the carry came from, their
 *     deviation and the part given to this day (before the cap);
 *   capped — the carry was cut by the cap;
 *   deviation — this day's own deviation from its effective target (null without products);
 *   spreadDays — how many following days that deviation is split across (0 on Sunday).
 * }
 *
 * With targets.carryOver on, a day takes half of the overage (eaten minus its own effective
 * target) of each of the two previous calendar days: 1600 eaten against 1500 makes the next
 * two targets 1450. Staying under the target is not carried: the next day keeps its base. Only days with products count — a skipped or empty
 * day neither gives nor receives anything from itself. The carry is capped at −10% of
 * the base target; the rest is dropped. If several days share a date, the latest
 * created one counts. Weeks start on Monday and the carry never crosses into the next
 * week: Saturday's deviation goes to Sunday alone, Sunday's is dropped.
 */
export function kcalTargets(days, productsById) {
  const byDate = new Map();
  for (const day of days) {
    const other = byDate.get(day.date);
    if (!other || day.createdAt > other.createdAt) byDate.set(day.date, day);
  }
  const memo = new Map();
  const eaten = (day) => sumNutrition(day.meals.flatMap((m) => m.items), productsById).kcal;
  const hasItems = (day) => day.meals.some((m) => m.items.length);

  function resolve(day) {
    if (memo.has(day)) return memo.get(day);
    const base = day.targets?.kcal > 0 ? day.targets.kcal : null;
    let carry = 0;
    let capped = false;
    const sources = [];
    if (base && day.targets.carryOver) {
      for (let k = 1; k <= CARRY_DAYS; k++) {
        const prev = byDate.get(shiftIso(day.date, -k));
        if (!prev || prev === day || !hasItems(prev) || !(prev.targets?.kcal > 0)) continue;
        if (weekStart(prev.date) !== weekStart(day.date)) continue;
        const { deviation, spreadDays } = resolve(prev);
        if (!(deviation > 0)) continue; // only going over is carried; staying under gives nothing
        const share = -deviation / spreadDays;
        sources.push({ date: prev.date, deviation, share });
        carry += share;
      }
      const clamped = Math.max(-base * CARRY_LIMIT, carry);
      capped = clamped !== carry;
      carry = clamped;
    }
    const target = base && base + carry;
    const result = {
      target,
      base,
      carry,
      sources: sources.reverse(),
      capped,
      deviation: base && hasItems(day) ? eaten(day) - target : null,
      spreadDays: Math.min(CARRY_DAYS, 6 - weekdayFromMonday(day.date)),
    };
    memo.set(day, result);
    return result;
  }
  return resolve;
}
