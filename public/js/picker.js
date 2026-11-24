/**
 * Product picker (and dish picker — when adding to a meal).
 * "Dishes" and "Frequent" on top, then products by section; when searching — one ranked list.
 */
import { $, h } from './dom.js';
import { t } from './i18n.js';
import {
  loadProducts, searchProducts, resultChips, sectionChips, searchRow, createRow, productRow, renderGrouped,
  openProductDialog, nameInSection,
} from './products.js';
import { productCategory } from './icons.js';
import { search } from './search.js';
import { initSearchBar, renderChips, scrollToSection, initScrollSpy } from './searchbar.js';
import { usageStats } from './usage.js';

const FREQUENT_LIMIT = 10;

const dialog = $('#picker');
const titleEl = $('#picker-title');
const listEl = $('#picker-list');
const searchBarEl = $('#picker-searchbar');
const chipsEl = searchBarEl.querySelector('.chips');

let options = null;
let products = [];
let usage = new Map(); // productId → { count, lastUsed }
let frequent = []; // products
let searchBar = null;
let spy = null;
let activeChip = 'all';

const DISHES = 'dishes';
const FREQUENT = 'frequent';

/**
 * options: { title, onProduct(product), dishes?: [...], dishRow?(dish, onClick, ranges), onDish?(dish) }
 */
export async function openPicker(opts) {
  options = opts;
  [products, usage] = await Promise.all([loadProducts(), usageStats()]);
  frequent = frequentProducts();
  titleEl.textContent = opts.title;
  searchBar.reset();
  activeChip = 'all';
  render();
  dialog.showModal();
  dialog.scrollTop = 0;
  spy.refresh();
}

export function initPicker() {
  searchBar = initSearchBar(searchBarEl, { scrollArea: dialog, onInput: () => { activeChip = 'all'; render(); } });
  spy = initScrollSpy({
    list: listEl, searchBar: searchBarEl, chips: chipsEl, scrollRoot: dialog, enabled: () => !searchBar.query(),
  });
  $('#picker-new').addEventListener('click', () => createProduct(searchBar.query()));
}

async function createProduct(name) {
  const product = await openProductDialog(null, { name });
  if (product?.id) {
    await loadProducts();
    pickProduct(product);
  }
}

/** Most frequently added products, most used first; ties go to the one used more recently */
function frequentProducts() {
  const byId = new Map(products.map((p) => [p.id, p]));
  return [...usage.entries()]
    .filter(([id]) => byId.has(id))
    .sort(([, a], [, b]) => b.count - a.count || b.lastUsed - a.lastUsed)
    .slice(0, FREQUENT_LIMIT)
    .map(([id]) => byId.get(id));
}

function pickProduct(product) {
  if (dialog.open) dialog.close();
  options.onProduct(product);
}

function pickDish(dish) {
  if (dialog.open) dialog.close();
  options.onDish(dish);
}

const dishesGroup = (items) => [
  h('p', { class: 'group-title', 'data-section': DISHES }, t('picker.dishes')),
  h('ul', { class: 'group group--icons' }, ...items.map(({ item, ranges }) => options.dishRow(item, () => pickDish(item), ranges))),
];

function render() {
  const query = searchBar.query();
  const dishes = options.dishes ?? [];

  if (!query) {
    const box = h('div');
    const frequentTitle = t('picker.frequent');
    renderGrouped(box, products, (p, section) => productRow(p, () => pickProduct(p), {
      section,
      note: section === frequentTitle ? t('picker.timesUsed', { count: usage.get(p.id)?.count }) : null,
    }), { sections: [[frequentTitle, frequent]] });
    // The "Frequent" title gets a stable id for its chip
    box.querySelector(`[data-section="${CSS.escape(frequentTitle)}"]`)?.setAttribute('data-section', FREQUENT);
    listEl.replaceChildren(...(dishes.length ? dishesGroup(dishes.map((item) => ({ item, ranges: [] }))) : []), box);
    const extra = [
      ...(dishes.length ? [{ id: DISHES, label: t('picker.dishes') }] : []),
      ...(frequent.length ? [{ id: FREQUENT, label: frequentTitle }] : []),
    ];
    renderChips(chipsEl, sectionChips(products, extra), {
      onPick: (id) => spy.follow(id, scrollToSection(listEl, searchBarEl, id, dialog)),
    });
    spy.refresh();
    return;
  }

  const foundDishes = search(dishes, query);
  const results = searchProducts(query, usage);
  const extra = foundDishes.length ? [{ id: DISHES, label: t('picker.dishes'), count: foundDishes.length }] : [];
  const chips = resultChips(results, extra);
  if (!chips.some((c) => c.id === activeChip)) activeChip = 'all';
  const showDishes = foundDishes.length && (activeChip === 'all' || activeChip === DISHES);
  const shown = activeChip === 'all' ? results
    : results.filter(({ item }) => productCategory(item) === activeChip);
  renderChips(chipsEl, results.length || foundDishes.length ? chips : [], {
    active: activeChip,
    onPick: (id) => { activeChip = id; render(); },
  });
  const parts = [];
  if (showDishes) parts.push(...dishesGroup(foundDishes));
  if (activeChip !== DISHES && shown.length) {
    if (showDishes) parts.push(h('p', { class: 'group-title' }, t('products.title')));
    parts.push(h('ul', { class: 'group group--icons' },
      ...shown.map(({ item, ranges }) => searchRow(item, ranges, usage, () => pickProduct(item)))));
  }
  if (!results.length && !foundDishes.length) parts.push(h('p', { class: 'empty-note' }, t('products.notFound', { query })));
  parts.push(createRow(query, () => createProduct(query)));
  listEl.replaceChildren(...parts);
}
