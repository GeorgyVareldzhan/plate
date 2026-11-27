/** "Products" screen, product card and shared product list rows */
import { db } from './db.js';
import { KCAL_PER_GRAM } from './calc.js';
import { $, h, fmt0, num, toInput } from './dom.js';
import { t, macrosLine, categoryLabel, LANGUAGES, getLanguage, saveLanguage } from './i18n.js';
import { ICONS, ICON_GROUPS, CATEGORIES, iconTile, productCategory, classify, renderIcon, brandPrefixLength } from './icons.js';
import { icon, actionSheet, spinner } from './ui.js';
import { search } from './search.js';
import { initSearchBar, renderChips, scrollToSection, highlight, initScrollSpy } from './searchbar.js';
import { addRow } from './itemrow.js';
import { usageStats } from './usage.js';
import { parseLabel, parseLabelCandidates } from './label.js';
import { readLabelPhoto, releaseOcr } from './ocr.js';

/** Adding products is hidden for now (the code stays): users pick from the shared catalog */
export const CAN_ADD_PRODUCTS = false;

let products = [];

export async function loadProducts() {
  products = await db.all('products');
  products.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  return products;
}

/**
 * Ranked product search (see search.js): [{ item, ranges }], best first.
 * usage — Map productId → { count }: products eaten more often rank higher.
 */
