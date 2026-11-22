/** "Products" screen, product card and shared product list rows */
import { db } from './db.js';
import { KCAL_PER_GRAM } from './calc.js';
import { $, h, fmt0, num, toInput, macrosLine, plural } from './dom.js';
import { ICONS, ICON_GROUPS, CATEGORIES, iconTile, productCategory, classify, renderIcon } from './icons.js';
import { icon } from './ui.js';

let products = [];

export async function loadProducts() {
  products = await db.all('products');
  products.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  return products;
}

/** Word search: the name must contain all query words, in any order ("bombbar coconut") */
export function matchesQuery(name, query) {
  const words = query.toLowerCase().replace(/ё/g, 'е').split(/[\s,]+/).filter(Boolean);
  const n = name.toLowerCase().replace(/ё/g, 'е');
  return words.every((w) => n.includes(w));
}

export function filterProducts(query) {
  return query.trim() ? products.filter((p) => matchesQuery(p.name, query)) : products;
}

/** Name without the brand — inside that brand's section it is already in the header */
function nameInSection(name, section) {
  if (!section || !name.toLowerCase().startsWith(section.toLowerCase() + ' ')) return name;
  const rest = name.slice(section.length).replace(/^[\s,]+/, '');
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

/** Product row: icon, name, macros, calories. section — the section the row is shown in. */
export function productRow(product, onClick, { chevron = false, section = null } = {}) {
  const piece = product.pieceGrams ? ` · 1 шт ${fmt0.format(product.pieceGrams)} г` : '';
  return h('li', {},
    h('button', { type: 'button', class: 'row', onclick: onClick },
      iconTile(product),
      h('span', { class: 'row__body' },
        h('span', { class: 'row__title' }, nameInSection(product.name, section)),
        h('span', { class: 'row__sub' }, macrosLine(product) + piece),
      ),
      h('span', { class: 'row__value' }, `${fmt0.format(product.kcal)} ккал`),
      chevron ? icon('chevronRight', 18, 'row__chevron') : null,
    ),
  );
}

/**
 * Product list by section. When searching — a single list.
 * sections: extra sections on top, e.g. [['Recent', [...]]].
 */
export function renderGrouped(container, list, makeRow, { searching = false, sections = [] } = {}) {
  const groups = [];
  if (searching) {
    groups.push([null, list]);
  } else {
    groups.push(...sections.filter(([, items]) => items.length));
    const byCategory = new Map(CATEGORIES.map(([name]) => [name, []]));
    for (const p of list) byCategory.get(productCategory(p))?.push(p);
    for (const [name, items] of byCategory) if (items.length) groups.push([name, items]);
  }
  container.replaceChildren(...groups.flatMap(([title, items]) => [
    title ? h('p', { class: 'group-title' }, title) : null,
    h('ul', { class: 'group group--icons' }, ...items.map((item) => makeRow(item, title))),
  ]).filter(Boolean));
}

/* ---------- List ---------- */

const listEl = $('#products-list');
const searchEl = $('#products-search');
const emptyEl = $('#products-empty');

export function initProducts() {
  searchEl.addEventListener('input', render);
  $('#products-add').addEventListener('click', () => editAndRefresh(null, { name: searchEl.value.trim() }));
  initDialog();
}

export async function showProducts() {
  await loadProducts();
  render();
}

function render() {
  const query = searchEl.value.trim();
  const items = filterProducts(query);
  renderGrouped(listEl, items, (p, section) => productRow(p, () => editAndRefresh(p), { chevron: true, section }), { searching: Boolean(query) });
  emptyEl.hidden = items.length > 0;
  emptyEl.textContent = products.length ? `Ничего не найдено по запросу «${query}»` : 'Продуктов пока нет. Нажмите «+», чтобы добавить.';
}

async function editAndRefresh(product, prefill) {
  if (await openProductDialog(product, prefill)) await showProducts();
}

/* ---------- Product card ---------- */

const dialog = $('#product-dialog');
const form = $('#product-form');
const titleEl = $('#product-title');
const errorEl = $('#product-error');
const deleteBtn = $('#product-delete');
const iconBtn = $('#product-icon-btn');
const iconGrid = $('#product-icons');

const FIELDS = ['name', 'kcal', 'protein', 'fat', 'carbs', 'pieceGrams'];
const MACRO_NAMES = { protein: 'Белки', fat: 'Жиры', carbs: 'Углеводы' };

let editing = null;
let result = null;
let resolveDialog = null;
let chosenIcon = null; // null — icon is matched by name

/**
 * Open the product card (product = null — new product).
 * Returns a promise: the saved product, { deleted: true }, or null on cancel.
 */
export function openProductDialog(product = null, prefill = {}) {
  editing = product;
  result = null;
  chosenIcon = product?.icon && ICONS[product.icon] ? product.icon : null;

  form.reset();
  const values = product || prefill;
  for (const key of FIELDS) {
    if (values[key] != null) form.elements[key].value = key === 'name' ? values[key] : toInput(values[key]);
  }
  updateKcalHint();
  updateIcon();
  iconGrid.hidden = true;
  iconBtn.setAttribute('aria-expanded', 'false');

  titleEl.textContent = product ? 'Продукт' : 'Новый продукт';
  deleteBtn.hidden = !product;
  errorEl.hidden = true;

  dialog.showModal();
  if (!product && !values.name) setTimeout(() => form.elements.name.focus(), 50);
  return new Promise((resolve) => { resolveDialog = resolve; });
}

function updateIcon() {
  iconBtn.replaceChildren(iconTile({ name: form.elements.name.value, icon: chosenIcon }, 'tile--lg'));
  for (const b of iconGrid.querySelectorAll('button')) {
    const selected = b.dataset.icon ? b.dataset.icon === chosenIcon : chosenIcon === null;
    b.setAttribute('aria-selected', String(selected));
  }
}

function buildIconGrid() {
  const auto = h('button', {
    type: 'button',
    class: 'icon-grid__auto',
    role: 'option',
    title: 'Подбирать по названию',
    onclick: () => { chosenIcon = null; updateIcon(); },
  }, 'Авто');
  const option = (key) => h('button', {
    type: 'button',
    role: 'option',
    'data-icon': key,
    'aria-label': key,
    onclick: () => { chosenIcon = key; updateIcon(); },
  }, renderIcon(key));
  // Grid by section: the section title spans the full row
  iconGrid.replaceChildren(auto, ...ICON_GROUPS.flatMap(([title, icons]) => [
    h('p', { class: 'icon-grid__title' }, title),
    ...Object.keys(icons).map(option),
  ]));
}

function initDialog() {
  buildIconGrid();

  dialog.addEventListener('close', () => {
    resolveDialog?.(result);
    resolveDialog = null;
  });

  iconBtn.addEventListener('click', () => {
    iconGrid.hidden = !iconGrid.hidden;
    iconBtn.setAttribute('aria-expanded', String(!iconGrid.hidden));
  });

  form.addEventListener('input', (e) => {
    updateKcalHint();
    if (e.target.name === 'name' && chosenIcon === null) updateIcon();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = readProduct();
    if (typeof data === 'string') {
      errorEl.textContent = data;
      errorEl.hidden = false;
      return;
    }
    if (editing) data.id = editing.id;
    data.id = await db.put('products', data);
    result = data;
    dialog.close();
  });

  deleteBtn.addEventListener('click', async () => {
    if (await deleteProduct(editing)) {
      result = { deleted: true };
      dialog.close();
    }
  });
}

const fieldValue = (key) => num(form.elements[key].value);
const macroValue = (key) => {
  const v = fieldValue(key);
  return Number.isNaN(v) ? 0 : v;
};

const kcalFromMacros = () =>
  Math.round(Object.entries(KCAL_PER_GRAM).reduce((sum, [key, k]) => sum + macroValue(key) * k, 0));

/** Placeholder in the empty calories field — computed from macros */
function updateKcalHint() {
  form.elements.kcal.placeholder = String(kcalFromMacros());
}

/** Product object or error text */
function readProduct() {
  const name = form.elements.name.value.trim();
  if (!name) return 'Укажите название';

  const data = { name };
  for (const key of Object.keys(MACRO_NAMES)) {
    const v = macroValue(key);
    if (!Number.isFinite(v) || v < 0 || v > 100) return `${MACRO_NAMES[key]}: от 0 до 100 г`;
    data[key] = v;
  }
  if (data.protein + data.fat + data.carbs > 100) return 'Сумма БЖУ не может быть больше 100 г';

  const kcal = fieldValue('kcal');
  data.kcal = Number.isNaN(kcal) ? kcalFromMacros() : kcal;
  if (!Number.isFinite(data.kcal) || data.kcal < 0 || data.kcal > 900) return 'Калории: от 0 до 900 ккал';

  const piece = fieldValue('pieceGrams');
  if (Number.isNaN(piece) || piece === 0) {
    data.pieceGrams = null;
  } else if (!Number.isFinite(piece) || piece < 0 || piece > 5000) {
    return 'Вес штуки: от 0 до 5000 г';
  } else {
    data.pieceGrams = piece;
  }

  // Store the icon only if chosen manually and different from the name-matched one
  if (chosenIcon && chosenIcon !== classify(name).icon) data.icon = chosenIcon;

  return data;
}

/** Delete a product and remove it from all days and dishes. false — the user changed their mind. */
async function deleteProduct(product) {
  const [days, dishes] = await Promise.all([db.all('days'), db.all('dishes')]);
  const has = (items) => items.some((i) => i.productId === product.id);
  const usedDays = days.filter((day) => day.meals.some((m) => has(m.items)));
  const usedDishes = dishes.filter((dish) => has(dish.items));

  const where = [
    usedDays.length ? `в ${usedDays.length} ${plural(usedDays.length, 'дне', 'днях', 'днях')}` : '',
    usedDishes.length ? `в ${usedDishes.length} ${plural(usedDishes.length, 'блюде', 'блюдах', 'блюдах')}` : '',
  ].filter(Boolean).join(' и ');
  const message = where
    ? `«${product.name}» есть ${where} и будет оттуда убран. Удалить?`
    : `Удалить «${product.name}»?`;
  if (!confirm(message)) return false;

  const keep = (items) => items.filter((i) => i.productId !== product.id);
  await db.run(['products', 'days', 'dishes'], 'readwrite', (tx) => {
    tx.objectStore('products').delete(product.id);
    const now = Date.now();
    for (const day of usedDays) {
      for (const meal of day.meals) meal.items = keep(meal.items);
      tx.objectStore('days').put({ ...day, updatedAt: now });
    }
    for (const dish of usedDishes) {
      tx.objectStore('dishes').put({ ...dish, items: keep(dish.items), updatedAt: now });
    }
  });
  return true;
}
