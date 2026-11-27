<script setup>
/**
 * Search bar as in iOS: the field stays on top while scrolling, ⓧ clears it, "Cancel" leaves
 * the search, scrolling the results hides the keyboard. Below it — a row of section chips:
 * filters while searching, quick jumps to sections otherwise.
 * v-model — the query as typed; chips — [{ id, label, count? }]; active — id of the pressed chip;
 * scrollArea() — element whose touch scrolling hides the keyboard (the page by default).
 */
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { t } from '../js/i18n.js';
import AppIcon from './AppIcon.vue';

const query = defineModel({ type: String, default: '' });
const props = defineProps({
  placeholder: { type: String, default: '' },
  chips: { type: Array, default: () => [] },
  active: { type: String, default: null },
  scrollArea: { type: Function, default: null },
});
const emit = defineEmits(['pick']);

const root = ref(null);
const input = ref(null);
const chipsEl = ref(null);
const focused = ref(false);

function clear() {
  query.value = '';
  input.value.focus();
}

function cancel() {
  query.value = '';
  input.value.blur();
}

// Scrolling the results with a finger hides the keyboard
let startY = null;
const onTouchStart = (e) => { startY = e.touches[0].clientY; };
const onTouchMove = (e) => {
  if (document.activeElement !== input.value || startY === null || root.value.contains(e.target)) return;
  if (Math.abs(e.touches[0].clientY - startY) > 10) input.value.blur();
};
let area = null;
onMounted(() => {
  area = props.scrollArea?.() ?? document;
  area.addEventListener('touchstart', onTouchStart, { passive: true });
  area.addEventListener('touchmove', onTouchMove, { passive: true });
});
onBeforeUnmount(() => {
  area.removeEventListener('touchstart', onTouchStart);
  area.removeEventListener('touchmove', onTouchMove);
});

defineExpose({ root, chipsEl });
</script>

<template>
  <div ref="root" :class="['search-bar', { 'is-active': query || focused }]">
    <div class="search-bar__row">
      <label class="search">
        <AppIcon name="search" :size="18" />
        <input
          ref="input"
          v-model="query"
          type="search"
          :placeholder="placeholder"
          autocomplete="off"
          enterkeyhint="search"
          @focus="focused = true"
          @blur="focused = false"
          @keydown.enter="input.blur()"
        >
        <!-- Buttons keep the focus (and the keyboard) when pressed -->
        <button type="button" class="search__clear" :aria-label="t('search.clear')" :hidden="!query" @pointerdown.prevent @click="clear">
          <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor" /><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="var(--search-clear-x)" stroke-width="2" stroke-linecap="round" /></svg>
        </button>
      </label>
      <button type="button" class="search-cancel link" @pointerdown.prevent @click="cancel">{{ t('action.cancel') }}</button>
    </div>
    <div ref="chipsEl" class="chips" role="toolbar" :aria-label="t('search.sections')" :hidden="chips.length < 2">
      <button
        v-for="chip in chips"
        :key="chip.id"
        type="button"
        class="chip"
        :data-id="chip.id"
        :aria-pressed="String(chip.id === active)"
        @click="emit('pick', chip.id)"
      >
        {{ chip.label }}<span v-if="chip.count != null" class="chip__count">{{ chip.count }}</span>
      </button>
    </div>
  </div>
</template>
