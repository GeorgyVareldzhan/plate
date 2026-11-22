/** "Days" and "Day" screens: targets, meals, portions and totals */
import { db } from './db.js';
import {
  MACROS, EMPTY_TARGETS, sumNutrition, targetStatus, statusClass, kcalTargets,
} from './calc.js';
import { $, h, fmt0, num, toInput, debounce } from './dom.js';
import { t, locale, macrosLine } from './i18n.js';
import { loadProducts } from './products.js';
import { icon, ring, bar, swipeRow, actionSheet } from './ui.js';
import { itemRow, addRow, newItem } from './itemrow.js';
import { openPicker } from './picker.js';
import { loadDishes, dishRow } from './dishes.js';
import { renderDayImage, canvasToFile, shareFile } from './share.js';
import { go } from './nav.js';

const MAX_MEALS = 10;

const MACRO_NAMES = { protein: 'macro.protein', fat: 'macro.fat', carbs: 'macro.carbs' };

let current = null; // currently open day
let otherDays = []; // the rest of the days — previous days set the calorie target with carry-over
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

/** Flush pending day edits immediately — e.g. before a reload */
export function flushDay() {
  return saveSoon.flush();
}

async function refreshProducts() {
  const products = await loadProducts();
  productsById = new Map(products.map((p) => [p.id, p]));
}

/* ---------- Dates ---------- */

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
// Date formats follow the UI language; created on demand because the language is set at startup
const dateFormat = (options) => new Intl.DateTimeFormat(locale(), options);
const fmtShort = { format: (d) => dateFormat({ weekday: 'short', day: 'numeric', month: 'long' }).format(d) };
const fmtShortYear = { format: (d) => dateFormat({ day: 'numeric', month: 'long', year: 'numeric' }).format(d) };
const fmtFull = { format: (d) => dateFormat({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d) };
const fmtWeekday = { format: (d) => dateFormat({ weekday: 'short' }).format(d) };

function dateTitle(iso) {
  if (iso === todayIso()) return t('day.today');
  if (iso === todayIso(-1)) return t('day.yesterday');
  if (iso === todayIso(1)) return t('day.tomorrow');
  const date = parseIso(iso);
  return capitalize((date.getFullYear() === new Date().getFullYear() ? fmtShort : fmtShortYear).format(date));
}

/** Newest dates first; for equal dates, the later-created first */
const byDateDesc = (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt;

const allItems = (day) => day.meals.flatMap((m) => m.items);

/* ---------- Initialization ---------- */

export function initDays() {
  $('#days-add').addEventListener('click', createDay);
  $('#days-empty-add').addEventListener('click', createDay);

  $('#day-back').addEventListener('click', async () => {
    await saveSoon.flush();
    go('days');
  });
  $('#day-more').addEventListener('click', openDayActions);

  // In desktop browsers a transparent date input doesn't open the calendar by itself
  dateEl.addEventListener('click', () => { try { dateEl.showPicker(); } catch { /* iOS opens it by itself */ } });
  dateEl.addEventListener('change', () => {
    if (!dateEl.value) {
      dateEl.value = current.date;
      return;
    }
    current.date = dateEl.value;
    renderTitle();
    renderTotals();
    saveSoon();
  });

  targetsForm.addEventListener('input', (e) => {
    if (e.target.type === 'checkbox') {
      current.targets[e.target.name] = e.target.checked;
    } else {
      const value = num(e.target.value);
      current.targets[e.target.name] = Number.isFinite(value) && value > 0 ? value : null;
    }
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

  // The bottom totals bar is visible only when the summary has scrolled off screen
  new IntersectionObserver(([entry]) => {
    totalsEl.classList.toggle('is-visible', !entry.isIntersecting && document.body.dataset.view === 'day');
  }, { threshold: 0 }).observe(summaryEl);

  keepTotalsAboveKeyboard();
}

/**
 * On iPhone the keyboard covers fixed elements at the bottom of the screen.
 * Move the totals bar up so the total stays visible while editing grams.
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

/* ---------- Day list ---------- */

export async function showDays() {
  await saveSoon.flush();
  current = null;
  totalsEl.classList.remove('is-visible');
  const [days] = await Promise.all([db.all('days'), refreshProducts()]);
  days.sort(byDateDesc);
  const kcalTarget = kcalTargets(days, productsById);

  daysListEl.replaceChildren(...days.map((day) => {
    const total = sumNutrition(allItems(day), productsById);
    const meals = day.meals.filter((m) => m.items.length).length;
    const { target } = kcalTarget(day);
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
            ? `${t('days.meals', { count: meals })} · ${macrosLine(total, 0)}`
            : t('days.empty')),
      ),
      h('span', { class: 'day-row__kcal' },
        h('b', { class: statusClass(status) }, fmt0.format(total.kcal)),
        h('small', {}, target ? t('days.of', { value: fmt0.format(target) }) : t('unit.kcal')),
      ),
      ring({ value: total.kcal, target, status, size: 34, stroke: 5 }),
    );
    return swipeRow(content, () => deleteDay(day));
  }));
  daysListEl.hidden = days.length === 0;
  daysEmptyEl.hidden = days.length > 0;
}

/** New day: targets are taken from the latest day, with one empty meal */
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

/* ---------- Day ---------- */

export async function showDay(id) {
  const [days] = await Promise.all([db.all('days'), refreshProducts()]);
  const day = days.find((d) => d.id === id);
  if (!day) {
    go('days');
    return false;
  }
  current = day;
  otherDays = days.filter((d) => d !== day);
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
    { label: t('day.share'), onClick: shareDay },
    { label: t('day.targets'), onClick: openTargets },
    { label: t('day.copy'), onClick: copyDay },
    { label: t('day.delete'), danger: true, onClick: () => deleteDay(current) },
  ]);
}