export function searchProducts(query, usage = new Map()) {
  return search(products, query, {
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

/** Search result row: the section and how often it was eaten under the name */
export function searchRow(product, ranges, usage, onClick) {
  const section = productCategory(product);
  const count = usage.get(product.id)?.count ?? 0;
  const note = count ? `${categoryLabel(section)} · ${t('picker.timesUsed', { count })}` : categoryLabel(section);
  return productRow(product, onClick, { section, note, ranges });
}

/** "Create product “…”" at the end of search results */
/** "Create «query»" row under search results; nothing while adding products is hidden */
export const createRow = (query, onClick) => (CAN_ADD_PRODUCTS
  ? [h('ul', { class: 'group group--icons group--create' }, addRow(t('search.create', { query }), onClick))]
  : []);

/** Name without the brand — inside that brand's section it is already in the header */
export function nameInSection(name, section) {
  if (!section || !name.toLowerCase().startsWith(section.toLowerCase() + ' ')) return name;
  const rest = name.slice(section.length).replace(/^[\s,]+/, '');
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

/** Product row: icon, name, macros, calories. section — the section the row is shown in; note — extra text before the macros. */
export function productRow(product, onClick, { chevron = false, section = null, note = null, ranges = null } = {}) {
  const piece = product.pieceGrams
    ? ` · ${t('products.piece', { pcs: t('unit.pcs'), grams: fmt0.format(product.pieceGrams), g: t('unit.g') })}`
    : '';
  return h('li', {},
    h('button', { type: 'button', class: 'row', onclick: onClick },
      iconTile(product),
      h('span', { class: 'row__body' },
        h('span', { class: 'row__title' }, ...titleWithHighlight(product.name, section, ranges)),
        h('span', { class: 'row__sub' }, note ? `${note} · ${macrosLine(product)}${piece}` : macrosLine(product) + piece),
      ),
      h('span', { class: 'row__value' }, `${fmt0.format(product.kcal)} ${t('unit.kcal')}`),
      chevron ? icon('chevronRight', 18, 'row__chevron') : null,
    ),
  );
}

/** Title shown in a section, with search matches highlighted (ranges are positions in the full name) */
function titleWithHighlight(name, section, ranges) {
  const title = nameInSection(name, section);
  const offset = name.length - title.length;
  return highlight(title, ranges?.map(([s, e]) => [s - offset, e - offset]));
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
    title ? h('p', { class: 'group-title', 'data-section': id }, title) : null,
    h('ul', { class: 'group group--icons' }, ...items.map((item) => makeRow(item, id))),
  ]).filter(Boolean));
}

/* ---------- List ---------- */

const listEl = $('#products-list');
const emptyEl = $('#products-empty');
const searchBarEl = $('#products-searchbar');
const chipsEl = searchBarEl.querySelector('.chips');

let searchBar = null;
let spy = null;
let usage = new Map();
let activeChip = 'all'; // section filter while searching

export function initProducts() {
  searchBar = initSearchBar(searchBarEl, { scrollArea: document, onInput: () => { activeChip = 'all'; render(); } });
  spy = initScrollSpy({
    list: listEl, searchBar: searchBarEl, chips: chipsEl, scrollRoot: window, enabled: () => !searchBar.query(),
  });
  $('#products-add').hidden = !CAN_ADD_PRODUCTS;
  $('#products-add').addEventListener('click', () => editAndRefresh(null, { name: searchBar.query() }));
  initLanguageSwitch();
  initDialog();
}

export async function showProducts() {
  [usage] = await Promise.all([usageStats(), loadProducts()]);
  render();
}

function render() {
  const query = searchBar.query();
  const edit = (p) => () => editAndRefresh(p);
  if (!query) {
    renderGrouped(listEl, products, (p, section) => productRow(p, edit(p), { chevron: true, section }));
    renderChips(chipsEl, sectionChips(products), {
      onPick: (id) => spy.follow(id, scrollToSection(listEl, searchBarEl, id, window)),
    });
    spy.refresh();
    emptyEl.hidden = products.length > 0;
    emptyEl.textContent = t('products.empty');
    return;
  }
  const results = searchProducts(query, usage);
  const chips = resultChips(results);
  if (!chips.some((c) => c.id === activeChip)) activeChip = 'all';
  const shown = activeChip === 'all' ? results : results.filter(({ item }) => productCategory(item) === activeChip);
  renderChips(chipsEl, results.length ? chips : [], { active: activeChip, onPick: (id) => { activeChip = id; render(); } });
  listEl.replaceChildren(
    ...(shown.length ? [h('ul', { class: 'group group--icons' },
      ...shown.map(({ item, ranges }) => searchRow(item, ranges, usage, edit(item))))] : []),
    ...createRow(query, () => editAndRefresh(null, { name: query })),
  );
  emptyEl.hidden = results.length > 0;
  emptyEl.textContent = t('products.notFound', { query });
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
const submitBtn = form.querySelector('[type="submit"]');
const labelBtn = $('#product-label');
const catalogNote = $('#product-catalog-note');
const iconBtn = $('#product-icon-btn');
const iconGrid = $('#product-icons');

const FIELDS = ['name', 'kcal', 'protein', 'fat', 'carbs', 'pieceGrams'];
const MACRO_KEYS = ['protein', 'fat', 'carbs'];

let editing = null;
let result = null;
let resolveDialog = null;
let chosenIcon = null; // null — icon is matched by name
let openedWith = ''; // form state when the card opened — to tell if anything changed

const formState = () => JSON.stringify([...new FormData(form).entries(), chosenIcon]);

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

  // Catalog products are shared and edited only by the admin — the card is read-only
  const readOnly = Boolean(product?.catalog);
  for (const el of form.elements) if (!el.hasAttribute('data-close')) el.disabled = readOnly;
  submitBtn.hidden = readOnly;
  labelBtn.hidden = readOnly;
  catalogNote.hidden = !readOnly;
  dialog.querySelector('.product-hero__hint').hidden = readOnly;
  form.querySelector('[data-close]').textContent = t(readOnly ? 'action.close' : 'action.cancel');
  titleEl.textContent = product ? t('product.title') : t('product.new');
  deleteBtn.hidden = !product || readOnly;
  errorEl.hidden = true;
  $('#product-paste-status').hidden = true;

  openedWith = readOnly ? null : formState();
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

  // Pulled down with unsaved changes: ask before throwing them away
  dialog.beforeSwipeClose = () => openedWith === null || formState() === openedWith || confirm(t('product.discardConfirm'));

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
function labelStatus(text, { bad = false, busy = false } = {}) {
  const status = $('#product-paste-status');
  status.hidden = false;
  status.classList.toggle('is-bad', bad);
  status.classList.toggle('is-busy', busy);
  status.replaceChildren(...(busy ? [spinner(16)] : []), text);
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
      labelStatus(t(stage === 'loading' ? 'product.ocrLoading' : 'product.ocrReading', { percent }), { busy: true });
    });
    if (dialog.open) fillFromLabel(found, 'product.photoNothing');
  } catch (error) {
    console.error(error);
    labelStatus(t('product.ocrFailed'), { bad: true });
  } finally {
    button.disabled = false;
  }
}

/** Put the values found on a label into the form and highlight them */
function fillFromLabel(found, nothingKey) {
  const keys = ['kcal', ...MACRO_KEYS].filter((key) => found[key] != null);
  if (!keys.length) {
    labelStatus(t(nothingKey), { bad: true });
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
