<script setup>
/** Spinner like UIActivityIndicatorView: 8 spokes fading in turn */
defineProps({ size: { type: Number, default: 20 } });
</script>

<template>
  <svg class="spinner" :width="size" :height="size" viewBox="0 0 24 24" aria-hidden="true">
    <line v-for="i in 8" :key="i" x1="12" y1="3" x2="12" y2="7" :transform="`rotate(${(i - 1) * 45} 12 12)`" :opacity="(i / 8).toFixed(3)" />
  </svg>
</template>
