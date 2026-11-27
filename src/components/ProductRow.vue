<script setup>
/**
 * Product row: icon, name, macros, calories. section — the section the row is shown in (a brand's
 * name is dropped there); note — extra text before the macros; ranges — search matches in the name.
 */
import { computed } from 'vue';
import { fmt0 } from '../js/dom.js';
import { t, macrosLine } from '../js/i18n.js';
import { nameInSection } from '../js/products.js';
import AppIcon from './AppIcon.vue';
import IconTile from './IconTile.vue';
import HighlightText from './HighlightText.vue';

const props = defineProps({
  product: { type: Object, required: true },
  section: { type: String, default: null },
  note: { type: String, default: null },
  ranges: { type: Array, default: null },
  chevron: { type: Boolean, default: false },
});
defineEmits(['pick']);

const title = computed(() => nameInSection(props.product.name, props.section));
// Ranges are positions in the full name; the title may have the brand cut off
const titleRanges = computed(() => {
  const offset = props.product.name.length - title.value.length;
  return props.ranges?.map(([s, e]) => [s - offset, e - offset]) ?? null;
});
const sub = computed(() => {
  const { product, note } = props;
  const piece = product.pieceGrams
    ? ` · ${t('products.piece', { pcs: t('unit.pcs'), grams: fmt0.format(product.pieceGrams), g: t('unit.g') })}`
    : '';
  return note ? `${note} · ${macrosLine(product)}${piece}` : macrosLine(product) + piece;
});
</script>

<template>
  <li>
    <button type="button" class="row" @click="$emit('pick', product)">
      <IconTile :product="product" />
      <span class="row__body">
        <span class="row__title"><HighlightText :text="title" :ranges="titleRanges" /></span>
        <span class="row__sub">{{ sub }}</span>
      </span>
      <span class="row__value">{{ fmt0.format(product.kcal) }} {{ t('unit.kcal') }}</span>
      <AppIcon v-if="chevron" name="chevronRight" :size="18" class="row__chevron" />
    </button>
  </li>
</template>
