/** "Products" screen, product card and shared product list rows */
import { db } from './db.js';
import { KCAL_PER_GRAM } from './calc.js';
import { $, h, fmt0, num, toInput } from './dom.js';
import { t, macrosLine, categoryLabel, LANGUAGES, getLanguage, saveLanguage } from './i18n.js';
import { ICONS, ICON_GROUPS, CATEGORIES, iconTile, productCategory, classify, renderIcon } from './icons.js';
import { icon, actionSheet } from './ui.js';
import { normalizeSearch } from './i18n/search.ru.js';
import { parseLabel, parseLabelCandidates } from './label.js';
import { readLabelPhoto, releaseOcr } from './ocr.js';

let products = [];

export async function loadProducts() {
  products = await db.all('products');
  products.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  return products;
}

/** Word search: the name must contain all query words, in any order ("bombbar coconut") */
export function matchesQuery(name, query) {
  const words = normalizeSearch(query).split(/[\s,]+/).filter(Boolean);
  const n = normalizeSearch(name);
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

/** Product row: icon, name, macros, calories. section — the section the row is shown in; note — extra text before the macros. */
export function productRow(product, onClick, { chevron = false, section = null, note = null } = {}) {
  const piece = product.pieceGrams
    ? ` · ${t('products.piece', { pcs: t('unit.pcs'), grams: fmt0.format(product.pieceGrams), g: t('unit.g') })}`
    : '';
  return h('li', {},
    h('button', { type: 'button', class: 'row', onclick: onClick },
      iconTile(product),
      h('span', { class: 'row__body' },
        h('span', { class: 'row__title' }, nameInSection(product.name, section)),
        h('span', { class: 'row__sub' }, note ? `${note} · ${macrosLine(product)}${piece}` : macrosLine(product) + piece),
      ),
      h('span', { class: 'row__value' }, `${fmt0.format(product.kcal)} ${t('unit.kcal')}`),
      chevron ? icon('chevronRight', 18, 'row__chevron') : null,
    ),
  );
}

/**
 * Product list by section. When searching — a single list.
 * sections: extra sections on top, e.g. [['Frequent', [...]]].
 */
export function renderGrouped(container, list, makeRow, { searching = false, sections = [] } = {}) {
  const groups = [];
  // [section id, items, title]: extra sections already come with a translated title
  if (searching) {
    groups.push([null, list, null]);
  } else {
    for (const [title, items] of sections) if (items.length) groups.push([title, items, title]);
    const byCategory = new Map(CATEGORIES.map(([id]) => [id, []]));
    for (const p of list) byCategory.get(productCategory(p))?.push(p);
    for (const [id, items] of byCategory) if (items.length) groups.push([id, items, categoryLabel(id)]);
  }
  container.replaceChildren(...groups.flatMap(([id, items, title]) => [
    title ? h('p', { class: 'group-title' }, title) : null,
    h('ul', { class: 'group group--icons' }, ...items.map((item) => makeRow(item, id))),
  ]).filter(Boolean));
}

/* ---------- List ---------- */

const listEl = $('#products-list');
const searchEl = $('#products-search');
const emptyEl = $('#products-empty');

export function initProducts() {
  searchEl.addEventListener('input', render);
  $('#products-add').addEventListener('click', () => editAndRefresh(null, { name: searchEl.value.trim() }));
  initLanguageSwitch();
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
  emptyEl.textContent = products.length ? t('products.notFound', { query }) : t('products.empty');
}

async function editAndRefresh(product, prefill) {
  if (await openProductDialog(product, prefill)) await showProducts();
}

/* ---------- Language switch (bottom of the screen, low-key on purpose) ---------- */

function initLanguageSwitch() {
  const button = $('#language-btn');
  const current = LANGUAGES.find(([code]) => code === getLanguage());
  button.textContent = t('language.label', { name: current[1] });
  button.addEventListener('click', () => actionSheet(null, LANGUAGES.map(([code, name]) => ({
    label: code === getLanguage() ? `✓ ${name}` : name,
    onClick: async () => {
      if (code === getLanguage()) return;
      await saveLanguage(code);
      // Reload so every screen is rebuilt in the new language; come back to this screen
      try { sessionStorage.setItem('restore-view', JSON.stringify({ name: 'products', args: [] })); } catch { /* ignore */ }
      location.reload();
    },
  }))));
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
const MACRO_KEYS = ['protein', 'fat', 'carbs'];

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

  titleEl.textContent = product ? t('product.title') : t('product.new');
  deleteBtn.hidden = !product;
  errorEl.hidden = true;
  $('#product-paste-status').hidden = true;

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
    title: t('product.iconAutoTitle'),
    onclick: () => { chosenIcon = null; updateIcon(); },
  }, t('product.iconAuto'));
  const option = (key) => h('button', {
    type: 'button',
    role: 'option',
    'data-icon': key,
    'aria-label': key,
    onclick: () => { chosenIcon = key; updateIcon(); },
  }, renderIcon(key));
  // Grid by section: the section title spans the full row
  iconGrid.replaceChildren(auto, ...ICON_GROUPS.flatMap(([title, icons]) => [
    h('p', { class: 'icon-grid__title' }, t(`iconGroup.${title}`)),
    ...Object.keys(icons).map(option),
  ]));
}

