<script setup>
/** Product card: view a catalog product, edit or create one's own; nutrition from a label photo or text */
import { computed, nextTick, onMounted, reactive, ref, shallowRef } from 'vue';
import { db } from '../js/db.js';
import { toInput } from '../js/dom.js';
import { t } from '../js/i18n.js';
import { ICONS, ICON_GROUPS } from '../js/icons.js';
import { actionSheet } from '../js/ui.js';
import { PRODUCT_FIELDS, MACRO_KEYS, kcalFromMacros, readProduct, deleteProduct } from '../js/products.js';
import { parseLabel, parseLabelCandidates } from '../js/label.js';
import { readLabelPhoto, releaseOcr } from '../js/ocr.js';
import { sheets } from '../js/sheets.js';
import IconTile from './IconTile.vue';
import AppSpinner from './AppSpinner.vue';

const MACRO_NAMES = { kcal: 'macro.kcal', protein: 'macro.protein', fat: 'macro.fat', carbs: 'macro.carbs' };

const dialog = ref(null);
const nameInput = ref(null);
const photoInput = ref(null);

const values = reactive(Object.fromEntries(PRODUCT_FIELDS.map((key) => [key, ''])));
const editing = shallowRef(null);
const chosenIcon = ref(null); // null — icon is matched by name
const iconsOpen = ref(false);
const error = ref('');
const status = ref(null); // { text, bad, busy } under the nutrition fields
const reading = ref(false);
const pasted = ref(new Set()); // fields just filled from a label — highlighted

// Catalog products are shared and edited only by the admin — the card is read-only
const readOnly = computed(() => Boolean(editing.value?.catalog));
const kcalHint = computed(() => String(kcalFromMacros(values)));

let result = null;
let resolveDialog = null;
let openedWith = ''; // form state when the card opened — to tell if anything changed
const formState = () => JSON.stringify([values, chosenIcon.value]);

function open(product, prefill) {
  editing.value = product;
  result = null;
  chosenIcon.value = product?.icon && ICONS[product.icon] ? product.icon : null;
  const source = product || prefill;
  for (const key of PRODUCT_FIELDS) {
    const value = source[key];
    values[key] = value == null ? '' : key === 'name' ? value : toInput(value);
  }
  iconsOpen.value = false;
  error.value = '';
  status.value = null;
  pasted.value = new Set();
  openedWith = product?.catalog ? null : formState();
  dialog.value.showModal();
  if (!product && !source.name) setTimeout(() => nameInput.value?.focus(), 50);
  return new Promise((resolve) => { resolveDialog = resolve; });
}

onMounted(() => {
  sheets.product = open;
  // Pulled down with unsaved changes: ask before throwing them away
  dialog.value.beforeSwipeClose = () => openedWith === null || formState() === openedWith || confirm(t('product.discardConfirm'));
});

function onClose() {
  releaseOcr();
  resolveDialog?.(result);
  resolveDialog = null;
}

function save() {
  const data = readProduct(values, chosenIcon.value);
  if (typeof data === 'string') {
    error.value = data;
    return;
  }
  if (editing.value) data.id = editing.value.id;
  data.id = db.put('products', data);
  result = data;
  dialog.value.close();
}

function remove() {
  if (!deleteProduct(editing.value)) return;
  result = { deleted: true };
  dialog.value.close();
}

/* ---------- From a label ---------- */

function chooseLabelSource() {
  actionSheet(null, [
    // The file picker must open within the tap, so the sheet's handler clicks the input directly
    { label: t('product.labelPhoto'), onClick: () => photoInput.value.click() },
    { label: t('product.labelPaste'), onClick: pasteFromLabel },
  ]);
}

/** Label text from the clipboard; if reading is not allowed, ask to paste it */
async function readLabelText() {
  try {
    const text = await navigator.clipboard.readText();
    if (text.trim()) return text;
  } catch { /* denied or unsupported — fall back to a prompt */ }
  return prompt(t('product.pastePrompt')) ?? '';
}

/** Fill calories and macros from label text copied from a photo (iOS Live Text) */
async function pasteFromLabel() {
  const text = await readLabelText();
  if (!text.trim()) return;
  fillFromLabel(parseLabel(text), 'product.pasteNothing');
}

async function onPhoto(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (file) await photoFromLabel(file);
}

/** Recognize a label photo on the device and fill the fields */
async function photoFromLabel(file) {
  reading.value = true;
  try {
    const found = await readLabelPhoto(file, parseLabelCandidates, ({ stage, percent }) => {
      status.value = { text: t(stage === 'loading' ? 'product.ocrLoading' : 'product.ocrReading', { percent }), busy: true };
    });
    if (dialog.value.open) fillFromLabel(found, 'product.photoNothing');
  } catch (err) {
    console.error(err);
    status.value = { text: t('product.ocrFailed'), bad: true };
  } finally {
    reading.value = false;
  }
}

