<script setup>
/** "Day" screen: targets, meals, portions and totals */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRouter } from 'vue-router';
import { db } from '../js/db.js';
import {
  MACROS, EMPTY_TARGETS, sumNutrition, targetStatus, statusClass, kcalTargets, targetProgress, shiftIso,
} from '../js/calc.js';
import { fmt0, fmt1, num, toInput, debounce, signed } from '../js/dom.js';
import { t } from '../js/i18n.js';
import { todayIso, dateTitle, fullDate } from '../js/dates.js';
import { actionSheet, progressClass, progressStyle, reducedMotion } from '../js/ui.js';
import { newItem, keyOf } from '../js/items.js';
import { days, dishes, productsById, remoteTick, registerFlush } from '../js/store.js';
import { goBack } from '../js/router.js';
import { sortableRow, onLongPress } from '../js/reorder.js';
import { renderDayImage, canvasToFile, shareFile } from '../js/share.js';
import { openPicker } from '../js/sheets.js';
import AppIcon from '../components/AppIcon.vue';
import AddRow from '../components/AddRow.vue';
import ItemRow from '../components/ItemRow.vue';
import ProgressBar from '../components/ProgressBar.vue';
import ProgressRing from '../components/ProgressRing.vue';

const props = defineProps({ id: { type: String, required: true } });
const router = useRouter();

const MAX_MEALS = 10;
const MEAL_HOLD_MS = 450;
const COUNT_UP_MS = 800;
const MIN_WEIGHT = 20;
const MAX_WEIGHT = 400;
const MACRO_NAMES = { protein: 'macro.protein', fat: 'macro.fat', carbs: 'macro.carbs' };
const TARGET_FIELDS = [
  { key: 'kcal', label: 'macro.kcal', hint: 'targets.atMost', unit: 'unit.kcal' },
  { key: 'protein', label: 'macro.protein', hint: 'targets.atLeast', unit: 'unit.g' },
  { key: 'fat', label: 'macro.fat', hint: 'targets.atMost', unit: 'unit.g' },
  { key: 'carbs', label: 'macro.carbs', hint: 'targets.atMost', unit: 'unit.g' },
];

const day = ref(null); // working copy of the open day, saved with a delay
const movingMeal = ref(null); // index of the meal shown with up / down arrows
const weightText = ref('');
const updated = ref(new Set()); // keys of items just added or given more grams — highlighted

const mealsEl = ref(null);
const summaryEl = ref(null);
const totalsEl = ref(null);
const targetsDialog = ref(null);
const targetsForm = ref(null);

const allItems = (d) => d.meals.flatMap((m) => m.items);

/* ---------- Loading and saving ---------- */

function load() {
  const d = db.get('days', props.id);
  if (!d) {
    router.replace({ name: 'days' });
    return;
  }
  d.targets = { ...EMPTY_TARGETS, ...d.targets };
  if (!d.meals.length) d.meals.push({ items: [] });
  day.value = d;
  movingMeal.value = null;
  weightText.value = d.weight != null ? toInput(d.weight) : '';
}

const saveSoon = debounce(() => {
  if (!day.value) return;
  day.value.updatedAt = Date.now();
  db.put('days', day.value);
}, 400);

/** After any edit: the summary stops counting up and shows the real totals; the day is saved soon */
function changed() {
  stopCount();
  saveSoon();
}

const unregister = registerFlush(() => saveSoon.flush());
const flushOnHide = () => { if (document.hidden) saveSoon.flush(); };
document.addEventListener('visibilitychange', flushOnHide);
onBeforeRouteLeave(() => saveSoon.flush());
onBeforeRouteUpdate(() => saveSoon.flush());
onBeforeUnmount(() => {
  unregister();
  document.removeEventListener('visibilitychange', flushOnHide);
  cancelAnimationFrame(countUp);
});

/* ---------- Totals ---------- */

/** The rest of the days — previous days set the calorie target with carry-over */
const otherDays = computed(() => days.value.filter((d) => d.id !== day.value?.id));
/** Calorie target of the open day, with carry-over from the previous days */
const kcal = computed(() => kcalTargets([...otherDays.value, day.value], productsById.value)(day.value));
const targets = computed(() => ({ ...day.value.targets, kcal: kcal.value.target }));
const real = computed(() => sumNutrition(allItems(day.value), productsById.value));

