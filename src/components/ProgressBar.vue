<script setup>
/** Progress bar; progress — on the way to a "not less than" target, see targetProgress */
import { computed } from 'vue';
import { progressClass, progressStyle } from '../js/ui.js';

const props = defineProps({
  value: { type: Number, required: true },
  target: { type: Number, default: null },
  status: { type: String, default: null },
  progress: { type: Number, default: null },
});
const pct = computed(() => (props.target > 0 ? Math.min(100, (props.value / props.target) * 100) : 0));
</script>

<template>
  <div :class="['bar', progressClass(status, progress)]" :style="progressStyle(progress)"><i :style="`width:${pct}%`" /></div>
</template>
