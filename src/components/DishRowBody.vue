<script setup>
/** Inside of a dish row: icon, name, ingredients, calories (the row element is the parent's) */
import { computed } from 'vue';
import { sumNutrition } from '../js/calc.js';
import { fmt0 } from '../js/dom.js';
import { t } from '../js/i18n.js';
import { dishName, compositionLine } from '../js/dishes.js';
import { productsById } from '../js/store.js';
import IconTile from './IconTile.vue';
import HighlightText from './HighlightText.vue';

const props = defineProps({ dish: { type: Object, required: true }, ranges: { type: Array, default: null } });
const total = computed(() => sumNutrition(props.dish.items, productsById.value));
</script>

<template>
  <IconTile :product="{ name: dish.name, icon: dish.icon }" />
  <span class="row__body">
    <span class="row__title"><HighlightText v-if="dish.name" :text="dishName(dish)" :ranges="ranges" /><template v-else>{{ dishName(dish) }}</template></span>
    <span class="row__sub">{{ compositionLine(dish, productsById) }}</span>
  </span>
  <span class="row__value">{{ fmt0.format(total.kcal) }} {{ t('unit.kcal') }}</span>
</template>