// Count-up when a day opens: share of the totals drawn in the summary; hints always use the real ones
const shown = ref(1);
let countUp = 0;

/** Summary fills from zero when a day opens: ring, numbers and bars with their colors on the way */
function animateTotals() {
  cancelAnimationFrame(countUp);
  if (reducedMotion()) { shown.value = 1; return; }
  const start = performance.now();
  const ease = (x) => 1 - (1 - x) ** 3;
  const frame = (now) => {
    const x = Math.min(1, (now - start) / COUNT_UP_MS);
    shown.value = ease(x);
    if (x < 1) countUp = requestAnimationFrame(frame);
  };
  shown.value = 0;
  countUp = requestAnimationFrame(frame);
}

function stopCount() {
  cancelAnimationFrame(countUp);
  shown.value = 1;
}

load();
animateTotals();
watch(() => props.id, () => { load(); animateTotals(); }); // another day in the same screen (a copy)
watch(remoteTick, load); // changed on another device

const sum = computed(() => (shown.value === 1 ? real.value
  : Object.fromEntries(Object.entries(real.value).map(([k, v]) => [k, v * shown.value]))));
const kcalStatus = computed(() => targetStatus('kcal', sum.value.kcal, targets.value.kcal));
const realStatus = computed(() => targetStatus('kcal', real.value.kcal, targets.value.kcal));

/** "Left / Over" calorie hint */
const hint = computed(() => {
  const target = targets.value.kcal;
  if (!target) return '';
  const diff = target - real.value.kcal;
  return diff >= 0 ? t('summary.left', { value: fmt0.format(diff) }) : t('summary.over', { value: fmt0.format(-diff) });
});

const macroRow = (totals, key, unitLabel) => {
  const target = targets.value[key];
  const status = targetStatus(key, totals[key], target);
  const progress = targetProgress(key, totals[key], target);
  return { key, value: totals[key], target, status, progress, cls: progressClass(status, progress), style: progressStyle(progress), label: t(unitLabel) };
};
const summaryMacros = computed(() => MACROS.map(([key]) => macroRow(sum.value, key, MACRO_NAMES[key])));
const barMacros = computed(() => MACROS.map(([key, label]) => macroRow(real.value, key, label)));

/**
 * Carry-over panel: where the change of today's target came from (base → target and one
 * line per source day) and, for past days, where this day's own deviation went.
 */
const carry = computed(() => {
  const k = kcal.value;
  const minus = Math.round(k.carry) ? {
    total: `${signed(Math.round(k.carry))} ${t('unit.kcal')}`,
    rows: k.sources.filter((s) => Math.round(s.share)).map((s) => ({
      date: s.date,
      text: `${dateTitle(s.date)}: ${t('summary.carryOver', { value: fmt0.format(s.deviation) })}`,
      share: signed(Math.round(s.share)),
    })),
    base: fmt0.format(k.base),
    target: fmt0.format(k.target),
    capped: k.capped,
  } : null;
  // A finished day that went over: show where the overage goes
  const overage = Math.round(k.deviation ?? 0);
  let gives = null;
  if (day.value.targets.carryOver && overage > 0 && day.value.date < todayIso()) {
    gives = k.spreadDays
      ? t('summary.givesOver', { count: k.spreadDays, value: fmt0.format(overage), share: signed(-Math.round(overage / k.spreadDays)) })
      : t('summary.weekEndOver', { value: fmt0.format(overage) });
  }
  return { minus, gives };
});

/* The bottom totals bar is visible only when the summary has scrolled off screen */
const totalsVisible = ref(false);
let observer = null;

/**
 * On iPhone the keyboard covers fixed elements at the bottom of the screen.
 * Move the totals bar up so the total stays visible while editing grams.
 */
function keepTotalsAboveKeyboard() {
  const vv = window.visualViewport;
  if (!vv || !totalsEl.value) return;
  const offset = window.innerHeight - vv.height - vv.offsetTop;
  totalsEl.value.style.setProperty('--kb-offset', offset > 1 ? `${-offset}px` : '0px');
}

