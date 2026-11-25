/** "Days" and "Day" screens: targets, meals, portions and totals */
import { db } from './db.js';
import {
  MACROS, EMPTY_TARGETS, sumNutrition, targetStatus, statusClass, kcalTargets, targetProgress, weekStart, shiftIso,
} from './calc.js';
import { $, h, fmt0, num, toInput, debounce } from './dom.js';
import { t, locale, macrosLine } from './i18n.js';
import { loadProducts } from './products.js';
import { icon, ring, bar, swipeRow, actionSheet, progressClass, progressStyle } from './ui.js';
import { itemRow, addRow, newItem } from './itemrow.js';
import { openPicker } from './picker.js';
import { loadDishes, dishRow } from './dishes.js';
import { renderDayImage, canvasToFile, shareFile } from './share.js';
import { go } from './nav.js';
import { sortableRow, onLongPress } from './reorder.js';

const MAX_MEALS = 10;

const MACRO_NAMES = { protein: 'macro.protein', fat: 'macro.fat', carbs: 'macro.carbs' };

let current = null; // currently open day
let otherDays = []; // the rest of the days — previous days set the calorie target with carry-over
let productsById = new Map();
let movingMeal = null; // index of the meal shown with up / down arrows

const MEAL_HOLD_MS = 450;

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

  const dayRow = (day) => {
    const total = sumNutrition(allItems(day), productsById);
    const meals = day.meals.filter((m) => m.items.length).length;
    const { target, carry } = kcalTarget(day);
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
        h('small', {}, target ? t('days.of', { value: fmt0.format(target) }) : t('unit.kcal'),
          Math.round(carry) ? h('span', { class: 'carry-badge' }, signed(Math.round(carry))) : null),
      ),
      ring({ value: total.kcal, target, status, size: 34, stroke: 5 }),
    );
    return swipeRow(content, () => deleteDay(day));
  };

  // Days grouped by week (Monday to Sunday), latest week first
  const weeks = [];
  for (const day of days) {
    const start = weekStart(day.date);
    if (weeks.at(-1)?.start !== start) weeks.push({ start, days: [] });
    weeks.at(-1).days.push(day);
  }
  daysListEl.replaceChildren(...weeks.map((week) => h('section', { class: 'week' },
    weekHead(week, kcalTarget),
    h('ul', { class: 'group' }, ...week.days.map(dayRow)),
  )));
  daysListEl.hidden = days.length === 0;
  daysEmptyEl.hidden = days.length > 0;
}

/** Average of the numbers, or null for an empty list */
const average = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

/**
 * Week header: date range, daily averages over days with products — compared with the average
 * of their targets — and the week's calorie balance against the targets.
 */
