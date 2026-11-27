<script setup>
/**
 * Ring like in Apple Fitness: value as a fraction of target.
 * status — 'ok' | 'bad' | null (no target set — neutral color).
 * from — value to animate from when the ring appears (e.g. 0 when a list appears); later
 * changes of the value animate by the CSS transition.
 */
import { computed, onMounted, ref, watch } from 'vue';
import { statusClass } from '../js/calc.js';
import { reducedMotion } from '../js/ui.js';

const props = defineProps({
  value: { type: Number, required: true },
  target: { type: Number, default: null },
  status: { type: String, default: null },
  size: { type: Number, default: 120 },
  stroke: { type: Number, default: 12 },
  from: { type: Number, default: null },
});

const r = computed(() => (props.size - props.stroke) / 2);
const c = computed(() => 2 * Math.PI * r.value);
const center = computed(() => props.size / 2);
const share = (v) => (props.target > 0 ? Math.min(1, Math.max(0, v / props.target)) : 0);
const offset = (v) => (c.value * (1 - share(v))).toFixed(2);

const intro = props.from != null && share(props.from) !== share(props.value) && !reducedMotion();
const drawn = ref(intro ? props.from : props.value);

onMounted(() => {
  // Two frames: the start position must be painted before the transition can run
  if (intro) requestAnimationFrame(() => requestAnimationFrame(() => { drawn.value = props.value; }));
});
watch(() => props.value, (value) => { drawn.value = value; });
</script>

<template>
  <div :class="['ring', statusClass(status)]" :style="`--size:${size}px`">
    <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`" aria-hidden="true">
      <circle class="ring__track" :cx="center" :cy="center" :r="r" :stroke-width="stroke" />
      <circle
        :class="['ring__value', { 'ring__value--intro': intro }]"
        :cx="center"
        :cy="center"
        :r="r"
        :stroke-width="stroke"
        :stroke-dasharray="c.toFixed(2)"
        :style="{ strokeDashoffset: `${offset(drawn)}px` }"
        :transform="`rotate(-90 ${center} ${center})`"
        :opacity="share(drawn) > 0 ? 1 : 0"
      />
    </svg>
    <div v-if="$slots.default" class="ring__center"><slot /></div>
  </div>
</template>