function initDialog() {
  buildIconGrid();

  dialog.addEventListener('close', () => {
    releaseOcr();
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

  $('#product-label').addEventListener('click', () => actionSheet(null, [
    // The file picker must open within the tap, so the sheet's handler clicks the input directly
    { label: t('product.labelPhoto'), onClick: () => $('#product-photo').click() },
    { label: t('product.labelPaste'), onClick: pasteFromLabel },
  ]));
  $('#product-photo').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) await photoFromLabel(file);
  });

  deleteBtn.addEventListener('click', async () => {
    if (await deleteProduct(editing)) {
      result = { deleted: true };
      dialog.close();
    }
  });
}

/** Label text from the clipboard; if reading is not allowed, ask to paste it */
async function readLabelText() {
  try {
    const text = await navigator.clipboard.readText();
    if (text.trim()) return text;
  } catch { /* denied or unsupported — fall back to a prompt */ }
  return prompt(t('product.pastePrompt')) ?? '';
}

/** Status line under the nutrition fields */
function labelStatus(text, bad = false) {
  const status = $('#product-paste-status');
  status.hidden = false;
  status.classList.toggle('is-bad', bad);
  status.textContent = text;
}

/** Fill calories and macros from label text copied from a photo (iOS Live Text) */
async function pasteFromLabel() {
  const text = await readLabelText();
  if (!text.trim()) return;
  fillFromLabel(parseLabel(text), 'product.pasteNothing');
}

/** Recognize a label photo on the device and fill the fields */
async function photoFromLabel(file) {
  const button = $('#product-label');
  button.disabled = true;
  try {
    const found = await readLabelPhoto(file, parseLabelCandidates, ({ stage, percent }) => {
      labelStatus(t(stage === 'loading' ? 'product.ocrLoading' : 'product.ocrReading', { percent }));
    });
    if (dialog.open) fillFromLabel(found, 'product.photoNothing');
  } catch (error) {
    console.error(error);
    labelStatus(t('product.ocrFailed'), true);
  } finally {
    button.disabled = false;
  }
}

/** Put the values found on a label into the form and highlight them */
function fillFromLabel(found, nothingKey) {
  const keys = ['kcal', ...MACRO_KEYS].filter((key) => found[key] != null);
  if (!keys.length) {
    labelStatus(t(nothingKey), true);
    return;
  }
  for (const key of keys) {
    const input = form.elements[key];
    input.value = toInput(found[key]);
    const row = input.closest('.form-row');
    row.classList.remove('is-pasted');
    void row.offsetWidth; // restart the highlight animation
    row.classList.add('is-pasted');
  }
  updateKcalHint();
  const names = { kcal: 'macro.kcal', protein: 'macro.protein', fat: 'macro.fat', carbs: 'macro.carbs' };
  labelStatus(t('product.pasteFilled', { fields: keys.map((key) => t(names[key]).toLowerCase()).join(', ') }));
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
  if (!name) return t('product.err.name');

  const data = { name };
  for (const key of MACRO_KEYS) {
    const v = macroValue(key);
    if (!Number.isFinite(v) || v < 0 || v > 100) return t('product.err.macro', { name: t(`macro.${key}`) });
    data[key] = v;
  }
  if (data.protein + data.fat + data.carbs > 100) return t('product.err.macroSum');

  const kcal = fieldValue('kcal');
  data.kcal = Number.isNaN(kcal) ? kcalFromMacros() : kcal;
  if (!Number.isFinite(data.kcal) || data.kcal < 0 || data.kcal > 900) return t('product.err.kcal');

  const piece = fieldValue('pieceGrams');
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
async function deleteProduct(product) {
  const [days, dishes] = await Promise.all([db.all('days'), db.all('dishes')]);
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