function weekHead(week, kcalTarget) {
  const range = dateFormat({ day: 'numeric', month: 'long' })
    .formatRange(parseIso(week.start), parseIso(shiftIso(week.start, 6)));
  const filled = week.days.filter((d) => allItems(d).length).map((day) => ({
    total: sumNutrition(allItems(day), productsById),
    targets: { ...day.targets, kcal: kcalTarget(day).target },
  }));
  const top = h('div', { class: 'week-head__top' }, h('span', { class: 'week-head__title' }, range));
  if (!filled.length) return h('div', { class: 'week-head' }, top);

  const withTarget = filled.filter((d) => d.targets.kcal > 0);
  if (withTarget.length) {
    const balance = Math.round(withTarget.reduce((sum, d) => sum + d.total.kcal - d.targets.kcal, 0));
    top.append(h('span', { class: `week-head__over ${balance > 0 ? 'is-bad' : 'is-ok'}` },
      `${balance ? signed(balance) : '0'} ${t('unit.kcal')}`));
  }

  const value = (key) => {
    const avg = average(filled.map((d) => d.total[key]));
    const target = average(filled.map((d) => d.targets[key]).filter((v) => v > 0));
    const progress = targetProgress(key, avg, target);
    return { avg, target, cls: progressClass(targetStatus(key, avg, target), progress), style: progressStyle(progress) };
  };
  const kcal = value('kcal');
  const stats = h('div', { class: 'week-head__stats' },
    `${t('days.weekAverage')} `,
    h('b', { class: kcal.cls }, fmt0.format(kcal.avg)),
    kcal.target ? ` ${t('days.of', { value: fmt0.format(kcal.target) })}` : '',
    ` ${t('unit.kcal')}`,
    ...MACROS.flatMap(([key, label]) => {
      const v = value(key);
      return [` · ${t(label)} `, h('b', { class: v.cls, style: v.style }, fmt0.format(v.avg))];
    }),
  );
  return h('div', { class: 'week-head' }, top, stats);
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
  movingMeal = null;
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
  if (movingMeal !== null && movingMeal >= current.meals.length) movingMeal = null;
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

  const moving = movingMeal === index;
  const arrow = (dir) => h('button', {
    type: 'button',
    class: 'section-head__btn section-head__btn--move',
    'aria-label': t(dir < 0 ? 'meal.moveUp' : 'meal.moveDown'),
    disabled: !current.meals[index + dir],
    onclick: () => moveMeal(index, dir),
  }, icon(dir < 0 ? 'arrowUp' : 'arrowDown', 20));
  const head = h('div', { class: `section-head${moving ? ' is-moving' : ''}` },
    h('h2', {}, t('meal.title', { n: index + 1 })),
    total,
    ...(moving ? [arrow(-1), arrow(1)] : [h('button', {
      type: 'button',
      class: 'section-head__btn',
      'aria-label': t('meal.delete', { n: index + 1 }),
      onclick: () => removeMeal(index),
    }, icon('trash', 18))]),
  );
  if (current.meals.length > 1) onLongPress(head, MEAL_HOLD_MS, () => startMovingMeal(index), { ignore: 'button' });

  return h('section', { class: 'meal' },
    head,
    h('ul', { class: 'group group--icons' },
      ...meal.items.map((item, i) => sortItem(itemRow({
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
      }))),
      addRow(t('meal.addProduct'), () => pickFor(meal, index)),
    ),
  );
}

/** Product rows can be dragged within a meal and to another meal */
function sortItem(row) {
  sortableRow(row, {
    lists: () => [...mealsEl.querySelectorAll('.meal > .group')],
    onDrop: ({ fromList, fromIndex, toList, toIndex }) => {
      const [item] = current.meals[fromList].items.splice(fromIndex, 1);
      current.meals[toList].items.splice(toIndex, 0, item);
      renderMeals();
      renderTotals();
      saveSoon();
    },
  });
  return row;
}

/** Long press on a meal header shows up / down arrows; a tap anywhere else hides them */
function startMovingMeal(index) {
  movingMeal = index;
  renderMeals();
  const outside = (e) => {
    if (e.target.closest('.section-head.is-moving')) return;
    document.removeEventListener('pointerdown', outside, true);
    if (movingMeal === null) return;
    movingMeal = null;
    renderMeals();
  };
  document.addEventListener('pointerdown', outside, true);
}

/** Swap the meal with its neighbour; sections slide to their new places */
function moveMeal(index, dir) {
  const to = index + dir;
  if (!current.meals[to]) return;
  const before = new Map(current.meals.map((m, i) => [m, mealsEl.children[i].getBoundingClientRect().top]));
  [current.meals[index], current.meals[to]] = [current.meals[to], current.meals[index]];
  movingMeal = to;
  renderMeals();
  current.meals.forEach((m, i) => {
    const el = mealsEl.children[i];
    const dy = before.get(m) - el.getBoundingClientRect().top;
    if (dy) el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 220, easing: 'ease-out' });
  });
  mealsEl.children[to].querySelector('.section-head').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  saveSoon();
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

/** Signed whole kilocalories: "−50", "+25" */
const signed = (value) => `${value < 0 ? '−' : '+'}${fmt0.format(Math.abs(value))}`;

/**
 * Carry-over panel: where the change of today's target came from (base → target and one
 * line per source day) and, for past days, where this day's own deviation went.
 */
