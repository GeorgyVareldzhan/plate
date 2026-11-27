<script setup>
/**
 * Product picker (and dish picker — when adding to a meal).
 * "Dishes" and "Frequent" on top, then products by section; when searching — one ranked list.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { t } from '../js/i18n.js';
import { productCategory } from '../js/icons.js';
import { search } from '../js/search.js';
import {
  CAN_ADD_PRODUCTS, searchProducts, resultChips, sectionChips, groupProducts, searchNote,
} from '../js/products.js';
import { scrollToSection, initScrollSpy } from '../js/searchbar.js';
import { products, usage } from '../js/store.js';
import { sheets, openProductDialog } from '../js/sheets.js';
import SearchBar from './SearchBar.vue';
import ProductRow from './ProductRow.vue';
import DishRowBody from './DishRowBody.vue';
import AddRow from './AddRow.vue';

const FREQUENT_LIMIT = 10;
const DISHES = 'dishes';
const FREQUENT = 'frequent';

const dialog = ref(null);
const list = ref(null);
const bar = ref(null);

const options = shallowRef(null); // { title, onProduct, dishes?, onDish? }
const query = ref('');
const q = computed(() => query.value.trim());
const activeChip = ref('all'); // section filter while searching
const spyActive = ref(null); // section at the top while not searching
watch(query, () => { activeChip.value = 'all'; });

const dishes = computed(() => options.value?.dishes ?? []);

/** Most frequently added products, most used first; ties go to the one used more recently */
const frequent = computed(() => {
  const byId = new Map(products.value.map((p) => [p.id, p]));
  return [...usage.value.entries()]
    .filter(([id]) => byId.has(id))
    .sort(([, a], [, b]) => b.count - a.count || b.lastUsed - a.lastUsed)
    .slice(0, FREQUENT_LIMIT)
    .map(([id]) => byId.get(id));
});

const groups = computed(() => groupProducts(products.value, [{ id: FREQUENT, title: t('picker.frequent'), items: frequent.value }]));

// Search
const foundDishes = computed(() => (q.value ? search(dishes.value, q.value) : []));
const results = computed(() => (q.value ? searchProducts(products.value, q.value, usage.value) : []));
const showDishes = computed(() => foundDishes.value.length > 0 && (activeChip.value === 'all' || activeChip.value === DISHES));
const shown = computed(() => (activeChip.value === 'all' ? results.value
  : results.value.filter(({ item }) => productCategory(item) === activeChip.value)));

const chips = computed(() => {
  if (!q.value) {
    return sectionChips(products.value, [
      ...(dishes.value.length ? [{ id: DISHES, label: t('picker.dishes') }] : []),
      ...(frequent.value.length ? [{ id: FREQUENT, label: t('picker.frequent') }] : []),
    ]);
  }
  if (!results.value.length && !foundDishes.value.length) return [];
  const extra = foundDishes.value.length ? [{ id: DISHES, label: t('picker.dishes'), count: foundDishes.value.length }] : [];
  return resultChips(results.value, extra);
});
// A filter that has no matches any more falls back to "All"
watch(chips, (list) => { if (q.value && !list.some((c) => c.id === activeChip.value)) activeChip.value = 'all'; });

function pickChip(id) {
  if (q.value) {
    activeChip.value = id;
    return;
  }
  spy.follow(id);
  scrollToSection(list.value, bar.value.root, id, dialog.value);
}

let spy = null;
onMounted(() => {
  spy = initScrollSpy({
    list: () => list.value,
    searchBar: () => bar.value.root,
    chips: () => bar.value.chipsEl,
    scrollRoot: dialog.value,
    enabled: () => !q.value,
    onActive: (id) => { spyActive.value = id; },
  });
  sheets.picker = async (opts) => {
    options.value = opts;
    query.value = '';
    activeChip.value = 'all';
    await nextTick();
    dialog.value.showModal();
    dialog.value.scrollTop = 0;
    spy.refresh();
  };
});
onBeforeUnmount(() => spy.stop());

function pickProduct(product) {
  if (dialog.value.open) dialog.value.close();
  options.value.onProduct(product);
}

function pickDish(dish) {
  if (dialog.value.open) dialog.value.close();
  options.value.onDish(dish);
}

async function createProduct(name) {
  const product = await openProductDialog(null, { name });
  if (product?.id) pickProduct(product);
}
</script>

<template>
  <dialog id="picker" ref="dialog" autofocus tabindex="-1" class="sheet sheet--tall">
    <div class="sheet__head">
      <button type="button" class="link" @click="dialog.close()">{{ t('action.cancel') }}</button>
      <strong>{{ options?.title ?? t('meal.addProduct') }}</strong>
      <button v-if="CAN_ADD_PRODUCTS" type="button" class="link" @click="createProduct(q)">{{ t('action.new') }}</button>
      <span v-else />
    </div>
    <div class="sheet__body">
      <SearchBar
        id="picker-searchbar"
        ref="bar"
        v-model="query"
        :placeholder="t('picker.search')"
        :chips="chips"
        :active="q ? activeChip : spyActive"
        :scroll-area="() => dialog"
        @pick="pickChip"
      />
      <div id="picker-list" ref="list">
        <template v-if="options && !q">
          <template v-if="dishes.length">
            <p class="group-title" :data-section="DISHES">{{ t('picker.dishes') }}</p>
            <ul class="group group--icons">
              <li v-for="dish in dishes" :key="dish.id">
                <button type="button" class="row" @click="pickDish(dish)"><DishRowBody :dish="dish" /></button>
              </li>
            </ul>
          </template>
          <!-- Products in their own block: the first section title there gets the small top margin -->
          <div>
            <template v-for="group in groups" :key="group.id">
              <p class="group-title" :data-section="group.id">{{ group.title }}</p>
              <ul class="group group--icons">
                <ProductRow
                  v-for="p in group.items"
                  :key="p.id"
                  :product="p"
                  :section="group.id"
                  :note="group.id === FREQUENT ? t('picker.timesUsed', { count: usage.get(p.id)?.count }) : null"
                  @pick="pickProduct"
                />
              </ul>
            </template>
          </div>
        </template>
        <template v-else-if="options">
          <template v-if="showDishes">
            <p class="group-title" :data-section="DISHES">{{ t('picker.dishes') }}</p>
            <ul class="group group--icons">
              <li v-for="{ item, ranges } in foundDishes" :key="item.id">
                <button type="button" class="row" @click="pickDish(item)"><DishRowBody :dish="item" :ranges="ranges" /></button>
              </li>
            </ul>
          </template>
          <template v-if="activeChip !== DISHES && shown.length">
            <p v-if="showDishes" class="group-title">{{ t('products.title') }}</p>
            <ul class="group group--icons">
              <ProductRow
                v-for="{ item, ranges } in shown"
                :key="item.id"
                :product="item"
                :section="productCategory(item)"
                :note="searchNote(item, usage)"
                :ranges="ranges"
                @pick="pickProduct"
              />
            </ul>
          </template>
          <p v-if="!results.length && !foundDishes.length" class="empty-note">{{ t('products.notFound', { query: q }) }}</p>
          <ul v-if="CAN_ADD_PRODUCTS" class="group group--icons group--create">
            <AddRow :label="t('search.create', { query: q })" @add="createProduct(q)" />
          </ul>
        </template>
      </div>
    </div>
  </dialog>
</template>
