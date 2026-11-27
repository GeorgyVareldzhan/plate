/** Products: search, sections, the product card's validation and deletion */
import { db } from './db.js';
import { KCAL_PER_GRAM } from './calc.js';
import { num } from './dom.js';
import { t, categoryLabel } from './i18n.js';
import { CATEGORIES, productCategory, classify, brandPrefixLength } from './icons.js';
import { search } from './search.js';

/** Adding products is hidden for now (the code stays): users pick from the shared catalog */
export const CAN_ADD_PRODUCTS = false;

export const PRODUCT_FIELDS = ['name', 'kcal', 'protein', 'fat', 'carbs', 'pieceGrams'];
export const MACRO_KEYS = ['protein', 'fat', 'carbs'];

/**
 * Ranked product search (see search.js): [{ item, ranges }], best first.
 * usage — Map productId → { count }: products eaten more often rank higher.
 */
export function searchProducts(list, query, usage = new Map()) {
  return search(list, query, {
    prefixLength: (p) => brandPrefixLength(p.name),
    usage: (p) => usage.get(p.id)?.count ?? 0,
  });
}

/** Section chips for search results: "All" and the sections that have matches, in list order */
export function resultChips(results, extra = []) {
  const counts = new Map();
  for (const { item } of results) counts.set(productCategory(item), (counts.get(productCategory(item)) ?? 0) + 1);
  return [
    { id: 'all', label: t('search.all'), count: results.length + extra.reduce((n, c) => n + c.count, 0) },
    ...extra,
    ...CATEGORIES.filter(([id]) => counts.has(id)).map(([id]) => ({ id, label: categoryLabel(id), count: counts.get(id) })),
  ];
}

/** Jump chips for the full list: one per non-empty section */
export function sectionChips(list, extra = []) {
  const present = new Set(list.map(productCategory));
  return [...extra, ...CATEGORIES.filter(([id]) => present.has(id)).map(([id]) => ({ id, label: categoryLabel(id) }))];
}

/**
 * Product list by section: [{ id, title, items }]. extra — sections on top, already titled:
 * [{ id, title, items }] (e.g. "Frequent").
 */
export function groupProducts(list, extra = []) {
  const groups = extra.filter((g) => g.items.length);
  const byCategory = new Map(CATEGORIES.map(([id]) => [id, []]));
  for (const p of list) byCategory.get(productCategory(p))?.push(p);
  for (const [id, items] of byCategory) if (items.length) groups.push({ id, title: categoryLabel(id), items });
  return groups;
}

/** Note for a search result row: the section and how often it was eaten */
export function searchNote(product, usage) {
  const section = categoryLabel(productCategory(product));
  const count = usage.get(product.id)?.count ?? 0;
  return count ? `${section} · ${t('picker.timesUsed', { count })}` : section;
}

/** Name without the brand — inside that brand's section it is already in the header */
export function nameInSection(name, section) {
  if (!section || !name.toLowerCase().startsWith(section.toLowerCase() + ' ')) return name;
  const rest = name.slice(section.length).replace(/^[\s,]+/, '');
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

/* ---------- Product card ---------- */

const macroValue = (values, key) => {
  const v = num(values[key]);
  return Number.isNaN(v) ? 0 : v;
};

/** Calories computed from protein, fat and carbs (form values are strings) */
export const kcalFromMacros = (values) =>
  Math.round(Object.entries(KCAL_PER_GRAM).reduce((sum, [key, k]) => sum + macroValue(values, key) * k, 0));

/** Product object from the card's form values, or error text */
export function readProduct(values, chosenIcon) {
  const name = values.name.trim();
  if (!name) return t('product.err.name');

  const data = { name };
  for (const key of MACRO_KEYS) {
    const v = macroValue(values, key);
    if (!Number.isFinite(v) || v < 0 || v > 100) return t('product.err.macro', { name: t(`macro.${key}`) });
    data[key] = v;
  }
  if (data.protein + data.fat + data.carbs > 100) return t('product.err.macroSum');

  const kcal = num(values.kcal);
  data.kcal = Number.isNaN(kcal) ? kcalFromMacros(values) : kcal;
  if (!Number.isFinite(data.kcal) || data.kcal < 0 || data.kcal > 900) return t('product.err.kcal');

  const piece = num(values.pieceGrams);
  if (Number.isNaN(piece) || piece === 0) {
    data.pieceGrams = null;
  } else if (!Number.isFinite(piece) || piece < 0 || piece > 5000) {
    return t('product.err.piece');
  } else {
    data.pieceGrams = piece;
  }

  // Store the icon only if chosen manually and different from the name-matched one
  if (chosenIcon && chosenIcon !== classify(name).icon) data.icon = chosenIcon;

  return data;
}

/** Delete a product and remove it from all days and dishes. false — the user changed their mind. */
export function deleteProduct(product) {
  const days = db.all('days');
  const dishes = db.all('dishes');
  const has = (items) => items.some((i) => i.productId === product.id);
  const usedDays = days.filter((day) => day.meals.some((m) => has(m.items)));
  const usedDishes = dishes.filter((dish) => has(dish.items));

  const where = [
    usedDays.length ? t('product.usedDays', { count: usedDays.length }) : '',
    usedDishes.length ? t('product.usedDishes', { count: usedDishes.length }) : '',
  ].filter(Boolean).join(` ${t('product.and')} `);
  const message = where
    ? t('product.deleteUsedConfirm', { name: product.name, where })
    : t('product.deleteConfirm', { name: product.name });
  if (!confirm(message)) return false;

  const keep = (items) => items.filter((i) => i.productId !== product.id);
  const now = Date.now();
  db.batch([
    { delete: 'products', id: product.id },
    ...usedDays.map((day) => ({
      put: 'days', value: { ...day, meals: day.meals.map((m) => ({ ...m, items: keep(m.items) })), updatedAt: now },
    })),
    ...usedDishes.map((dish) => ({ put: 'dishes', value: { ...dish, items: keep(dish.items), updatedAt: now } })),
  ]);
  return true;
}