onMounted(() => {
  observer = new IntersectionObserver(([entry]) => { totalsVisible.value = !entry.isIntersecting; }, { threshold: 0 });
  if (summaryEl.value) observer.observe(summaryEl.value);
  window.visualViewport?.addEventListener('resize', keepTotalsAboveKeyboard);
  window.visualViewport?.addEventListener('scroll', keepTotalsAboveKeyboard);
});
onBeforeUnmount(() => {
  observer.disconnect();
  window.visualViewport?.removeEventListener('resize', keepTotalsAboveKeyboard);
  window.visualViewport?.removeEventListener('scroll', keepTotalsAboveKeyboard);
});

/* ---------- Title, date, weight ---------- */

function onDateClick(e) {
  // In desktop browsers a transparent date input doesn't open the calendar by itself
  try { e.target.showPicker(); } catch { /* iOS opens it by itself */ }
}

function onDateChange(e) {
  if (!e.target.value) {
    e.target.value = day.value.date;
    return;
  }
  day.value.date = e.target.value;
  changed();
}

/** Morning weight of the day; empty or out of range — not set */
function onWeightInput(e) {
  const value = num(e.target.value);
  if (Number.isFinite(value) && value >= MIN_WEIGHT && value <= MAX_WEIGHT) day.value.weight = Math.round(value * 10) / 10;
  else delete day.value.weight;
  saveSoon();
}

/**
 * The morning weight shows how the previous day went: the change since the previous morning.
 * Shown only when the previous calendar day has a weight too.
 */
const weightNote = computed(() => {
  const previous = otherDays.value.find((d) => d.date === shiftIso(day.value.date, -1) && d.weight != null);
  if (day.value.weight == null || !previous) return null;
  const delta = Math.round((day.value.weight - previous.weight) * 10) / 10;
  return {
    cls: delta < 0 ? 'is-ok' : delta > 0 ? 'is-bad' : '',
    text: t('day.weightDelta', { value: `${delta < 0 ? '−' : delta > 0 ? '+' : ''}${fmt1.format(Math.abs(delta))}` }),
  };
});

/* ---------- Day actions ---------- */

async function back() {
  await saveSoon.flush();
  goBack('days');
}

function openDayActions() {
  actionSheet(null, [
    { label: t('day.share'), onClick: shareDay },
    { label: t('day.targets'), onClick: openTargets },
    { label: t('day.copy'), onClick: copyDay },
    { label: t('day.delete'), danger: true, onClick: deleteDay },
  ]);
}

/** Day menu image to the system share sheet (synchronous — Safari requires a user gesture) */
function shareDay() {
  const date = fullDate(day.value.date);
  const canvas = renderDayImage({ day: day.value, productsById: productsById.value, date, kcalTarget: kcal.value.target });
  const file = canvasToFile(canvas, `plate-${day.value.date}.png`);
  shareFile(file, `Plate · ${date}`);
}

/** Copy a day to today: targets and meals with portions */
async function copyDay() {
  await saveSoon.flush();
  const now = Date.now();
  const id = db.put('days', {
    date: todayIso(),
    targets: { ...day.value.targets },
    meals: day.value.meals.map((m) => ({ items: m.items.map((i) => ({ ...i })) })),
    createdAt: now,
    updatedAt: now,
  });
  router.replace({ name: 'day', params: { id } });
}

function deleteDay() {
  if (!confirm(t('day.deleteConfirm', { name: dateTitle(day.value.date) }))) return;
  saveSoon.cancel();
  db.delete('days', day.value.id);
  goBack('days');
}

/* ---------- Targets ---------- */

function openTargets() {
  const form = targetsForm.value;
  for (const [key, value] of Object.entries(day.value.targets)) {
    const field = form.elements[key];
    if (!field) continue;
    if (field.type === 'checkbox') field.checked = Boolean(value);
    else field.value = value ? toInput(value) : '';
  }
  targetsDialog.value.showModal();
}

function onTargetInput(e) {
  if (e.target.type === 'checkbox') {
    day.value.targets[e.target.name] = e.target.checked;
  } else {
    const value = num(e.target.value);
    day.value.targets[e.target.name] = Number.isFinite(value) && value > 0 ? value : null;
  }
  changed();
}

/* ---------- Meals ---------- */

const mealKcal = (meal) => sumNutrition(meal.items, productsById.value).kcal;

