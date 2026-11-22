/** Экраны «Дни» и «День»: цели, приёмы пищи, граммовки и итоги */
import { db } from './db.js';
import {
  MACROS, EMPTY_TARGETS, portion, sumNutrition, targetStatus, statusClass,
} from './calc.js';
import { $, h, fmt0, num, toInput, plural, debounce } from './dom.js';
import { loadProducts } from './products.js';
import { icon, ring, bar, swipeRow, actionSheet } from './ui.js';
import { itemRow, addRow, newItem } from './itemrow.js';
import { openPicker } from './picker.js';
import { loadDishes, dishRow } from './dishes.js';
import { renderDayImage, canvasToFile, shareFile } from './share.js';
import { go } from './nav.js';

const MAX_MEALS = 10;

const MACRO_NAMES = { protein: 'Белки', fat: 'Жиры', carbs: 'Углеводы' };

let current = null; // открытый день
let productsById = new Map();

const daysListEl = $('#days-list');
const daysEmptyEl = $('#days-empty');
const titleEl = $('#day-title');
const subtitleEl = $('#day-subtitle');
const dateEl = $('#day-date');
const summaryEl = $('#day-summary');
const mealsEl = $('#day-meals');
const addMealBtn = $('#day-add-meal');
const totalsEl = $('#day-totals');
const targetsDialog = $('#targets-dialog');
const targetsForm = $('#targets-form');

const saveSoon = debounce(saveCurrent, 400);

async function saveCurrent() {
  if (!current) return;
  current.updatedAt = Date.now();
  await db.put('days', current);
}

/** Сразу записать отложенные правки дня — например, перед перезагрузкой */
export function flushDay() {
  return saveSoon.flush();
}

async function refreshProducts() {
  const products = await loadProducts();
  productsById = new Map(products.map((p) => [p.id, p]));
}

/* ---------- Даты ---------- */

