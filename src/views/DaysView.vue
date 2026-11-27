<script>
// Calories each day's ring showed last time: back from a day, only the changed rings move
let shownKcal = new Map();
</script>

<script setup>
/** "Days" screen: days grouped by week with totals against the targets */
import { onActivated, onDeactivated, onMounted, ref, shallowRef, watch } from 'vue';
import { useRouter } from 'vue-router';
import { db, revision } from '../js/db.js';
import {
  MACROS, EMPTY_TARGETS, sumNutrition, targetStatus, statusClass, kcalTargets, targetProgress, weekStart, shiftIso,
} from '../js/calc.js';
import { fmt0, signed } from '../js/dom.js';
import { t, macrosLine } from '../js/i18n.js';
import { todayIso, parseIso, dateFormat, dateTitle, fmtWeekday } from '../js/dates.js';
import { progressClass, progressStyle } from '../js/ui.js';
import { productsById } from '../js/store.js';
import { syncState } from '../js/account.js';
import { previousRoute } from '../js/router.js';
import { screenEls } from '../js/backswipe.js';
import { openAccount } from '../js/sheets.js';
import AppIcon from '../components/AppIcon.vue';
import ProgressRing from '../components/ProgressRing.vue';
import SwipeRow from '../components/SwipeRow.vue';

defineOptions({ name: 'DaysView' });

const router = useRouter();
const root = ref(null);
const weeks = shallowRef([]);
const empty = ref(false);
const intro = ref(0); // bumped to replay the rings filling from zero