async function addMeal() {
  if (day.value.meals.length >= MAX_MEALS) return;
  day.value.meals.push({ items: [] });
  saveSoon();
  await nextTick();
  mealsEl.value.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function removeMeal(index) {
  const meal = day.value.meals[index];
  if (meal.items.length && !confirm(t('meal.deleteConfirm', { n: index + 1 }))) return;
  day.value.meals.splice(index, 1);
  if (!day.value.meals.length) day.value.meals.push({ items: [] });
  if (movingMeal.value !== null && movingMeal.value >= day.value.meals.length) movingMeal.value = null;
  changed();
}

function removeItem(meal, index) {
  meal.items.splice(index, 1);
  changed();
}

/** Long press on a meal header shows up / down arrows; a tap anywhere else hides them */
function startMovingMeal(index) {
  if (day.value.meals.length < 2) return;
  movingMeal.value = index;
  const outside = (e) => {
    if (e.target.closest('.section-head.is-moving')) return;
    document.removeEventListener('pointerdown', outside, true);
    movingMeal.value = null;
  };
  document.addEventListener('pointerdown', outside, true);
}

/** Swap the meal with its neighbour; sections slide to their new places */
async function moveMeal(index, dir) {
  const meals = day.value.meals;
  const to = index + dir;
  if (!meals[to]) return;
  const sections = () => [...mealsEl.value.children];
  const before = new Map(meals.map((m, i) => [toRaw(m), sections()[i].getBoundingClientRect().top]));
  [meals[index], meals[to]] = [meals[to], meals[index]];
  movingMeal.value = to;
  saveSoon();
  await nextTick();
  meals.forEach((m, i) => {
    const el = sections()[i];
    const dy = before.get(toRaw(m)) - el.getBoundingClientRect().top;
    if (dy) el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 220, easing: 'ease-out' });
  });
  sections()[to].querySelector('.section-head').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/** Meal headers: long press starts moving the meal */
const vMealHold = {
  mounted(el, binding) {
    el.hold = binding.value;
    onLongPress(el, MEAL_HOLD_MS, () => el.hold(), { ignore: 'button' });
  },
  updated(el, binding) { el.hold = binding.value; },
};

/** Product rows can be dragged within a meal and to another meal */
const vSortable = {
  mounted(el) {
    sortableRow(el, {
      lists: () => [...mealsEl.value.querySelectorAll('.meal > .group')],
      onDrop: ({ fromList, fromIndex, toList, toIndex }) => {
        const meals = day.value.meals;
        const [item] = meals[fromList].items.splice(fromIndex, 1);
        meals[toList].items.splice(toIndex, 0, item);
        changed();
      },
    });
  },
};

/* ---------- Adding products and dishes ---------- */

async function pickFor(meal, index) {
  await saveSoon.flush();
  openPicker({
    title: t('meal.title', { n: index + 1 }),
    dishes: dishes.value,
    onProduct: (product) => addItems(meal, [newItem(product)]),
    // A dish is expanded into ingredients: their grams can then be edited as usual.
    // Ingredients already in the meal get the grams added, so a dish added twice doubles its portions.
    onDish: (dish) => addItems(meal, dish.items.filter((i) => productsById.value.has(i.productId)).map((i) => ({ ...i })), { merge: true }),
  });
}

/**
 * Add items to a meal. merge — an item whose product is already in the meal adds its grams to
 * that row (keeping the row's unit) instead of becoming a second row.
 */
async function addItems(meal, items, { merge = false } = {}) {
  const touched = [];
  for (const item of items) {
    const existing = merge ? meal.items.find((i) => i.productId === item.productId) : null;
    if (existing) {
      existing.grams = Math.round((existing.grams + item.grams) * 10) / 10;
      touched.push(existing);
    } else {
      meal.items.push(item);
      touched.push(meal.items.at(-1));
    }
  }
  changed();
  // Highlight the rows that were added or got more grams, and scroll to the last of them
  updated.value = new Set();
  await nextTick();
  const mealIndex = day.value.meals.indexOf(meal);
  const rows = mealsEl.value.children[mealIndex]?.querySelectorAll('.swipe');
  const last = Math.max(...touched.map((item) => meal.items.indexOf(item)));
  rows?.[last]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  requestAnimationFrame(() => { updated.value = new Set(touched.map(keyOf)); });
}
</script>

