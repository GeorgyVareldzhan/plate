/**
 * Dishes. A dish is a template of products with portions. When added to a meal, its ingredients are
 * copied into the meal individually and can then be changed without touching the dish itself.
 */
import { fmt0, fmt1 } from './dom.js';
import { t } from './i18n.js';

/** Creating dishes is hidden for now (the code stays) */
export const CAN_ADD_DISHES = false;

export const dishName = (dish) => dish.name.trim() || t('dish.untitled');

/** Ingredients on one line: "Chicken egg 3 pcs · Butter 5 g" */
export function compositionLine(dish, byId) {
  if (!dish.items.length) return t('dish.empty');
  return dish.items.map((i) => {
    const p = byId.get(i.productId);
    if (!p) return null;
    const amount = i.unit === 'pcs' && p.pieceGrams
      ? `${fmt1.format(i.grams / p.pieceGrams)} ${t('unit.pcs')}`
      : `${fmt0.format(i.grams)} ${t('unit.g')}`;
    return `${p.name} ${amount}`;
  }).filter(Boolean).join(' · ');
}
