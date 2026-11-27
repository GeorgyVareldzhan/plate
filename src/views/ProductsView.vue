<script setup>
/** "Products" screen: the catalog and the user's own products by section, search, language switch */
import { computed, nextTick, onActivated, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { t, LANGUAGES, getLanguage, saveLanguage } from '../js/i18n.js';
import { productCategory } from '../js/icons.js';
import { actionSheet } from '../js/ui.js';
import {
  CAN_ADD_PRODUCTS, searchProducts, resultChips, sectionChips, groupProducts, searchNote,
} from '../js/products.js';
import { scrollToSection, initScrollSpy } from '../js/searchbar.js';
import { products, usage } from '../js/store.js';
import { openProductDialog } from '../js/sheets.js';
import AppIcon from '../components/AppIcon.vue';
import AddRow from '../components/AddRow.vue';
import ProductRow from '../components/ProductRow.vue';
import SearchBar from '../components/SearchBar.vue';

defineOptions({ name: 'ProductsView' });

const list = ref(null);
const bar = ref(null);
const query = ref('');
const q = computed(() => query.value.trim());
const activeChip = ref('all'); // section filter while searching
const spyActive = ref(null); // section at the top while not searching
watch(query, () => { activeChip.value = 'all'; });

const groups = computed(() => groupProducts(products.value));
const results = computed(() => (q.value ? searchProducts(products.value, q.value, usage.value) : []));
const shown = computed(() => (activeChip.value === 'all' ? results.value
  : results.value.filter(({ item }) => productCategory(item) === activeChip.value)));
const chips = computed(() => {
  if (!q.value) return sectionChips(products.value);
  return results.value.length ? resultChips(results.value) : [];
});
// A filter that has no matches any more falls back to "All"
watch(chips, (all) => { if (q.value && !all.some((c) => c.id === activeChip.value)) activeChip.value = 'all'; });

function pickChip(id) {
  if (q.value) {
    activeChip.value = id;
    return;
  }
  spy.follow(id);
  scrollToSection(list.value, bar.value.root, id, window);
}

let spy = null;
onMounted(() => {
  spy = initScrollSpy({
    list: () => list.value,
    searchBar: () => bar.value.root,
    chips: () => bar.value.chipsEl,
    scrollRoot: window,
    enabled: () => !q.value && list.value?.isConnected,
    onActive: (id) => { spyActive.value = id; },
  });
});
onActivated(async () => {
  await nextTick();
  spy.refresh();
});
onBeforeUnmount(() => spy.stop());

const openProduct = (product, prefill) => openProductDialog(product, prefill);

/* Language switch: deliberately low-key at the bottom, most users never need it */
const languageLabel = computed(() => t('language.label', { name: LANGUAGES.find(([code]) => code === getLanguage())[1] }));

function chooseLanguage() {
  actionSheet(null, LANGUAGES.map(([code, name]) => ({
    label: code === getLanguage() ? `✓ ${name}` : name,
    onClick: () => {
      if (code === getLanguage()) return;
      saveLanguage(code);
      location.reload(); // every screen is rebuilt in the new language; this screen is in the URL
    },
  })));
}
</script>

<template>
  <section id="view-products" class="view">
    <header class="navbar">
      <span />
      <button id="products-add" type="button" class="nav-icon" :aria-label="t('products.add')" :hidden="!CAN_ADD_PRODUCTS" @click="openProduct(null, { name: q })">
        <AppIcon name="plus" :size="24" />
      </button>
    </header>
    <h1 class="large-title">{{ t('products.title') }}</h1>

    <SearchBar
      id="products-searchbar"
      ref="bar"
      v-model="query"
      :placeholder="t('products.search')"
      :chips="chips"
      :active="q ? activeChip : spyActive"
      @pick="pickChip"
    />
    <div id="products-list" ref="list">
      <template v-if="!q">
        <template v-for="group in groups" :key="group.id">
          <p class="group-title" :data-section="group.id">{{ group.title }}</p>
          <ul class="group group--icons">
            <ProductRow v-for="p in group.items" :key="p.id" :product="p" :section="group.id" chevron @pick="openProduct(p)" />
          </ul>
        </template>
      </template>
      <template v-else>
        <ul v-if="shown.length" class="group group--icons">
          <ProductRow
            v-for="{ item, ranges } in shown"
            :key="item.id"
            :product="item"
            :section="productCategory(item)"
            :note="searchNote(item, usage)"
            :ranges="ranges"
            @pick="openProduct(item)"
          />
        </ul>
        <ul v-if="CAN_ADD_PRODUCTS" class="group group--icons group--create">
          <AddRow :label="t('search.create', { query: q })" @add="openProduct(null, { name: q })" />
        </ul>
      </template>
    </div>
    <p v-if="!q && !products.length" id="products-empty" class="empty-note">{{ t('products.empty') }}</p>
    <p v-if="q && !results.length" id="products-empty" class="empty-note">{{ t('products.notFound', { query: q }) }}</p>
    <p class="footnote footnote--center">{{ t('products.note') }}</p>
    <button id="language-btn" type="button" class="language-link" @click="chooseLanguage">{{ languageLabel }}</button>
  </section>
</template>
