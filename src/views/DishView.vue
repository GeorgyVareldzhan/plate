<script setup>
/** Dish editor: name, ingredients with portions, totals */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRouter } from 'vue-router';
import { db } from '../js/db.js';
import { sumNutrition } from '../js/calc.js';
import { fmt0, fmt1, debounce } from '../js/dom.js';
import { t } from '../js/i18n.js';
import { dishName } from '../js/dishes.js';
import { actionSheet } from '../js/ui.js';
import { newItem, keyOf } from '../js/items.js';
import { productsById, remoteTick, registerFlush } from '../js/store.js';
import { goBack } from '../js/router.js';
import { sortableRow } from '../js/reorder.js';
import { openPicker } from '../js/sheets.js';
import AppIcon from '../components/AppIcon.vue';
import AddRow from '../components/AddRow.vue';
import ItemRow from '../components/ItemRow.vue';

const props = defineProps({ id: { type: String, required: true } });
const router = useRouter();

const dish = ref(null); // working copy of the open dish, saved with a delay
const nameInput = ref(null);
const itemsEl = ref(null);

function load() {
  const d = db.get('dishes', props.id);
  if (!d) {
    router.replace({ name: 'dishes' });
    return;
  }
  dish.value = d;
}

const saveSoon = debounce(() => {
  if (!dish.value) return;
  dish.value.updatedAt = Date.now();
  // The dish was modified in the app — starter list updates no longer touch it
  delete dish.value.seed;
  db.put('dishes', dish.value);
}, 400);

load();
watch(() => props.id, load);
watch(remoteTick, load); // changed on another device

const unregister = registerFlush(() => saveSoon.flush());
const flushOnHide = () => { if (document.hidden) saveSoon.flush(); };
document.addEventListener('visibilitychange', flushOnHide);
onBeforeRouteLeave(() => saveSoon.flush());
onBeforeRouteUpdate(() => saveSoon.flush());
onBeforeUnmount(() => {
  unregister();
  document.removeEventListener('visibilitychange', flushOnHide);
});

// A new dish: start with its name
onMounted(async () => {
  if (dish.value && !dish.value.name && !dish.value.items.length) {
    await nextTick();
    nameInput.value?.focus();
  }
});

const sum = computed(() => sumNutrition(dish.value.items, productsById.value));
const grams = computed(() => dish.value.items.reduce((total, i) => total + i.grams, 0));

async function back() {
  await saveSoon.flush();
  goBack('dishes');
}

function openActions() {
  actionSheet(null, [{ label: t('dish.delete'), danger: true, onClick: deleteDish }]);
}

function deleteDish() {
  if (!confirm(t('dish.deleteConfirm', { name: dishName(dish.value) }))) return;
  saveSoon.cancel();
  db.delete('dishes', dish.value.id);
  goBack('dishes');
}

function removeItem(index) {
  dish.value.items.splice(index, 1);
  saveSoon();
}

function addIngredient() {
  openPicker({
    title: t('picker.ingredient'),
    onProduct: (product) => {
      dish.value.items.push(newItem(product));
      saveSoon();
    },
  });
}

/** Ingredient rows can be dragged to change their order */
const vSortable = {
  mounted(el) {
    sortableRow(el, {
      lists: () => [itemsEl.value],
      onDrop: ({ fromIndex, toIndex }) => {
        const [item] = dish.value.items.splice(fromIndex, 1);
        dish.value.items.splice(toIndex, 0, item);
        saveSoon();
      },
    });
  },
};
</script>

<template>
  <section v-if="dish" id="view-dish" class="view">
    <header class="navbar">
      <button id="dish-back" type="button" class="nav-back" @click="back">
        <AppIcon name="chevronLeft" :size="22" />
        <span>{{ t('dishes.title') }}</span>
      </button>
      <button id="dish-more" type="button" class="nav-icon" :aria-label="t('dish.actions')" @click="openActions">
        <AppIcon name="more" :size="24" />
      </button>
    </header>

    <input
      id="dish-name"
      ref="nameInput"
      v-model="dish.name"
      class="title-input"
      type="text"
      maxlength="60"
      :placeholder="t('dish.name')"
      :aria-label="t('dish.name')"
      autocomplete="off"
      enterkeyhint="done"
      @input="saveSoon()"
      @keydown.enter="$event.target.blur()"
    >

    <section id="dish-summary" class="card dish-summary" aria-live="polite">
      <div class="dish-summary__main">
        <span class="dish-summary__kcal">{{ fmt0.format(sum.kcal) }}</span>
        <span class="muted">{{ ` ${t('unit.kcal')} · ${fmt0.format(grams)} ${t('unit.g')}` }}</span>
      </div>
      <div class="dish-summary__macros">
        <div v-for="key in ['protein', 'fat', 'carbs']" :key="key" :class="['dish-macro', `dish-macro--${key}`]">
          <b>{{ fmt1.format(sum[key]) }}</b>
          <span>{{ t('dish.macroUnit', { name: t(`macro.${key}`) }) }}</span>
        </div>
      </div>
    </section>

    <p class="group-title">{{ t('dish.ingredients') }}</p>
    <ul id="dish-items" ref="itemsEl" class="group group--icons">
      <ItemRow
        v-for="(item, index) in dish.items"
        :key="keyOf(item)"
        v-sortable
        :item="item"
        :product="productsById.get(item.productId)"
        @change="saveSoon()"
        @delete="removeItem(index)"
      />
      <AddRow :label="t('dish.addIngredient')" @add="addIngredient" />
    </ul>
  </section>
</template>
