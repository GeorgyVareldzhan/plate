<script setup>
/** Tab bar; a screen that is not a tab highlights its parent tab */
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { t } from '../js/i18n.js';
import { TAB_OF, goTab } from '../js/router.js';

const TABS = [
  { name: 'days', label: 'days.title', paths: ['M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 10h16M9 3v4M15 3v4'] },
  { name: 'dishes', label: 'dishes.title', paths: ['M4 11h16v3a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6v-3zM2 11h20M8 7.5c0-1.4 1.8-2.5 4-2.5s4 1.1 4 2.5'] },
  {
    name: 'products',
    label: 'products.title',
    paths: ['M12 8c-1.5-1-5-1.5-6 2s1 9 3.5 10c1 .4 1.7-.3 2.5-.3s1.5.7 2.5.3C17 19 19 13.5 18 10s-4.5-3-6-2Z', 'M12 8c0-2 .8-3.5 2.5-4.5'],
  },
];

const route = useRoute();
const current = computed(() => TAB_OF[route.name] || route.name);

function open(name) {
  if (route.name === name) window.scrollTo(0, 0);
  else goTab(name);
}
</script>

<template>
  <nav class="tabbar" :aria-label="t('tabs.label')">
    <button v-for="tab in TABS" :key="tab.name" type="button" :data-tab="tab.name" :aria-current="current === tab.name ? 'page' : null" @click="open(tab.name)">
      <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path v-for="d in tab.paths" :key="d" :d="d" /></svg>
      <span>{{ t(tab.label) }}</span>
    </button>
  </nav>
</template>
