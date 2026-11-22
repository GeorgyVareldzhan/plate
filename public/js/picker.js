/**
 * Product picker (and dish picker — when adding to a meal).
 * "Dishes" and "Frequent" on top, then products by section; when searching — a single list.
 */
import { db } from './db.js';
import { $, h } from './dom.js';
import { t } from './i18n.js';
import { loadProducts, filterProducts, matchesQuery, productRow, renderGrouped, openProductDialog } from './products.js';

const FREQUENT_LIMIT = 10;

const dialog = $('#picker');
const titleEl = $('#picker-title');
const searchEl = $('#picker-search');
const listEl = $('#picker-list');

let options = null;
let frequent = []; // [{ product, count }]

/**
 * options: { title, onProduct(product), dishes?: [...], dishRow?(dish, onClick), onDish?(dish) }
 */
export async function openPicker(opts) {
  options = opts;
  const products = await loadProducts();
  frequent = await frequentProducts(new Map(products.map((p) => [p.id, p])));
  titleEl.textContent = opts.title;
  searchEl.value = '';
  render();
  dialog.showModal();
  dialog.scrollTop = 0;
}

export function initPicker() {
  searchEl.addEventListener('input', render);
  $('#picker-new').addEventListener('click', async () => {
    const product = await openProductDialog(null, { name: searchEl.value.trim() });
    if (product?.id) {
      await loadProducts();
      pickProduct(product);
    }
  });
}

/**
 * Most frequently added products across all days, most used first.
 * Ties go to the product used more recently.
 */
async function frequentProducts(productsById) {
  const days = await db.all('days');
  const stats = new Map(); // productId → { count, lastUsed }
  for (const day of days) {
    for (const item of day.meals.flatMap((m) => m.items)) {
      if (!productsById.has(item.productId)) continue;
      const s = stats.get(item.productId) ?? { count: 0, lastUsed: 0 };
      s.count += 1;
      s.lastUsed = Math.max(s.lastUsed, day.updatedAt ?? 0);
      stats.set(item.productId, s);
    }
  }
  return [...stats.entries()]
    .sort(([, a], [, b]) => b.count - a.count || b.lastUsed - a.lastUsed)
    .slice(0, FREQUENT_LIMIT)
    .map(([id, s]) => ({ product: productsById.get(id), count: s.count }));
}

function pickProduct(product) {
  if (dialog.open) dialog.close();
  options.onProduct(product);
}

function pickDish(dish) {
  if (dialog.open) dialog.close();
  options.onDish(dish);
}

function render() {
  const query = searchEl.value.trim();
  const products = filterProducts(query);
  const dishes = (options.dishes ?? []).filter((d) => !query || matchesQuery(d.name, query));

  const parts = [];
  if (dishes.length) {
    parts.push(
      h('p', { class: 'group-title' }, t('picker.dishes')),
      h('ul', { class: 'group group--icons' }, ...dishes.map((d) => options.dishRow(d, () => pickDish(d)))),
    );
  }
  if (products.length) {
    const box = h('div');
    const frequentTitle = t('picker.frequent');
    const counts = new Map(frequent.map(({ product, count }) => [product.id, count]));
    renderGrouped(box, products, (p, section) => productRow(p, () => pickProduct(p), {
      section,
      note: section === frequentTitle ? t('picker.timesUsed', { count: counts.get(p.id) }) : null,
    }), {
      searching: Boolean(query),
      sections: [[frequentTitle, frequent.map(({ product }) => product)]],
    });
    parts.push(box);
  }
  if (!parts.length) {
    parts.push(h('p', { class: 'empty-note' }, t('picker.notFound', { query })));
  }
  listEl.replaceChildren(...parts);
}
