<script setup>
/** Line icon in SF Symbols style; size in px */
import { ICON_PATHS } from '../js/ui.js';

defineProps({ name: { type: String, required: true }, size: { type: Number, default: 20 } });
</script>

<template>
  <svg class="icon" :width="size" :height="size" viewBox="0 0 24 24" aria-hidden="true"><path :d="ICON_PATHS[name]" /></svg>
</template>
