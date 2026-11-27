<script setup>
/**
 * Product row with quantity: icon, name, portion calories, macros, stepper "− 150 g +"
 * and "g | pcs" toggle. The same row is used in meals and in dish ingredients.
 * item — { productId, grams, unit }, a reactive object of the parent, changed in place; emits change after any change of
 * quantity or unit, delete — "Delete" swipe.
 */
import { computed, onMounted, ref } from 'vue';
import { portion } from '../js/calc.js';
import { fmt0, fmt1, num } from '../js/dom.js';
import { t } from '../js/i18n.js';
import { MAX_GRAMS, amountForInput, steppedAmount } from '../js/items.js';
import AppIcon from './AppIcon.vue';
import IconTile from './IconTile.vue';
import SwipeRow from './SwipeRow.vue';

const props = defineProps({
  item: { type: Object, required: true },
  product: { type: Object, default: null },
  highlight: { type: Boolean, default: false },
});
const emit = defineEmits(['change', 'delete']);

const pieceGrams = computed(() => (props.product?.pieceGrams > 0 ? props.product.pieceGrams : null));
if (!pieceGrams.value && props.item.unit !== 'g') props.item.unit = 'g';

const nutrition = computed(() => (props.product ? portion(props.product, props.item.grams) : null));
const subParts = computed(() => {
  const p = nutrition.value;
  const parts = [
    `${t('macro.p')} ${fmt1.format(p.protein)}`,
    `${t('macro.f')} ${fmt1.format(p.fat)}`,
    `${t('macro.c')} ${fmt1.format(p.carbs)}`,
  ];
  if (props.item.unit === 'pcs') parts.unshift(`${fmt0.format(props.item.grams)} ${t('unit.g')}`);
  return parts;
});

// The input is not bound to the grams: typing "12," must not be rewritten to "12"
const input = ref(null);
const showAmount = () => { input.value.value = amountForInput(props.item, pieceGrams.value); };
onMounted(showAmount);

/** Set the quantity in the current unit */
function setAmount(amount) {
  const value = Number.isFinite(amount) && amount > 0 ? amount : 0;
  props.item.grams = Math.min(MAX_GRAMS, props.item.unit === 'pcs' ? value * pieceGrams.value : value);
  emit('change');
}

function step(direction) {
  setAmount(steppedAmount(props.item, pieceGrams.value, direction));
  showAmount();
}

/** "g | pcs" toggle — only for products with a piece weight set */
function setUnit(unit) {
  if (props.item.unit === unit) return;
  props.item.unit = unit;
  showAmount();
  emit('change');
}

function onFocus() {
  setTimeout(() => input.value?.select(), 0);
}
</script>

<template>
  <SwipeRow class="item" :highlight="highlight" @delete="emit('delete')">
    <IconTile :product="product ?? { name: '' }" />
    <div class="item__head">
      <span class="item__title">{{ product?.name ?? t('product.unknown') }}</span>
      <span class="item__kcal"><template v-if="nutrition">{{ fmt0.format(nutrition.kcal) }}<small>{{ ` ${t('unit.kcal')}` }}</small></template></span>
    </div>
    <div class="item__line">
      <span class="item__sub">
        <template v-if="nutrition">
          <!-- Keep each value whole: line breaks only between them -->
          <template v-for="(text, i) in subParts" :key="i">{{ i ? ' · ' : '' }}<span class="nowrap">{{ text }}</span></template>
        </template>
        <template v-else>{{ t('product.deleted') }}</template>
      </span>
      <div class="item__controls">
        <div class="stepper">
          <button type="button" :aria-label="t('item.decrease')" @click="step(-1)"><AppIcon name="minus" :size="18" /></button>
          <input
            ref="input"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            enterkeyhint="done"
            :aria-label="item.unit === 'pcs' ? t('item.amountPcs') : t('item.amountG')"
            @focus="onFocus"
            @input="setAmount(num($event.target.value))"
            @keydown.enter="$event.target.blur()"
          >
          <span class="stepper__unit">{{ item.unit === 'pcs' ? t('unit.pcs') : t('unit.g') }}</span>
          <button type="button" :aria-label="t('item.increase')" @click="step(1)"><AppIcon name="plus" :size="18" /></button>
        </div>
        <div v-if="pieceGrams" class="units" role="group" :aria-label="t('item.units')">
          <button type="button" data-unit="g" :aria-pressed="String(item.unit === 'g')" @click="setUnit('g')">{{ t('unit.g') }}</button>
          <button type="button" data-unit="pcs" :aria-pressed="String(item.unit === 'pcs')" @click="setUnit('pcs')">{{ t('unit.pcs') }} · {{ fmt0.format(pieceGrams) }} {{ t('unit.g') }}</button>
        </div>
      </div>
    </div>
  </SwipeRow>
</template>
