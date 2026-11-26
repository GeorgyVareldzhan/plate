/**
 * TEMPORARY: moves data from the old on-device database (IndexedDB "calc", before the cloud)
 * into the signed-in account. Delete this file and its call in account.js once every device has moved.
 *
 * Starter products map to the shared catalog by name; the user's own products, days and dishes
 * get new ids. The old database is kept and only marked as migrated, so nothing is lost if
 * something goes wrong.
 */
import { db } from './db.js';
import { auth } from './firebase.js';
import { saveLanguage } from './i18n.js';

const OLD_DB = 'calc';

const request = (r) => new Promise((resolve, reject) => {
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error);
});

/** Open the old database if it exists (never creates it) */
function openOld() {
  return new Promise((resolve) => {
    const r = indexedDB.open(OLD_DB);
    r.onupgradeneeded = (e) => { if (e.oldVersion === 0) r.transaction.abort(); };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => resolve(null);
  });
}

/** true — data was moved into the account */
export async function migrateLocal() {
  const old = await openOld();
  if (!old) return false;
  try {
    const stores = ['products', 'days', 'dishes', 'meta'].filter((s) => old.objectStoreNames.contains(s));
    if (!stores.includes('days')) return false;
    const tx = old.transaction(stores);
    const read = (store) => (stores.includes(store) ? request(tx.objectStore(store).getAll()) : []);
    const [products, days, dishes, meta] = await Promise.all(['products', 'days', 'dishes', 'meta'].map(read));
    const metaOf = (key) => meta.find((m) => m.key === key)?.value;
    if (metaOf('migratedTo')) return false;

    const catalogByName = new Map(db.all('products').filter((p) => p.catalog).map((p) => [p.name, p.id]));
    const productIds = new Map();
    const ops = [];
    for (const { id, seed, ...product } of products) {
      const catalogId = seed ? catalogByName.get(product.name) : null;
      if (catalogId) {
        productIds.set(id, catalogId);
      } else {
        const newId = db.newId();
        productIds.set(id, newId);
        ops.push({ put: 'products', value: { ...product, id: newId } });
      }
    }
    const mapItems = (items) => items
      .filter((i) => productIds.has(i.productId))
      .map((i) => ({ ...i, productId: productIds.get(i.productId) }));
    for (const { id, ...day } of days) {
      ops.push({ put: 'days', value: { ...day, meals: day.meals.map((m) => ({ ...m, items: mapItems(m.items) })) } });
    }
    for (const { id, seed, ...dish } of dishes) {
      ops.push({ put: 'dishes', value: { ...dish, items: mapItems(dish.items) } });
    }
    db.batch(ops);

    if (metaOf('language')) saveLanguage(metaOf('language'));
    const mark = old.transaction('meta', 'readwrite');
    mark.objectStore('meta').put({ key: 'migratedTo', value: auth.currentUser.uid });
    await new Promise((resolve) => { mark.oncomplete = resolve; mark.onerror = resolve; });
    return ops.length > 0;
  } finally {
    old.close();
  }
}
