/**
 * Product row with quantity: icon, name, portion calories, macros, stepper "− 150 g +"
 * and "g | pcs" toggle. The same row is used in meals and in dish ingredients.
 */
import { portion } from './calc.js';
import { h, fmt0, fmt1, num, toInput } from './dom.js';
import { iconTile } from './icons.js';
import { icon, swipeRow } from './ui.js';

export const MAX_GRAMS = 5000;
export const DEFAULT_GRAMS = 100;
// Step for the "−" / "+" buttons
const STEP_GRAMS = 10;
const STEP_PIECES = 1;

const round = (value, digits) => Math.round(value * 10 ** digits) / 10 ** digits;

/** New item for a product: piece-based — 1 piece, others — 100 g */
export function newItem(product) {
  return product.pieceGrams > 0
    ? { productId: product.id, grams: product.pieceGrams, unit: 'pcs' }
    : { productId: product.id, grams: DEFAULT_GRAMS, unit: 'g' };
}

/** Value for the input: pieces or grams */
function amountForInput(item, pieceGrams) {
  return item.unit === 'pcs' && pieceGrams
    ? toInput(round(item.grams / pieceGrams, 2))
    : toInput(round(item.grams, 1));
}

/**
 * item — { productId, grams, unit }, mutated in place.
 * onChange() — after any change of quantity or unit; onDelete() — "Delete" swipe.
 */
export function itemRow({ item, product, onChange, onDelete }) {
  const pieceGrams = product?.pieceGrams > 0 ? product.pieceGrams : null;
  if (!pieceGrams) item.unit = 'g';

  const kcalEl = h('span', { class: 'item__kcal' });
  const subEl = h('span', { class: 'item__sub' });
  const updateText = () => {
    if (!product) {
      kcalEl.textContent = '';
      subEl.textContent = 'Продукт удалён';
      return;
    }
    const p = portion(product, item.grams);
    kcalEl.replaceChildren(fmt0.format(p.kcal), h('small', {}, ' ккал'));
    const parts = [`Б ${fmt1.format(p.protein)}`, `Ж ${fmt1.format(p.fat)}`, `У ${fmt1.format(p.carbs)}`];
    if (item.unit === 'pcs') parts.unshift(`${fmt0.format(item.grams)} г`);
    // Keep each value whole: line breaks only between them
    subEl.replaceChildren(...parts.flatMap((text, i) => [i ? ' · ' : '', h('span', { class: 'nowrap' }, text)]));
  };
  updateText();

  /** Set the quantity in the current unit */
  const setAmount = (amount) => {
    const value = Number.isFinite(amount) && amount > 0 ? amount : 0;
    item.grams = Math.min(MAX_GRAMS, item.unit === 'pcs' ? value * pieceGrams : value);
    updateText();
    onChange();
  };

  const input = h('input', {
    type: 'text',
    inputMode: 'decimal',
    autocomplete: 'off',
    enterKeyHint: 'done',
    value: amountForInput(item, pieceGrams),
    'aria-label': item.unit === 'pcs' ? 'Количество, штук' : 'Вес, граммы',
    onfocus: () => setTimeout(() => input.select(), 0),
    oninput: () => setAmount(num(input.value)),
    onkeydown: (e) => { if (e.key === 'Enter') input.blur(); },
  });

  /** "−" / "+" step: the value snaps to a multiple of the step (123 g → 130 or 120) */
  const step = (direction) => {
    const size = item.unit === 'pcs' ? STEP_PIECES : STEP_GRAMS;
    const amountNow = item.unit === 'pcs' ? item.grams / pieceGrams : item.grams;
    const units = amountNow / size;
    const next = direction > 0
      ? (Math.floor(units + 1e-9) + 1) * size
      : (Math.ceil(units - 1e-9) - 1) * size;
    setAmount(Math.max(0, round(next, 2)));
    input.value = amountForInput(item, pieceGrams);
  };

  const unitLabel = () => (item.unit === 'pcs' ? 'шт' : 'г');
  const unitEl = h('span', { class: 'stepper__unit' }, unitLabel());

  const stepper = h('div', { class: 'stepper' },
    h('button', { type: 'button', 'aria-label': 'Уменьшить', onclick: () => step(-1) }, icon('minus', 18)),
    input,
    unitEl,
    h('button', { type: 'button', 'aria-label': 'Увеличить', onclick: () => step(1) }, icon('plus', 18)),
  );

  /** "g | pcs" toggle — only for products with a piece weight set */
  let units = null;
  if (pieceGrams) {
    const setUnit = (value) => {
      if (item.unit === value) return;
      item.unit = value;
      unitEl.textContent = unitLabel();
      input.value = amountForInput(item, pieceGrams);
      input.setAttribute('aria-label', item.unit === 'pcs' ? 'Количество, штук' : 'Вес, граммы');
      updateText();
      for (const b of units.children) b.setAttribute('aria-pressed', String(b.dataset.unit === item.unit));
      onChange();
    };
    const option = (value, text) => h('button', {
      type: 'button',
      'data-unit': value,
      'aria-pressed': String(item.unit === value),
      onclick: () => setUnit(value),
    }, text);
    units = h('div', { class: 'units', role: 'group', 'aria-label': 'Единицы' },
      option('g', 'г'),
      option('pcs', `шт · ${fmt0.format(pieceGrams)} г`),
    );
  }

  const content = h('div', { class: 'item' },
    iconTile(product ?? { name: '' }),
    h('div', { class: 'item__head' },
      h('span', { class: 'item__title' }, product?.name ?? 'Неизвестный продукт'),
      kcalEl,
    ),
    h('div', { class: 'item__line' },
      subEl,
      h('div', { class: 'item__controls' }, stepper, units),
    ),
  );

  return swipeRow(content, onDelete);
}

/** "+ Add …" row at the end of the list */
export function addRow(label, onClick) {
  return h('li', {},
    h('button', { type: 'button', class: 'row row--add', onclick: onClick },
      h('span', { class: 'add-circle' }, h('span', {}, icon('plus', 16))),
      h('span', {}, label),
    ),
  );
}
