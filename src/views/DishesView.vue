<script setup>
/** "Dishes" screen: the list of dishes */
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { db } from '../js/db.js';
import { t } from '../js/i18n.js';
import { CAN_ADD_DISHES, dishName } from '../js/dishes.js';
import { dishes } from '../js/store.js';
import { screenEls } from '../js/backswipe.js';
import AppIcon from '../components/AppIcon.vue';
import DishRowBody from '../components/DishRowBody.vue';
import SwipeRow from '../components/SwipeRow.vue';

defineOptions({ name: 'DishesView' });

const router = useRouter();
const root = ref(null);
onMounted(() => { screenEls.dishes = root.value; });

function createDish() {
  const now = Date.now();
  const id = db.put('dishes', { name: '', items: [], createdAt: now, updatedAt: now });
  router.push({ name: 'dish', params: { id } });
}

function deleteDish(dish) {
  if (!confirm(t('dish.deleteConfirm', { name: dishName(dish) }))) return;
  db.delete('dishes', dish.id);
}
</script>

<template>
  <section id="view-dishes" ref="root" class="view">
    <header class="navbar">
      <span />
      <button v-if="CAN_ADD_DISHES" id="dishes-add" type="button" class="nav-icon" :aria-label="t('dishes.new')" @click="createDish">
        <AppIcon name="plus" :size="24" />
      </button>
    </header>
    <h1 class="large-title">{{ t('dishes.title') }}</h1>

    <ul id="dishes-list" class="group group--icons" :hidden="!dishes.length">
      <SwipeRow
        v-for="dish in dishes"
        :key="dish.id"
        tag="button"
        class="row"
        @click="router.push({ name: 'dish', params: { id: dish.id } })"
        @delete="deleteDish(dish)"
      >
        <DishRowBody :dish="dish" />
      </SwipeRow>
    </ul>
    <div v-if="!dishes.length" id="dishes-empty" class="empty-state">
      <div class="empty-state__icon" aria-hidden="true">🍳</div>
      <p class="empty-state__title">{{ t('dishes.empty.title') }}</p>
      <p class="empty-state__text">{{ t('dishes.empty.text') }}</p>
      <button v-if="CAN_ADD_DISHES" id="dishes-empty-add" type="button" class="btn btn--filled" @click="createDish">{{ t('dishes.empty.button') }}</button>
    </div>
    <p class="footnote">{{ t('dishes.note') }}</p>
  </section>
</template>
