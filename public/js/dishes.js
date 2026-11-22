/**
 * "Dishes" screens and the dish editor.
 * A dish is a template of products with portions. When added to a meal, its ingredients are copied
 * into the meal individually and can then be changed without touching the dish itself.
 */
import { db } from './db.js';
import { sumNutrition } from './calc.js';
import { $, h, fmt0, fmt1, debounce } from './dom.js';
import { t } from './i18n.js';
import { loadProducts } from './products.js';
import { iconTile } from './icons.js';
import { swipeRow, actionSheet } from './ui.js';
import { itemRow, addRow, newItem } from './itemrow.js';
import { openPicker } from './picker.js';
import { go } from './nav.js';

let current = null; // currently open dish
let productsById = new Map();

const listEl = $('#dishes-list');
const emptyEl = $('#dishes-empty');
const nameEl = $('#dish-name');
const summaryEl = $('#dish-summary');
const itemsEl = $('#dish-items');

const saveSoon = debounce(saveCurrent, 400);

async function saveCurrent() {
  if (!current) return;
  current.updatedAt = Date.now();
  // The dish was modified in the app — starter list updates no longer touch it
  delete current.seed;
  await db.put('dishes', current);
}

/** Flush pending dish edits immediately — e.g. before a reload */
export function flushDish() {
  return saveSoon.flush();
}

async function refreshProducts() {
  const products = await loadProducts();
  productsById = new Map(products.map((p) => [p.id, p]));
  return productsById;
}

export async function loadDishes() {
  const dishes = await db.all('dishes');
  return dishes.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ru'));
}

const dishName = (dish) => dish.name.trim() || t('dish.untitled');

/** Ingredients on one line: "Chicken egg 3 pcs · Butter 5 g" */
function compositionLine(dish, byId) {
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

/** Dish row for lists (including the product picker) */
export function dishRow(dish, byId, onClick, { chevron = false } = {}) {
  const total = sumNutrition(dish.items, byId);
  return h('li', {},
    h('button', { type: 'button', class: 'row', onclick: onClick },
      iconTile({ name: dish.name, icon: dish.icon }),
      h('span', { class: 'row__body' },
        h('span', { class: 'row__title' }, dishName(dish)),
        h('span', { class: 'row__sub' }, compositionLine(dish, byId)),
      ),
      h('span', { class: 'row__value' }, `${fmt0.format(total.kcal)} ${t('unit.kcal')}`),
      chevron ? h('span', { class: 'row__chevron', 'aria-hidden': 'true' }, '›') : null,
    ),
  );
}

export function initDishes() {
  $('#dishes-add').addEventListener('click', createDish);
  $('#dishes-empty-add').addEventListener('click', createDish);
  $('#dish-back').addEventListener('click', async () => {
    await saveSoon.flush();
    go('dishes');
  });
  $('#dish-more').addEventListener('click', () => actionSheet(null, [
    { label: t('dish.delete'), danger: true, onClick: () => deleteDish(current) },
  ]));
  nameEl.addEventListener('input', () => {
    current.name = nameEl.value;
    saveSoon();
  });
  nameEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameEl.blur(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveSoon.flush(); });
}

/* ---------- List ---------- */

export async function showDishes() {
  await saveSoon.flush();
  current = null;
  const [dishes, byId] = await Promise.all([loadDishes(), refreshProducts()]);
  listEl.replaceChildren(...dishes.map((dish) => {
    const row = dishRow(dish, byId, () => go('dish', dish.id));
    // Swipe to delete: wrap the row button
    return swipeRow(row.firstElementChild, () => deleteDish(dish));
  }));
  listEl.hidden = dishes.length === 0;
  emptyEl.hidden = dishes.length > 0;
}

async function createDish() {
  const now = Date.now();
  const dish = { name: '', items: [], createdAt: now, updatedAt: now };
  dish.id = await db.put('dishes', dish);
  await go('dish', dish.id);
  nameEl.focus();
}

async function deleteDish(dish) {
  if (!confirm(t('dish.deleteConfirm', { name: dishName(dish) }))) return;
  if (current?.id === dish.id) {
    saveSoon.cancel();
    current = null;
  }
  await db.delete('dishes', dish.id);
  go('dishes');
}

/* ---------- Editor ---------- */

export async function showDish(id) {
  const [dish] = await Promise.all([db.get('dishes', id), refreshProducts()]);
  if (!dish) {
    go('dishes');
    return false;
  }
  current = dish;
  nameEl.value = dish.name;
  renderItems();
  renderSummary();
}

function changed() {
  renderSummary();
  saveSoon();
}

function renderItems() {
  itemsEl.replaceChildren(
    ...current.items.map((item, index) => itemRow({
      item,
      product: productsById.get(item.productId),
      onChange: changed,
      onDelete: () => {
        current.items.splice(index, 1);
        renderItems();
        changed();
      },
    })),
    addRow(t('dish.addIngredient'), () => openPicker({
      title: t('picker.ingredient'),
      onProduct: async (product) => {
        await refreshProducts();
        current.items.push(newItem(product));
        renderItems();
        changed();
      },
    })),
  );
}

function renderSummary() {
  const sum = sumNutrition(current.items, productsById);
  const grams = current.items.reduce((total, i) => total + i.grams, 0);
  summaryEl.replaceChildren(
    h('div', { class: 'dish-summary__main' },
      h('span', { class: 'dish-summary__kcal' }, fmt0.format(sum.kcal)),
      h('span', { class: 'muted' }, ` ${t('unit.kcal')} · ${fmt0.format(grams)} ${t('unit.g')}`),
    ),
    h('div', { class: 'dish-summary__macros' },
      ...['protein', 'fat', 'carbs'].map((key) =>
        h('div', { class: `dish-macro dish-macro--${key}` },
          h('b', {}, fmt1.format(sum[key])),
          h('span', {}, t('dish.macroUnit', { name: t(`macro.${key}`) })),
        )),
    ),
  );
}
