/** Расчёты пищевой ценности и проверка целей */

// Допустимое отклонение от цели при подсветке
export const TOLERANCE = 0.03;

// Калорийность 1 г макронутриента — для расчёта калорий продукта по БЖУ
export const KCAL_PER_GRAM = { protein: 4, fat: 9, carbs: 4 };

export const MACROS = [
  ['protein', 'Б'],
  ['fat', 'Ж'],
  ['carbs', 'У'],
];

// Направление цели: max — «не более», min — «не менее»
export const TARGET_DIRECTION = { kcal: 'max', protein: 'min', fat: 'max', carbs: 'max' };

export const EMPTY_TARGETS = { kcal: null, protein: null, fat: null, carbs: null };

/** Пищевая ценность порции продукта (значения продукта — на 100 г) */
export function portion(product, grams) {
  const k = grams / 100;
  return {
    kcal: product.kcal * k,
    protein: product.protein * k,
    fat: product.fat * k,
    carbs: product.carbs * k,
  };
}

/** Сумма по позициям; productsById — Map id → продукт */
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
 * Статус показателя относительно цели с учётом погрешности:
 * 'ok' — в норме, 'bad' — вне нормы, null — цель не задана.
 */
export function targetStatus(key, value, target) {
  if (!(target > 0)) return null;
  return TARGET_DIRECTION[key] === 'max'
    ? (value <= target * (1 + TOLERANCE) ? 'ok' : 'bad')
    : (value >= target * (1 - TOLERANCE) ? 'ok' : 'bad');
}

export const statusClass = (status) => (status ? `is-${status}` : '');
