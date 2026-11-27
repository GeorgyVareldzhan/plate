<script>
/* One open row at a time; a tap anywhere else closes it */
let openRow = null;
document.addEventListener('pointerdown', (e) => {
  if (openRow && !openRow.el().contains(e.target)) openRow.close();
}, true);
</script>

<script setup>
/**
 * Swipe left to delete (as in iOS): a list row with a "Delete" button beneath its content.
 * The content element is `tag`; class and listeners given to the component go to it.
 * A swipe doesn't start on inputs or controls (stepper, segmented control).
 */
import { onBeforeUnmount, ref } from 'vue';
import { t } from '../js/i18n.js';
import { isDragging } from '../js/reorder.js';

defineOptions({ inheritAttrs: false });
defineProps({
  tag: { type: String, default: 'div' },
  label: { type: String, default: null },
  rowClass: { type: String, default: '' },
  highlight: { type: Boolean, default: false }, // flash the row (added or changed)
});
const emit = defineEmits(['delete']);

const ACTION_WIDTH = 88;

const row = ref(null);
const content = ref(null);
const isOpen = ref(false);
const revealed = ref(false); // the button shows only while the row is shifted — otherwise it may show through on press

const contentEl = () => content.value?.$el ?? content.value;

function move(x, animate) {
  const el = contentEl();
  if (x) revealed.value = true;
  el.style.transition = animate ? 'transform .28s cubic-bezier(.2,.8,.2,1)' : 'none';
  el.style.transform = x ? `translateX(${x}px)` : '';
  if (!x && !animate) revealed.value = false;
}

const api = {
  el: () => row.value,
  close() {
    move(0, true);
    isOpen.value = false;
    if (openRow === api) openRow = null;
  },
  open() {
    if (openRow && openRow !== api) openRow.close();
    move(-ACTION_WIDTH, true);
    isOpen.value = true;
    openRow = api;
  },
};
onBeforeUnmount(() => { if (openRow === api) openRow = null; });

function onTransitionEnd() {
  if (!contentEl().style.transform) revealed.value = false;
}

let startX = 0;
let startY = 0;
let dx = 0;
let base = 0;
let tracking = false;
let horizontal = false;
let pointerId = null;

function onPointerDown(e) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (e.target.closest('input, .stepper, .units')) return;
  startX = e.clientX;
  startY = e.clientY;
  dx = 0;
  base = isOpen.value ? -ACTION_WIDTH : 0;
  tracking = true;
  horizontal = false;
  pointerId = e.pointerId;
}

function onPointerMove(e) {
  if (!tracking || e.pointerId !== pointerId) return;
  if (isDragging()) { tracking = false; return; }
  const mx = e.clientX - startX;
  const my = e.clientY - startY;
  if (!horizontal) {
    if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
    if (Math.abs(my) > Math.abs(mx)) {
      tracking = false; // vertical scroll — not our gesture
      return;
    }
    horizontal = true;
    contentEl().setPointerCapture?.(pointerId);
  }
  dx = mx;
  let x = Math.min(0, base + dx);
  if (x < -ACTION_WIDTH) x = -ACTION_WIDTH + (x + ACTION_WIDTH) / 3; // rubber-band effect
  move(x, false);
}

function onPointerEnd() {
  if (!tracking) return;
  tracking = false;
  if (!horizontal) return;
  if (base + dx < -ACTION_WIDTH / 2) api.open();
  else api.close();
  // After a swipe, don't treat lifting the finger as a tap on the row
  const el = contentEl();
  const swallow = (ev) => { ev.stopImmediatePropagation(); ev.preventDefault(); };
  el.addEventListener('click', swallow, { capture: true, once: true });
  setTimeout(() => el.removeEventListener('click', swallow, { capture: true }), 0);
}

defineExpose({ close: () => api.close() });
</script>

<template>
  <li ref="row" :class="['swipe', rowClass, { 'is-open': isOpen, 'is-revealed': revealed, 'is-updated': highlight }]">
    <div class="swipe__actions">
      <button type="button" class="swipe__delete" @click="emit('delete')">{{ label ?? t('action.delete') }}</button>
    </div>
    <component
      :is="tag"
      ref="content"
      v-bind="$attrs"
      :type="tag === 'button' ? 'button' : undefined"
      class="swipe__content"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerEnd"
      @pointercancel="onPointerEnd"
      @transitionend="onTransitionEnd"
    >
      <slot />
    </component>
  </li>
</template>