/** Newest dates first; for equal dates, the later-created first */
const byDateDesc = (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt;
const allItems = (day) => day.meals.flatMap((m) => m.items);
/** Average of the numbers, or null for an empty list */
const average = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

/** Rebuild the list. fromZero — rings fill from 0 (the list appears), otherwise only changed rings move */
function refresh(fromZero) {
  const days = db.all('days').sort(byDateDesc);
  const byId = productsById.value;
  const kcalTarget = kcalTargets(days, byId);
  const shown = new Map();

  const dayRow = (day) => {
    const total = sumNutrition(allItems(day), byId);
    const meals = day.meals.filter((m) => m.items.length).length;
    const { target, carry } = kcalTarget(day);
    const date = parseIso(day.date);
    shown.set(day.id, total.kcal);
    return {
      day,
      total,
      target,
      carry: Math.round(carry),
      status: targetStatus('kcal', total.kcal, target),
      weekday: fmtWeekday.format(date).replace('.', ''),
      dayOfMonth: String(date.getDate()),
      title: dateTitle(day.date),
      sub: meals ? `${t('days.meals', { count: meals })} · ${macrosLine(total, 0)}` : t('days.empty'),
      from: fromZero ? 0 : (shownKcal.get(day.id) ?? 0),
    };
  };

  // Days grouped by week (Monday to Sunday), latest week first
  const groups = [];
  for (const day of days) {
    const start = weekStart(day.date);
    if (groups.at(-1)?.start !== start) groups.push({ start, days: [] });
    groups.at(-1).days.push(day);
  }
  weeks.value = groups.map((week) => ({ start: week.start, head: weekHead(week, kcalTarget, byId), rows: week.days.map(dayRow) }));
  empty.value = days.length === 0;
  shownKcal = shown;
  if (fromZero) intro.value += 1;
}

/**
 * Week header: date range, daily averages over days with products — compared with the average
 * of their targets — and the week's calorie balance against the targets.
 */
function weekHead(week, kcalTarget, byId) {
  const range = dateFormat({ day: 'numeric', month: 'long' })
    .formatRange(parseIso(week.start), parseIso(shiftIso(week.start, 6)));
  const filled = week.days.filter((d) => allItems(d).length).map((day) => ({
    total: sumNutrition(allItems(day), byId),
    targets: { ...day.targets, kcal: kcalTarget(day).target },
  }));
  if (!filled.length) return { range, balance: null, stats: null };

  let balance = null;
  const withTarget = filled.filter((d) => d.targets.kcal > 0);
  if (withTarget.length) {
    const value = Math.round(withTarget.reduce((sum, d) => sum + d.total.kcal - d.targets.kcal, 0));
    balance = { text: `${value ? signed(value) : '0'} ${t('unit.kcal')}`, cls: value > 0 ? 'is-bad' : 'is-ok' };
  }

  const value = (key) => {
    const avg = average(filled.map((d) => d.total[key]));
    const target = average(filled.map((d) => d.targets[key]).filter((v) => v > 0));
    const progress = targetProgress(key, avg, target);
    return { text: fmt0.format(avg), target, cls: progressClass(targetStatus(key, avg, target), progress), style: progressStyle(progress) };
  };
  const kcal = value('kcal');
  return {
    range,
    balance,
    stats: {
      kcal,
      kcalTail: `${kcal.target ? ` ${t('days.of', { value: fmt0.format(kcal.target) })}` : ''} ${t('unit.kcal')}`,
      macros: MACROS.map(([key, label]) => ({ key, label: t(label), ...value(key) })),
    },
  };
}

let active = false;
onActivated(() => {
  active = true;
  // Rings fill from 0 when the list appears; back from a day only changed days move
  refresh(previousRoute.value !== 'day');
});
onDeactivated(() => { active = false; });
watch(revision, () => { if (active) refresh(false); });
onMounted(() => { screenEls.days = root.value; });

/** New day: targets are taken from the latest day, with one empty meal */
function createDay() {
  const days = db.all('days').sort(byDateDesc);
  const now = Date.now();
  const day = {
    date: todayIso(),
    targets: { ...EMPTY_TARGETS, ...days[0]?.targets },
    meals: [{ items: [] }],
    createdAt: now,
    updatedAt: now,
  };
  const id = db.put('days', day);
  router.push({ name: 'day', params: { id } });
}

function deleteDay(day) {
  if (!confirm(t('day.deleteConfirm', { name: dateTitle(day.date) }))) return;
  db.delete('days', day.id);
}
</script>

<template>
  <section id="view-days" ref="root" class="view">
    <header class="navbar">
      <div class="brand">
        <img class="brand__logo" src="icons/logo.svg" alt="" width="30" height="30">
        <span class="brand__name">Plate</span>
      </div>
      <span class="navbar__actions">
        <button
          id="account-btn"
          type="button"
          :class="['nav-icon', 'account-btn', { 'has-pending': syncState.pending > 0 }]"
          :aria-label="t('account.title')"
          @click="openAccount"
        >
          <AppIcon name="account" :size="24" />
        </button>
        <button id="days-add" type="button" class="nav-icon" :aria-label="t('days.new')" @click="createDay">
          <AppIcon name="plus" :size="24" />
        </button>
      </span>
    </header>
    <h1 class="large-title">{{ t('days.title') }}</h1>

    <div id="days-list" :hidden="empty">
      <section v-for="week in weeks" :key="week.start" class="week">
        <div class="week-head">
          <div class="week-head__top">
            <span class="week-head__title">{{ week.head.range }}</span>
            <span v-if="week.head.balance" :class="['week-head__over', week.head.balance.cls]">{{ week.head.balance.text }}</span>
          </div>
          <div v-if="week.head.stats" class="week-head__stats">
            {{ `${t('days.weekAverage')} ` }}<b :class="week.head.stats.kcal.cls">{{ week.head.stats.kcal.text }}</b>{{ week.head.stats.kcalTail }}<template
              v-for="m in week.head.stats.macros"
              :key="m.key"
            >{{ ` · ${m.label} ` }}<b :class="m.cls" :style="m.style">{{ m.text }}</b></template>
          </div>
        </div>
        <ul class="group">
          <SwipeRow
            v-for="row in week.rows"
            :key="row.day.id"
            tag="button"
            class="row day-row"
            @click="router.push({ name: 'day', params: { id: row.day.id } })"
            @delete="deleteDay(row.day)"
          >
            <span class="tile-date" aria-hidden="true">
              <small>{{ row.weekday }}</small>
              <b>{{ row.dayOfMonth }}</b>
            </span>
            <span class="row__body">
              <span class="row__title">{{ row.title }}</span>
              <span class="row__sub">{{ row.sub }}</span>
            </span>
            <span class="day-row__kcal">
              <b :class="statusClass(row.status)">{{ fmt0.format(row.total.kcal) }}</b>
              <small>{{ row.target ? t('days.of', { value: fmt0.format(row.target) }) : t('unit.kcal') }}<span v-if="row.carry" class="carry-badge">{{ signed(row.carry) }}</span></small>
            </span>
            <ProgressRing
              :key="`${intro}-${Math.round(row.total.kcal)}-${row.target}`"
              :value="row.total.kcal"
              :target="row.target"
              :status="row.status"
              :size="34"
              :stroke="5"
              :from="row.from"
            />
          </SwipeRow>
        </ul>
      </section>
    </div>
    <div id="days-empty" class="empty-state" :hidden="!empty">
      <img class="empty-state__logo" src="icons/logo.svg" alt="" width="96" height="96">
      <p class="empty-state__title">{{ t('days.welcome.title') }}</p>
      <p class="empty-state__text">{{ t('days.welcome.text') }}</p>
      <button id="days-empty-add" type="button" class="btn btn--filled" @click="createDay">{{ t('days.welcome.button') }}</button>
    </div>
  </section>
</template>