function carryPanel(kcal) {
  const blocks = [];
  if (Math.round(kcal.carry)) {
    blocks.push(h('div', { class: 'carry carry--minus' },
      h('div', { class: 'carry__head' },
        h('span', { class: 'carry__title' }, t('summary.carryTitle')),
        h('b', { class: 'carry__total' }, `${signed(Math.round(kcal.carry))} ${t('unit.kcal')}`),
      ),
      ...kcal.sources.filter((s) => Math.round(s.share)).map((s) => h('div', { class: 'carry__row' },
        h('span', {}, `${dateTitle(s.date)}: `, t('summary.carryOver', { value: fmt0.format(s.deviation) })),
        h('span', { class: 'carry__num' }, signed(Math.round(s.share))),
      )),
      h('div', { class: 'carry__row carry__sum' },
        h('span', {}, t('macro.kcal')),
        h('span', { class: 'carry__num' },
          h('s', {}, fmt0.format(kcal.base)), ' → ', h('b', {}, fmt0.format(kcal.target))),
      ),
      kcal.capped && h('div', { class: 'carry__note' }, t('summary.carryCapped')),
    ));
  }
  // A finished day that went over: show where the overage goes
  const overage = Math.round(kcal.deviation ?? 0);
  if (current.targets.carryOver && overage > 0 && current.date < todayIso()) {
    const text = kcal.spreadDays
      ? t('summary.givesOver', {
        count: kcal.spreadDays,
        value: fmt0.format(overage),
        share: signed(-Math.round(overage / kcal.spreadDays)),
      })
      : t('summary.weekEndOver', { value: fmt0.format(overage) });
    blocks.push(h('div', { class: 'carry carry--gives' }, h('div', { class: 'carry__row' }, h('span', {}, text))));
  }
  return blocks;
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
      const progress = targetProgress(key, sum[key], targets[key]);
      return h('div', { class: 'macro' },
        h('div', { class: 'macro__head' },
          h('span', { class: 'macro__name' }, t(MACRO_NAMES[key])),
          h('span', { class: `macro__val ${progressClass(status, progress)}`, style: progressStyle(progress) },
            fmt0.format(sum[key]),
            h('small', {}, targets[key] ? ` / ${fmt0.format(targets[key])} ${t('unit.g')}` : ` ${t('unit.g')}`)),
        ),
        bar(sum[key], targets[key], status, progress),
      );
    })),
    ...carryPanel(kcal),
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
        const progress = targetProgress(key, sum[key], targets[key]);
        return h('span', { class: progressClass(status, progress), style: progressStyle(progress) }, `${t(label)} `, h('b', {}, fmt0.format(sum[key])),
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
    dishRow: (dish, onClick, ranges) => dishRow(dish, productsById, onClick, { ranges }),
    onProduct: async (product) => {
      await refreshProducts();
      addItems(meal, [newItem(product)]);
    },
    // A dish is expanded into ingredients: their grams can then be edited as usual.
    // Ingredients already in the meal get the grams added, so a dish added twice doubles its portions.
    onDish: (dish) => addItems(meal, dish.items.filter((i) => productsById.has(i.productId)).map((i) => ({ ...i })), { merge: true }),
  });
}

/**
 * Add items to a meal. merge — an item whose product is already in the meal adds its grams to
 * that row (keeping the row's unit) instead of becoming a second row.
 */
function addItems(meal, items, { merge = false } = {}) {
  const touched = new Set();
  for (const item of items) {
    const existing = merge ? meal.items.find((i) => i.productId === item.productId) : null;
    if (existing) {
      existing.grams = Math.round((existing.grams + item.grams) * 10) / 10;
      touched.add(meal.items.indexOf(existing));
    } else {
      meal.items.push(item);
      touched.add(meal.items.length - 1);
    }
  }
  const mealIndex = current.meals.indexOf(meal);
  renderMeals();
  renderTotals();
  saveSoon();
  const rows = mealsEl.children[mealIndex]?.querySelectorAll('.swipe');
  if (!rows) return;
  // Highlight the rows that were added or got more grams
  for (const index of touched) rows[index]?.classList.add('is-updated');
  rows[Math.max(...touched)]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