/** Day menu image to the system share sheet (synchronous — Safari requires a user gesture) */
function shareDay() {
  const date = capitalize(fmtFull.format(parseIso(current.date)));
  const canvas = renderDayImage({ day: current, productsById, date, kcalTarget: currentKcalTarget().target });
  const file = canvasToFile(canvas, `plate-${current.date}.png`);
  shareFile(file, `Plate · ${date}`);
}

function openTargets() {
  for (const [key, value] of Object.entries(current.targets)) {
    const field = targetsForm.elements[key];
    if (!field) continue;
    if (field.type === 'checkbox') field.checked = Boolean(value);
    else field.value = value ? toInput(value) : '';
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
    const sum = sumNutrition(meal.items, productsById);
    total.textContent = meal.items.length ? `${fmt0.format(sum.kcal)} ${t('unit.kcal')}` : '';
  };
  updateTotal();

  return h('section', { class: 'meal' },
    h('div', { class: 'section-head' },
      h('h2', {}, t('meal.title', { n: index + 1 })),
      total,
      h('button', {
        type: 'button',
        class: 'section-head__btn',
        'aria-label': t('meal.delete', { n: index + 1 }),
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
      addRow(t('meal.addProduct'), () => pickFor(meal, index)),
    ),
  );
}

function removeMeal(index) {
  const meal = current.meals[index];
  if (meal.items.length && !confirm(t('meal.deleteConfirm', { n: index + 1 }))) return;
  current.meals.splice(index, 1);
  if (!current.meals.length) current.meals.push({ items: [] });
  renderMeals();
  renderTotals();
  saveSoon();
}

/** "Left / Over" calorie hint */
function kcalHint(total, target) {
  if (!target) return '';
  const diff = target - total;
  return diff >= 0 ? t('summary.left', { value: fmt0.format(diff) }) : t('summary.over', { value: fmt0.format(-diff) });
}

/** Calorie target of the open day, with carry-over from the previous days */
const currentKcalTarget = () => kcalTargets([...otherDays, current], productsById)(current);

/** "Target −50 kcal for going over on previous days" — only when the carry is noticeable */
function carryNote(carry) {
  const value = Math.round(Math.abs(carry));
  if (!value) return [];
  return h('p', { class: 'summary__carry' },
    t(carry < 0 ? 'summary.carryMinus' : 'summary.carryPlus', { value: fmt0.format(value) }));
}

/** Summary at the top of the day and compact bar at the bottom */
function renderTotals() {
  const sum = sumNutrition(allItems(current), productsById);
  const kcal = currentKcalTarget();
  const targets = { ...current.targets, kcal: kcal.target };
  const kcalStatus = targetStatus('kcal', sum.kcal, targets.kcal);
  const hint = kcalHint(sum.kcal, targets.kcal);

  summaryEl.classList.toggle('summary--empty', !targets.kcal);
  summaryEl.replaceChildren(
    ring({
      value: sum.kcal,
      target: targets.kcal,
      status: kcalStatus,
      size: 132,
      stroke: 13,
      children: [
        h('span', { class: `summary__kcal ${statusClass(kcalStatus)}` }, fmt0.format(sum.kcal)),
        h('span', { class: 'summary__of' }, targets.kcal ? t('summary.ofKcal', { value: fmt0.format(targets.kcal) }) : t('unit.kcal')),
      ],
    }),
    h('div', { class: 'summary__macros' }, ...MACROS.map(([key]) => {
      const status = targetStatus(key, sum[key], targets[key]);
      return h('div', { class: 'macro' },
        h('div', { class: 'macro__head' },
          h('span', { class: 'macro__name' }, t(MACRO_NAMES[key])),
          h('span', { class: `macro__val ${statusClass(status)}` },
            fmt0.format(sum[key]),
            h('small', {}, targets[key] ? ` / ${fmt0.format(targets[key])} ${t('unit.g')}` : ` ${t('unit.g')}`)),
        ),
        bar(sum[key], targets[key], key, status),
      );
    })),
    ...[carryNote(kcal.carry)].flat(),
    h('div', { class: 'summary__foot' },
      h('span', { class: `summary__hint ${statusClass(kcalStatus)}` }, hint || t('summary.noTargets')),
      h('button', { type: 'button', class: 'summary__goals', onclick: openTargets },
        targets.kcal ? t('summary.targets') : t('summary.setTargets'), icon('chevronRight', 16)),
    ),
  );

  totalsEl.replaceChildren(h('div', { class: 'totals-bar__inner' },
    ring({ value: sum.kcal, target: targets.kcal, status: kcalStatus, size: 40, stroke: 5 }),
    h('div', { class: 'tb__body' },
      h('div', { class: 'tb__main' },
        h('span', { class: `tb__kcal ${statusClass(kcalStatus)}` }, fmt0.format(sum.kcal)),
        h('span', { class: 'muted' }, targets.kcal ? `/ ${fmt0.format(targets.kcal)} ${t('unit.kcal')}` : t('unit.kcal')),
        h('span', { class: `tb__hint ${statusClass(kcalStatus)}` }, hint),
      ),
      h('div', { class: 'tb__macros' }, ...MACROS.map(([key, label]) => {
        const status = targetStatus(key, sum[key], targets[key]);
        return h('span', { class: statusClass(status) }, `${t(label)} `, h('b', {}, fmt0.format(sum[key])),
          targets[key] ? `/${fmt0.format(targets[key])}` : '');
      })),
    ),
  ));
}

/** Copy a day to today: targets and meals with portions */
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
  if (!confirm(t('day.deleteConfirm', { name: dateTitle(day.date) }))) return;
  if (current?.id === day.id) {
    saveSoon.cancel();
    current = null;
  }
  await db.delete('days', day.id);
  go('days');
}

/* ---------- Adding products and dishes ---------- */

async function pickFor(meal, index) {
  await saveSoon.flush();
  const dishes = await loadDishes();
  openPicker({
    title: t('meal.title', { n: index + 1 }),
    dishes,
    dishRow: (dish, onClick) => dishRow(dish, productsById, onClick),
    onProduct: async (product) => {
      await refreshProducts();
      addItems(meal, [newItem(product)]);
    },
    // A dish is expanded into ingredients: their grams can then be edited as usual
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