function todayIso(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseIso(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const fmtShort = new Intl.DateTimeFormat('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
const fmtShortYear = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtFull = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtWeekday = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' });

function dateTitle(iso) {
  if (iso === todayIso()) return 'Сегодня';
  if (iso === todayIso(-1)) return 'Вчера';
  if (iso === todayIso(1)) return 'Завтра';
  const date = parseIso(iso);
  return capitalize((date.getFullYear() === new Date().getFullYear() ? fmtShort : fmtShortYear).format(date));
}

/** Сначала новые даты, при равной дате — созданные позже */
const byDateDesc = (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt;

const allItems = (day) => day.meals.flatMap((m) => m.items);

/* ---------- Инициализация ---------- */

export function initDays() {
  $('#days-add').addEventListener('click', createDay);
  $('#days-empty-add').addEventListener('click', createDay);

  $('#day-back').addEventListener('click', async () => {
    await saveSoon.flush();
    go('days');
  });
  $('#day-more').addEventListener('click', openDayActions);

  // В десктопных браузерах прозрачное поле даты само не открывает календарь
  dateEl.addEventListener('click', () => { try { dateEl.showPicker(); } catch { /* iOS откроет сам */ } });
  dateEl.addEventListener('change', () => {
    if (!dateEl.value) {
      dateEl.value = current.date;
      return;
    }
    current.date = dateEl.value;
    renderTitle();
    saveSoon();
  });

  targetsForm.addEventListener('input', (e) => {
    const value = num(e.target.value);
    current.targets[e.target.name] = Number.isFinite(value) && value > 0 ? value : null;
    renderTotals();
    saveSoon();
  });
  targetsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    targetsDialog.close();
  });

  addMealBtn.addEventListener('click', () => {
    if (current.meals.length >= MAX_MEALS) return;
    current.meals.push({ items: [] });
    renderMeals();
    saveSoon();
    mealsEl.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  document.addEventListener('visibilitychange', () => { if (document.hidden) saveSoon.flush(); });

  // Нижняя панель итогов видна, только когда сводка ушла за экран
  new IntersectionObserver(([entry]) => {
    totalsEl.classList.toggle('is-visible', !entry.isIntersecting && document.body.dataset.view === 'day');
  }, { threshold: 0 }).observe(summaryEl);

  keepTotalsAboveKeyboard();
}

/**
 * На iPhone клавиатура перекрывает fixed-элементы внизу экрана.
 * Сдвигаем панель итогов вверх, чтобы итог был виден, пока меняешь граммы.
 */
function keepTotalsAboveKeyboard() {
  const vv = window.visualViewport;
  if (!vv) return;
  const update = () => {
    const offset = window.innerHeight - vv.height - vv.offsetTop;
    totalsEl.style.setProperty('--kb-offset', offset > 1 ? `${-offset}px` : '0px');
  };
  vv.addEventListener('resize', update);
  vv.addEventListener('scroll', update);
}

/* ---------- Список дней ---------- */

export async function showDays() {
  await saveSoon.flush();
  current = null;
  totalsEl.classList.remove('is-visible');
  const [days] = await Promise.all([db.all('days'), refreshProducts()]);
  days.sort(byDateDesc);

  daysListEl.replaceChildren(...days.map((day) => {
    const total = sumNutrition(allItems(day), productsById);
    const meals = day.meals.filter((m) => m.items.length).length;
    const target = day.targets?.kcal;
    const status = targetStatus('kcal', total.kcal, target);
    const date = parseIso(day.date);

    const content = h('button', { type: 'button', class: 'row day-row', onclick: () => go('day', day.id) },
      h('span', { class: 'tile-date', 'aria-hidden': 'true' },
        h('small', {}, fmtWeekday.format(date).replace('.', '')),
        h('b', {}, String(date.getDate())),
      ),
      h('span', { class: 'row__body' },
        h('span', { class: 'row__title' }, dateTitle(day.date)),
        h('span', { class: 'row__sub' },
          meals
            ? `${meals} ${plural(meals, 'приём', 'приёма', 'приёмов')} · Б ${fmt0.format(total.protein)} · Ж ${fmt0.format(total.fat)} · У ${fmt0.format(total.carbs)}`
            : 'Пусто'),
      ),
      h('span', { class: 'day-row__kcal' },
        h('b', { class: statusClass(status) }, fmt0.format(total.kcal)),
        h('small', {}, target ? `из ${fmt0.format(target)}` : 'ккал'),
      ),
      ring({ value: total.kcal, target, status, size: 34, stroke: 5 }),
    );
    return swipeRow(content, () => deleteDay(day));
  }));
  daysListEl.hidden = days.length === 0;
  daysEmptyEl.hidden = days.length > 0;
}

/** Новый день: цели берутся из последнего дня, один пустой приём */
async function createDay() {
  const days = (await db.all('days')).sort(byDateDesc);
  const now = Date.now();
  const day = {
    date: todayIso(),
    targets: { ...EMPTY_TARGETS, ...days[0]?.targets },
    meals: [{ items: [] }],
    createdAt: now,
    updatedAt: now,
  };
  day.id = await db.put('days', day);
  go('day', day.id);
}

/* ---------- День ---------- */

export async function showDay(id) {
  const [day] = await Promise.all([db.get('days', id), refreshProducts()]);
  if (!day) {
    go('days');
    return false;
  }
  current = day;
  current.targets = { ...EMPTY_TARGETS, ...current.targets };
  if (!current.meals.length) current.meals.push({ items: [] });

  dateEl.value = current.date;
  renderTitle();
  renderMeals();
  renderTotals();
}

function renderTitle() {
  titleEl.textContent = dateTitle(current.date);
  subtitleEl.textContent = capitalize(fmtFull.format(parseIso(current.date)));
}

function openDayActions() {
  actionSheet(null, [
    { label: 'Поделиться днём', onClick: shareDay },
    { label: 'Цели на день', onClick: openTargets },
    { label: 'Копировать на сегодня', onClick: copyDay },
    { label: 'Удалить день', danger: true, onClick: () => deleteDay(current) },
  ]);
}

/** Картинка с меню дня в системное меню «Поделиться» (синхронно — Safari требует жест пользователя) */
function shareDay() {
  const date = capitalize(fmtFull.format(parseIso(current.date)));
  const canvas = renderDayImage({ day: current, productsById, date });
  const file = canvasToFile(canvas, `plate-${current.date}.png`);
  shareFile(file, `Plate · ${date}`);
}

function openTargets() {
  for (const [key, value] of Object.entries(current.targets)) {
    if (targetsForm.elements[key]) targetsForm.elements[key].value = value ? toInput(value) : '';
  }
  targetsDialog.showModal();
}

function renderMeals() {
  mealsEl.replaceChildren(...current.meals.map(renderMeal));
  addMealBtn.hidden = current.meals.length >= MAX_MEALS;
}

function renderMeal(meal, index) {
  const total = h('span', { class: 'section-head__meta' });
  const updateTotal = () => {
    const t = sumNutrition(meal.items, productsById);
    total.textContent = meal.items.length ? `${fmt0.format(t.kcal)} ккал` : '';
  };
  updateTotal();

  return h('section', { class: 'meal' },
    h('div', { class: 'section-head' },
      h('h2', {}, `Приём ${index + 1}`),
      total,
      h('button', {
        type: 'button',
        class: 'section-head__btn',
        'aria-label': `Удалить приём ${index + 1}`,
        onclick: () => removeMeal(index),
      }, icon('trash', 18)),
    ),
    h('ul', { class: 'group group--icons' },
      ...meal.items.map((item, i) => itemRow({
        item,
        product: productsById.get(item.productId),
        onChange: () => {
          updateTotal();
          renderTotals();
          saveSoon();
        },
        onDelete: () => {
          meal.items.splice(i, 1);
          renderMeals();
          renderTotals();
          saveSoon();
        },
      })),
      addRow('Добавить продукт', () => pickFor(meal, index)),
    ),
  );
}

function removeMeal(index) {
  const meal = current.meals[index];
  if (meal.items.length && !confirm(`Удалить приём ${index + 1} вместе с продуктами?`)) return;
  current.meals.splice(index, 1);
  if (!current.meals.length) current.meals.push({ items: [] });
  renderMeals();
  renderTotals();
  saveSoon();
}

/** Подсказка «Осталось / Перебор» по калориям */
function kcalHint(total, target) {
  if (!target) return '';
  const diff = target - total;
  return diff >= 0 ? `Осталось ${fmt0.format(diff)} ккал` : `Перебор ${fmt0.format(-diff)} ккал`;
}

/** Сводка вверху дня и компактная панель внизу */
function renderTotals() {
  const t = sumNutrition(allItems(current), productsById);
  const targets = current.targets;
  const kcalStatus = targetStatus('kcal', t.kcal, targets.kcal);
  const hint = kcalHint(t.kcal, targets.kcal);

  summaryEl.classList.toggle('summary--empty', !targets.kcal);
  summaryEl.replaceChildren(
    ring({
      value: t.kcal,
      target: targets.kcal,
      status: kcalStatus,
      size: 132,
      stroke: 13,
      children: [
        h('span', { class: `summary__kcal ${statusClass(kcalStatus)}` }, fmt0.format(t.kcal)),
        h('span', { class: 'summary__of' }, targets.kcal ? `из ${fmt0.format(targets.kcal)} ккал` : 'ккал'),
      ],
    }),
    h('div', { class: 'summary__macros' }, ...MACROS.map(([key]) => {
      const status = targetStatus(key, t[key], targets[key]);
      return h('div', { class: 'macro' },
        h('div', { class: 'macro__head' },
          h('span', { class: 'macro__name' }, MACRO_NAMES[key]),
          h('span', { class: `macro__val ${statusClass(status)}` },
            fmt0.format(t[key]),
            h('small', {}, targets[key] ? ` / ${fmt0.format(targets[key])} г` : ' г')),
        ),
        bar(t[key], targets[key], key, status),
      );
    })),
    h('div', { class: 'summary__foot' },
      h('span', { class: `summary__hint ${statusClass(kcalStatus)}` }, hint || 'Цели не заданы'),
      h('button', { type: 'button', class: 'summary__goals', onclick: openTargets },
        targets.kcal ? 'Цели' : 'Задать цели', icon('chevronRight', 16)),
    ),
  );

  totalsEl.replaceChildren(h('div', { class: 'totals-bar__inner' },
    ring({ value: t.kcal, target: targets.kcal, status: kcalStatus, size: 40, stroke: 5 }),
    h('div', { class: 'tb__body' },
      h('div', { class: 'tb__main' },
        h('span', { class: `tb__kcal ${statusClass(kcalStatus)}` }, fmt0.format(t.kcal)),
        h('span', { class: 'muted' }, targets.kcal ? `/ ${fmt0.format(targets.kcal)} ккал` : 'ккал'),
        h('span', { class: `tb__hint ${statusClass(kcalStatus)}` }, hint),
      ),
      h('div', { class: 'tb__macros' }, ...MACROS.map(([key, label]) => {
        const status = targetStatus(key, t[key], targets[key]);
        return h('span', { class: statusClass(status) }, `${label} `, h('b', {}, fmt0.format(t[key])),
          targets[key] ? `/${fmt0.format(targets[key])}` : '');
      })),
    ),
  ));
}

/** Копия дня на сегодня: цели и приёмы с граммовками */
async function copyDay() {
  await saveSoon.flush();
  const now = Date.now();
  const copy = {
    date: todayIso(),
    targets: { ...current.targets },
    meals: current.meals.map((m) => ({ items: m.items.map((i) => ({ ...i })) })),
    createdAt: now,
    updatedAt: now,
  };
  copy.id = await db.put('days', copy);
  go('day', copy.id);
}

async function deleteDay(day) {
  if (!confirm(`Удалить день «${dateTitle(day.date)}»?`)) return;
  if (current?.id === day.id) {
    saveSoon.cancel();
    current = null;
  }
  await db.delete('days', day.id);
  go('days');
}

/* ---------- Добавление продуктов и блюд ---------- */

async function pickFor(meal, index) {
  await saveSoon.flush();
  const dishes = await loadDishes();
  openPicker({
    title: `Приём ${index + 1}`,
    dishes,
    dishRow: (dish, onClick) => dishRow(dish, productsById, onClick),
    onProduct: async (product) => {
      await refreshProducts();
      addItems(meal, [newItem(product)]);
    },
    // Блюдо раскладывается на ингредиенты: дальше их граммы меняются как обычно
    onDish: (dish) => addItems(meal, dish.items.filter((i) => productsById.has(i.productId)).map((i) => ({ ...i }))),
  });
}

function addItems(meal, items) {
  meal.items.push(...items);
  const mealIndex = current.meals.indexOf(meal);
  renderMeals();
  renderTotals();
  saveSoon();
  const rows = mealsEl.children[mealIndex]?.querySelectorAll('.swipe');
  rows?.[rows.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
