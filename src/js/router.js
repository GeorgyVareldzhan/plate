/**
 * Screens and navigation. Hash history (#/day/…): the app lives in a subfolder on GitHub Pages
 * with no server rewrites, and a reload (the auto-update) reopens the same screen.
 * Drilling down (a day, a dish) pushes a history entry; tabs replace the current one.
 */
import { nextTick, shallowRef } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';
import { db } from './db.js';
import AuthView from '../views/AuthView.vue';
import DaysView from '../views/DaysView.vue';
import DayView from '../views/DayView.vue';
import DishesView from '../views/DishesView.vue';
import DishView from '../views/DishView.vue';
import ProductsView from '../views/ProductsView.vue';

/** Set once at startup: whether a user is signed in */
export const session = { signedIn: false };

/** Name of the screen shown before the current one (null at startup) */
export const previousRoute = shallowRef(null);

// Screens that are not tabs highlight their parent tab
export const TAB_OF = { day: 'days', dish: 'dishes' };

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/auth', name: 'auth', component: AuthView },
    { path: '/', name: 'days', component: DaysView },
    {
      path: '/day/:id',
      name: 'day',
      component: DayView,
      props: true,
      beforeEnter: (to) => (db.get('days', to.params.id) ? true : { name: 'days', replace: true }),
    },
    { path: '/dishes', name: 'dishes', component: DishesView },
    {
      path: '/dish/:id',
      name: 'dish',
      component: DishView,
      props: true,
      beforeEnter: (to) => (db.get('dishes', to.params.id) ? true : { name: 'dishes', replace: true }),
    },
    { path: '/products', name: 'products', component: ProductsView },
    { path: '/:rest(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach((to) => {
  if (!session.signedIn && to.name !== 'auth') return { name: 'auth', replace: true };
  if (session.signedIn && to.name === 'auth') return { name: 'days', replace: true };
  return true;
});

router.afterEach((to, from) => {
  previousRoute.value = from.name ?? null;
  document.body.dataset.view = to.name;
});

/**
 * Back from a pushed screen to its parent: through the history when the parent is the entry
 * before, otherwise by replacing the current one (e.g. a day reopened after a reload).
 * Resolves once the parent is on screen.
 */
export async function goBack(parent) {
  const target = router.resolve({ name: parent }).fullPath;
  if (router.options.history.state.back !== target) {
    await router.replace({ name: parent });
    return nextTick();
  }
  const done = new Promise((resolve) => {
    const off = router.afterEach(() => { off(); resolve(); });
    setTimeout(() => { off(); resolve(); }, 1000); // navigation cancelled: don't hang the caller
  });
  router.back();
  await done;
  return nextTick();
}

/** Switch tabs */
export const goTab = (name) => router.replace({ name });
