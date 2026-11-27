<script setup>
/** The app shell: the current screen, the tab bar and the sheets shared by screens */
import { onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { session, goBack } from './js/router.js';
import { initBackSwipe } from './js/backswipe.js';
import { flushEdits } from './js/store.js';
import TabBar from './components/TabBar.vue';
import ActionSheet from './components/ActionSheet.vue';
import AccountSheet from './components/AccountSheet.vue';
import PickerSheet from './components/PickerSheet.vue';
import ProductSheet from './components/ProductSheet.vue';

const route = useRoute();

onMounted(() => {
  initBackSwipe({
    day: { parent: 'days', back: async () => { await flushEdits(); await goBack('days'); } },
    dish: { parent: 'dishes', back: async () => { await flushEdits(); await goBack('dishes'); } },
  }, { current: () => route.name });
});
</script>

<template>
  <main class="app">
    <!-- Tab screens stay alive: search, scroll spy and the swipe back's picture of the parent screen -->
    <RouterView v-slot="{ Component }">
      <KeepAlive :include="['DaysView', 'DishesView', 'ProductsView']">
        <component :is="Component" />
      </KeepAlive>
    </RouterView>
  </main>
  <!-- The day totals bar is teleported here by the day screen: outside the screen so the swipe back can move it along -->
  <TabBar />
  <ActionSheet />
  <template v-if="session.signedIn">
    <AccountSheet />
    <PickerSheet />
    <ProductSheet />
  </template>
</template>
