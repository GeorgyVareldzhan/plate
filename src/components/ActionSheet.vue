<script setup>
/** Bottom action sheet opened with actionSheet() from ui.js */
import { nextTick, ref, watch } from 'vue';
import { t } from '../js/i18n.js';
import { actionSheetState } from '../js/ui.js';

const dialog = ref(null);

watch(actionSheetState, async (state) => {
  if (!state) return;
  await nextTick();
  if (actionSheetState.value === state && !dialog.value.open) dialog.value.showModal();
});

function close() {
  dialog.value?.close();
  actionSheetState.value = null;
}

function run(action) {
  close();
  action.onClick(); // may open another sheet: it gets a new dialog element (see the key)
}

// Closed by Escape. The 'close' event comes later than close(): ignore it from a replaced sheet
function onClose(e) {
  if (e.target === dialog.value && !dialog.value.open) actionSheetState.value = null;
}
</script>

<template>
  <dialog
    v-if="actionSheetState"
    :key="actionSheetState.id"
    ref="dialog"
    class="action-sheet"
    autofocus
    tabindex="-1"
    @click.self="close"
    @close="onClose"
  >
    <div class="action-sheet__group">
      <div v-if="actionSheetState.title" class="action-sheet__title">{{ actionSheetState.title }}</div>
      <button v-for="action in actionSheetState.actions" :key="action.label" type="button" :class="action.danger ? 'is-danger' : ''" @click="run(action)">{{ action.label }}</button>
    </div>
    <button type="button" class="action-sheet__cancel" @click="close">{{ t('action.cancel') }}</button>
  </dialog>
</template>
