/**
 * Reactive views of the data for screens. They recompute whenever the in-memory mirror changes
 * (db.revision), locally or from another device.
 */
import { computed, shallowRef } from 'vue';
import { db, revision } from './db.js';

const byName = (a, b) => (a.name || '').localeCompare(b.name || '', 'ru');

/** All products (catalog and the user's own), by name */
export const products = computed(() => {
  void revision.value;
  return db.all('products').sort(byName);
});

export const productsById = computed(() => new Map(products.value.map((p) => [p.id, p])));

/** Dishes by name */
export const dishes = computed(() => {
  void revision.value;
  return db.all('dishes').sort(byName);
});

export const days = computed(() => {
  void revision.value;
  return db.all('days');
});

/** Map productId → { count, lastUsed } over all days: for "Frequent" and for ranking search results */
export const usage = computed(() => {
  const stats = new Map();
  for (const day of days.value) {
    for (const item of day.meals.flatMap((m) => m.items)) {
      const s = stats.get(item.productId) ?? { count: 0, lastUsed: 0 };
      s.count += 1;
      s.lastUsed = Math.max(s.lastUsed, day.updatedAt ?? 0);
      stats.set(item.productId, s);
    }
  }
  return stats;
});

/**
 * Bumped when data changed on another device and the user is not in the middle of something:
 * editors (a day, a dish) reload their working copy then. Lists follow the data by themselves.
 */
export const remoteTick = shallowRef(0);

/** Save functions of open editors (a day, a dish) with debounced edits not written yet */
const flushers = new Set();

/** Register an editor's flush(); returns the function that unregisters it */
export function registerFlush(flush) {
  flushers.add(flush);
  return () => flushers.delete(flush);
}

/** Write pending edits of all open editors now — before a reload or a remote refresh */
export const flushEdits = () => Promise.all([...flushers].map((flush) => flush()));
