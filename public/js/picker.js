/**
 * Окно выбора продукта (и блюда — когда добавляем в приём пищи).
 * Сверху «Блюда» и «Недавние», дальше продукты по разделам; при поиске — одним списком.
 */
import { db } from './db.js';
import { $, h } from './dom.js';
import { loadProducts, filterProducts, matchesQuery, productRow, renderGrouped, openProductDialog } from './products.js';

const RECENT_LIMIT = 8;

const dialog = $('#picker');
const titleEl = $('#picker-title');
const searchEl = $('#picker-search');
const listEl = $('#picker-list');

let options = null;
let recent = [];

/**
 * options: { title, onProduct(product), dishes?: [...], dishRow?(dish, onClick), onDish?(dish) }
 */
export async function openPicker(opts) {
  options = opts;
  const products = await loadProducts();
  recent = await recentProducts(new Map(products.map((p) => [p.id, p])));
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

/** Недавно использованные продукты — из последних изменённых дней */
async function recentProducts(productsById) {
  const days = (await db.all('days')).sort((a, b) => b.updatedAt - a.updatedAt);
  const ids = [];
  for (const day of days) {
    for (const item of day.meals.flatMap((m) => m.items).reverse()) {
      if (ids.length >= RECENT_LIMIT) break;
      if (!ids.includes(item.productId) && productsById.has(item.productId)) ids.push(item.productId);
    }
    if (ids.length >= RECENT_LIMIT) break;
  }
  return ids.map((id) => productsById.get(id));
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
      h('p', { class: 'group-title' }, 'Блюда'),
      h('ul', { class: 'group group--icons' }, ...dishes.map((d) => options.dishRow(d, () => pickDish(d)))),
    );
  }
  if (products.length) {
    const box = h('div');
    renderGrouped(box, products, (p, section) => productRow(p, () => pickProduct(p), { section }), {
      searching: Boolean(query),
      sections: [['Недавние', recent]],
    });
    parts.push(box);
  }
  if (!parts.length) {
    parts.push(h('p', { class: 'empty-note' }, `Ничего не найдено. Нажмите «Новый», чтобы создать «${query}».`));
  }
  listEl.replaceChildren(...parts);
}
