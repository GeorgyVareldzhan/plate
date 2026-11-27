/** Meal and dish items: { productId, grams, unit: 'g' | 'pcs' } — creation, quantities, list keys */
import { toRaw } from 'vue';
import { toInput } from './dom.js';

export const MAX_GRAMS = 5000;
export const DEFAULT_GRAMS = 100;
// Step for the "−" / "+" buttons
export const STEP_GRAMS = 10;
export const STEP_PIECES = 1;

export const round = (value, digits) => Math.round(value * 10 ** digits) / 10 ** digits;

/** New item for a product: piece-based — 1 piece, others — 100 g */
export function newItem(product) {
  return product.pieceGrams > 0
    ? { productId: product.id, grams: product.pieceGrams, unit: 'pcs' }
    : { productId: product.id, grams: DEFAULT_GRAMS, unit: 'g' };
}

/** Value for the quantity input: pieces or grams */
export function amountForInput(item, pieceGrams) {
  return item.unit === 'pcs' && pieceGrams
    ? toInput(round(item.grams / pieceGrams, 2))
    : toInput(round(item.grams, 1));
}

/** "−" / "+" step: the value snaps to a multiple of the step (123 g → 130 or 120); in the item's unit */
export function steppedAmount(item, pieceGrams, direction) {
  const size = item.unit === 'pcs' ? STEP_PIECES : STEP_GRAMS;
  const amountNow = item.unit === 'pcs' ? item.grams / pieceGrams : item.grams;
  const units = amountNow / size;
  const next = direction > 0
    ? (Math.floor(units + 1e-9) + 1) * size
    : (Math.ceil(units - 1e-9) - 1) * size;
  return Math.max(0, round(next, 2));
}

// Items and meals have no ids of their own: v-for keys are handed out per object
const keys = new WeakMap();
let lastKey = 0;
/** Stable key of a data object for v-for */
export function keyOf(object) {
  const raw = toRaw(object);
  if (!keys.has(raw)) keys.set(raw, ++lastKey);
  return keys.get(raw);
}
