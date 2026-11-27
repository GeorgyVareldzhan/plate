<script setup>
/** Product icon tile: the icon on a background tinted by the product type */
import { productIcon, renderIcon, tileHue } from '../js/icons.js';

defineProps({ product: { type: Object, required: true }, size: { type: String, default: '' } });
</script>

<template>
  <span :class="['tile', size]" :style="`--hue:${tileHue(product)}`" aria-hidden="true">{{ renderIcon(productIcon(product)) }}</span>
</template>