/** Put the values found on a label into the form and highlight them */
async function fillFromLabel(found, nothingKey) {
  const keys = ['kcal', ...MACRO_KEYS].filter((key) => found[key] != null);
  if (!keys.length) {
    status.value = { text: t(nothingKey), bad: true };
    return;
  }
  for (const key of keys) values[key] = toInput(found[key]);
  status.value = { text: t('product.pasteFilled', { fields: keys.map((key) => t(MACRO_NAMES[key]).toLowerCase()).join(', ') }) };
  // Restart the highlight: drop it, let a frame pass, set it again
  pasted.value = new Set();
  await nextTick();
  requestAnimationFrame(() => requestAnimationFrame(() => { pasted.value = new Set(keys); }));
}
</script>

<template>
  <dialog id="product-dialog" ref="dialog" autofocus tabindex="-1" class="sheet" @close="onClose">
    <form id="product-form" novalidate @submit.prevent="save">
      <div class="sheet__head">
        <button type="button" class="link" @click="dialog.close()">{{ t(readOnly ? 'action.close' : 'action.cancel') }}</button>
        <strong>{{ editing ? t('product.title') : t('product.new') }}</strong>
        <button v-if="!readOnly" type="submit" class="link link--bold">{{ t('action.done') }}</button>
        <span v-else />
      </div>

      <div class="sheet__body">
        <div class="product-hero">
          <button
            type="button"
            class="product-hero__icon"
            :aria-label="t('product.chooseIcon')"
            :aria-expanded="String(iconsOpen)"
            :disabled="readOnly"
            @click="iconsOpen = !iconsOpen"
          >
            <IconTile :product="{ name: values.name, icon: chosenIcon }" size="tile--lg" />
          </button>
          <span v-if="!readOnly" class="product-hero__hint">{{ t('product.iconHint') }}</span>
        </div>
        <div v-if="iconsOpen" class="icon-grid" role="listbox" :aria-label="t('product.icons')">
          <button
            type="button"
            class="icon-grid__auto"
            role="option"
            :title="t('product.iconAutoTitle')"
            :aria-selected="String(chosenIcon === null)"
            @click="chosenIcon = null"
          >
            {{ t('product.iconAuto') }}
          </button>
          <!-- Grid by section: the section title spans the full row -->
          <template v-for="[title, icons] in ICON_GROUPS" :key="title">
            <p class="icon-grid__title">{{ t(`iconGroup.${title}`) }}</p>
            <button
              v-for="(emoji, key) in icons"
              :key="key"
              type="button"
              role="option"
              :data-icon="key"
              :aria-label="key"
              :aria-selected="String(chosenIcon === key)"
              @click="chosenIcon = key"
            >
              {{ emoji }}
            </button>
          </template>
        </div>
        <p v-if="readOnly" id="product-catalog-note" class="footnote">{{ t('product.catalogNote') }}</p>

        <ul class="group group--form">
          <li class="form-row">
            <input
              ref="nameInput"
              v-model="values.name"
              name="name"
              class="form-row__full"
              type="text"
              maxlength="80"
              autocomplete="off"
              :placeholder="t('product.name')"
              :aria-label="t('product.name')"
              :disabled="readOnly"
            >
          </li>
        </ul>

        <div class="group-title group-title--action">
          <span>{{ t('product.per100') }}</span>
          <button v-if="!readOnly" type="button" class="group-title__btn" :disabled="reading" @click="chooseLabelSource">{{ t('product.fromLabel') }}</button>
          <input id="product-photo" ref="photoInput" type="file" accept="image/*" hidden @change="onPhoto">
        </div>
        <ul class="group group--form">
          <li :class="['form-row', { 'is-pasted': pasted.has('kcal') }]">
            <span class="form-row__label">{{ t('macro.kcal') }}</span>
            <span class="form-row__input"><input v-model="values.kcal" name="kcal" type="text" inputmode="decimal" autocomplete="off" :placeholder="kcalHint" :disabled="readOnly"><em>{{ t('unit.kcal') }}</em></span>
          </li>
          <li v-for="key in MACRO_KEYS" :key="key" :class="['form-row', { 'is-pasted': pasted.has(key) }]">
            <span class="form-row__label"><span>{{ t(MACRO_NAMES[key]) }}</span></span>
            <span class="form-row__input"><input v-model="values[key]" :name="key" type="text" inputmode="decimal" autocomplete="off" placeholder="0" :disabled="readOnly"><em>{{ t('unit.g') }}</em></span>
          </li>
        </ul>
        <p v-if="status" id="product-paste-status" :class="['footnote', 'paste-status', { 'is-bad': status.bad, 'is-busy': status.busy }]" role="status">
          <AppSpinner v-if="status.busy" :size="16" />{{ status.text }}
        </p>
        <p class="footnote">{{ t('product.kcalNote') }}</p>

        <ul class="group group--form">
          <li class="form-row">
            <span class="form-row__label">{{ t('product.pieceWeight') }}</span>
            <span class="form-row__input"><input v-model="values.pieceGrams" name="pieceGrams" type="text" inputmode="decimal" autocomplete="off" :placeholder="t('product.pieceNone')" :disabled="readOnly"><em>{{ t('unit.g') }}</em></span>
          </li>
        </ul>
        <p class="footnote">{{ t('product.pieceNote') }}</p>

        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <button v-if="editing && !readOnly" type="button" class="btn btn--danger btn--block" @click="remove">{{ t('product.delete') }}</button>
      </div>
    </form>
  </dialog>
</template>
