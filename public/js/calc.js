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

export const EMPTY_TARGETS = { kcal: null, protein: null, fat: null, carbs: null };

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