<template>
  <section v-if="day" id="view-day" class="view">
    <header class="navbar">
      <button id="day-back" type="button" class="nav-back" @click="back">
        <AppIcon name="chevronLeft" :size="22" />
        <span>{{ t('days.title') }}</span>
      </button>
      <button id="day-more" type="button" class="nav-icon" :aria-label="t('day.actions')" @click="openDayActions">
        <AppIcon name="more" :size="24" />
      </button>
    </header>

    <!-- Tapping the title opens the date picker: a transparent date input sits on top -->
    <div class="date-title">
      <h1 id="day-title" class="large-title">{{ dateTitle(day.date) }}</h1>
      <p id="day-subtitle" class="date-title__sub">{{ fullDate(day.date) }}</p>
      <input id="day-date" type="date" class="date-title__input" :value="day.date" :aria-label="t('day.date')" @click="onDateClick" @change="onDateChange">
    </div>

    <section id="day-summary" ref="summaryEl" :class="['card', 'summary', { 'summary--empty': !targets.kcal, 'is-counting': shown < 1 }]" aria-live="polite">
      <ProgressRing :value="sum.kcal" :target="targets.kcal" :status="kcalStatus" :size="132" :stroke="13">
        <span :class="['summary__kcal', statusClass(kcalStatus)]">{{ fmt0.format(sum.kcal) }}</span>
        <span class="summary__of">{{ targets.kcal ? t('summary.ofKcal', { value: fmt0.format(targets.kcal) }) : t('unit.kcal') }}</span>
      </ProgressRing>
      <div class="summary__macros">
        <div v-for="m in summaryMacros" :key="m.key" class="macro">
          <div class="macro__head">
            <span class="macro__name">{{ m.label }}</span>
            <span :class="['macro__val', m.cls]" :style="m.style">{{ fmt0.format(m.value) }}<small>{{ m.target ? ` / ${fmt0.format(m.target)} ${t('unit.g')}` : ` ${t('unit.g')}` }}</small></span>
          </div>
          <ProgressBar :value="m.value" :target="m.target" :status="m.status" :progress="m.progress" />
        </div>
      </div>
      <div v-if="carry.minus" class="carry carry--minus">
        <div class="carry__head">
          <span class="carry__title">{{ t('summary.carryTitle') }}</span>
          <b class="carry__total">{{ carry.minus.total }}</b>
        </div>
        <div v-for="row in carry.minus.rows" :key="row.date" class="carry__row">
          <span>{{ row.text }}</span>
          <span class="carry__num">{{ row.share }}</span>
        </div>
        <div class="carry__row carry__sum">
          <span>{{ t('macro.kcal') }}</span>
          <span class="carry__num"><s>{{ carry.minus.base }}</s>{{ ' → ' }}<b>{{ carry.minus.target }}</b></span>
        </div>
        <div v-if="carry.minus.capped" class="carry__note">{{ t('summary.carryCapped') }}</div>
      </div>
      <div v-if="carry.gives" class="carry carry--gives">
        <div class="carry__row"><span>{{ carry.gives }}</span></div>
      </div>
      <div class="summary__foot">
        <span :class="['summary__hint', statusClass(realStatus)]">{{ hint || t('summary.noTargets') }}</span>
        <button type="button" class="summary__goals" @click="openTargets">
          {{ targets.kcal ? t('summary.targets') : t('summary.setTargets') }}<AppIcon name="chevronRight" :size="16" />
        </button>
      </div>
    </section>

    <ul class="group group--form weight">
      <li class="form-row">
        <label class="form-row__label" for="day-weight">{{ t('day.weight') }}</label>
        <span class="form-row__input"><input id="day-weight" v-model="weightText" type="text" inputmode="decimal" autocomplete="off" placeholder="—" @input="onWeightInput"><em>{{ t('unit.kg') }}</em></span>
      </li>
    </ul>
    <p v-if="weightNote" id="day-weight-note" class="footnote"><b :class="weightNote.cls">{{ weightNote.text }}</b>{{ ` ${t('day.weightDeltaNote')}` }}</p>

    <div id="day-meals" ref="mealsEl">
      <section v-for="(meal, index) in day.meals" :key="keyOf(meal)" class="meal">
        <div v-meal-hold="() => startMovingMeal(index)" :class="['section-head', { 'is-moving': movingMeal === index }]">
          <h2>{{ t('meal.title', { n: index + 1 }) }}</h2>
          <span class="section-head__meta">{{ meal.items.length ? `${fmt0.format(mealKcal(meal))} ${t('unit.kcal')}` : '' }}</span>
          <template v-if="movingMeal === index">
            <button type="button" class="section-head__btn section-head__btn--move" :aria-label="t('meal.moveUp')" :disabled="!day.meals[index - 1]" @click="moveMeal(index, -1)">
              <AppIcon name="arrowUp" :size="20" />
            </button>
            <button type="button" class="section-head__btn section-head__btn--move" :aria-label="t('meal.moveDown')" :disabled="!day.meals[index + 1]" @click="moveMeal(index, 1)">
              <AppIcon name="arrowDown" :size="20" />
            </button>
          </template>
          <button v-else type="button" class="section-head__btn" :aria-label="t('meal.delete', { n: index + 1 })" @click="removeMeal(index)">
            <AppIcon name="trash" :size="18" />
          </button>
        </div>
        <ul class="group group--icons">
          <ItemRow
            v-for="(item, i) in meal.items"
            :key="keyOf(item)"
            v-sortable
            :item="item"
            :product="productsById.get(item.productId)"
            :highlight="updated.has(keyOf(item))"
            @change="changed"
            @delete="removeItem(meal, i)"
          />
          <AddRow :label="t('meal.addProduct')" @add="pickFor(meal, index)" />
        </ul>
      </section>
    </div>

    <button v-if="day.meals.length < MAX_MEALS" id="day-add-meal" type="button" class="btn btn--tinted btn--block" @click="addMeal">
      <AppIcon name="plus" :size="20" />
      <span>{{ t('day.addMeal') }}</span>
    </button>

    <!-- Compact totals: appear when the summary scrolls off screen; outside the screen so the swipe back moves it along -->
    <Teleport to="body">
      <div id="day-totals" ref="totalsEl" :class="['totals-bar', { 'is-visible': totalsVisible }]">
        <div class="totals-bar__inner">
          <ProgressRing :value="real.kcal" :target="targets.kcal" :status="realStatus" :size="40" :stroke="5" />
          <div class="tb__body">
            <div class="tb__main">
              <span :class="['tb__kcal', statusClass(realStatus)]">{{ fmt0.format(real.kcal) }}</span>
              <span class="muted">{{ targets.kcal ? `/ ${fmt0.format(targets.kcal)} ${t('unit.kcal')}` : t('unit.kcal') }}</span>
              <span :class="['tb__hint', statusClass(realStatus)]">{{ hint }}</span>
            </div>
            <div class="tb__macros">
              <span v-for="m in barMacros" :key="m.key" :class="m.cls" :style="m.style">{{ `${m.label} ` }}<b>{{ fmt0.format(m.value) }}</b>{{ m.target ? `/${fmt0.format(m.target)}` : '' }}</span>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Daily targets -->
    <dialog id="targets-dialog" ref="targetsDialog" autofocus tabindex="-1" class="sheet">
      <form id="targets-form" ref="targetsForm" novalidate @submit.prevent="targetsDialog.close()" @input="onTargetInput">
        <div class="sheet__head">
          <span />
          <strong>{{ t('day.targets') }}</strong>
          <button type="submit" class="link link--bold">{{ t('action.done') }}</button>
        </div>
        <div class="sheet__body">
          <ul class="group group--form">
            <li v-for="f in TARGET_FIELDS" :key="f.key" class="form-row">
              <span class="form-row__label"><span>{{ t(f.label) }}</span> <small>{{ t(f.hint) }}</small></span>
              <span class="form-row__input"><input :name="f.key" type="text" inputmode="numeric" autocomplete="off" placeholder="—"><em>{{ t(f.unit) }}</em></span>
            </li>
          </ul>
          <ul class="group group--form group--spaced">
            <li class="form-row">
              <label class="form-row__label" for="targets-carry">{{ t('targets.carry') }}</label>
              <input id="targets-carry" name="carryOver" type="checkbox" class="switch">
            </li>
          </ul>
          <p class="footnote">{{ t('targets.carryNote') }}</p>
          <p class="footnote">{{ t('targets.note') }}</p>
        </div>
      </form>
    </dialog>
  </section>
</template>
