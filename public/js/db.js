/**
 * Local IndexedDB database — data is stored only on the device.
 *
 * Stores:
 *   products — { id, name, kcal, protein, fat, carbs, pieceGrams, seed? }  (per 100 g, dry/raw weight)
 *              seed: true — product from the starter list, not yet modified in the app
 *   days     — { id, date: 'YYYY-MM-DD', targets: { kcal, protein, fat, carbs },
 *                meals: [{ items: [{ productId, grams, unit: 'g' | 'pcs' }] }], createdAt, updatedAt }
 *   dishes   — { id, name, icon?, items: [{ productId, grams, unit }], seed?, createdAt, updatedAt }
 *              a dish is a template: when added to a meal, its ingredients are copied into the meal
 *   meta     — { key, value }; key = 'seedVersion' — starter list version applied to the database
 *
 * An item always stores weight in grams; unit is only how it is entered and displayed.
 */
import { SEED_PRODUCTS, SEED_DISHES, SEED_VERSION, SEED_RENAMES } from './seed.js';

const DB_NAME = 'calc';
const DB_VERSION = 3;

// Names from the first starter list — to tell them apart from the user's own products when moving to version 2
const V1_SEED_NAMES = new Set([
  'Куриная грудка', 'Куриное бедро без кожи', 'Индейка, филе', 'Говядина постная', 'Свинина, вырезка',
  'Минтай', 'Лосось', 'Тунец в собственном соку', 'Креветки', 'Яйцо куриное', 'Яичный белок',
  'Творог 0%', 'Творог 5%', 'Творог 9%', 'Молоко 2,5%', 'Кефир 1%', 'Йогурт греческий 2%',
  'Сметана 15%', 'Сыр твёрдый', 'Масло сливочное 82,5%', 'Рис белый', 'Рис бурый', 'Гречка',
  'Овсяные хлопья', 'Макароны из твёрдых сортов', 'Булгур', 'Киноа', 'Чечевица красная',
  'Хлеб цельнозерновой', 'Картофель', 'Батат', 'Огурец', 'Помидор', 'Брокколи',
  'Капуста белокочанная', 'Морковь', 'Перец болгарский', 'Банан', 'Яблоко', 'Апельсин',
  'Масло оливковое', 'Арахисовая паста', 'Грецкий орех', 'Миндаль', 'Мёд', 'Сахар',
  'Протеиновый батончик (пример)', 'Сывороточный протеин',
]);

let dbPromise = null;

const done = (tx) => new Promise((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onerror = () => reject(tx.error);
  tx.onabort = () => reject(tx.error);
});

function open() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      // Schema migrations: bump DB_VERSION and add an if (event.oldVersion < N) block
      if (event.oldVersion < 1) {
        db.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
        db.createObjectStore('days', { keyPath: 'id', autoIncrement: true });
      }
      if (event.oldVersion < 2) {
        db.createObjectStore('meta', { keyPath: 'key' });
        if (event.oldVersion >= 1) {
          // Mark products from the first starter list so syncSeed can update them
          request.transaction.objectStore('products').openCursor().onsuccess = (e) => {
            const cursor = e.target.result;
            if (!cursor) return;
            if (V1_SEED_NAMES.has(cursor.value.name)) cursor.update({ ...cursor.value, seed: true });
            cursor.continue();
          };
        }
      }
      if (event.oldVersion < 3) {
        db.createObjectStore('dishes', { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      // A new app version is open in another tab — close so we don't block its migration
      db.onversionchange = () => db.close();
      syncSeed(db).then(() => resolve(db), reject);
    };
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

/** Sync products with the starter list if its version has increased (rules are in seed.js) */
async function syncSeed(db) {
  const metaTx = db.transaction('meta');
  const versionReq = metaTx.objectStore('meta').get('seedVersion');
  await done(metaTx);
  if ((versionReq.result?.value ?? 0) >= SEED_VERSION) return;

  const tx = db.transaction(['products', 'days', 'dishes'], 'readwrite');
  const products = tx.objectStore('products');
  const productsReq = products.getAll();
  const daysReq = tx.objectStore('days').getAll();
  const dishesReq = tx.objectStore('dishes').getAll();

  dishesReq.onsuccess = () => {
    const existing = productsReq.result;
    // Products used in days or dishes are not deleted, even if they were removed from the list
    const used = new Set([
      ...daysReq.result.flatMap((d) => d.meals.flatMap((m) => m.items.map((i) => i.productId))),
      ...dishesReq.result.flatMap((d) => d.items.map((i) => i.productId)),
    ]);
    const byName = new Map(existing.map((p) => [p.name, p]));
    const oldNames = (name) => Object.entries(SEED_RENAMES).filter(([, to]) => to === name).map(([from]) => from);
    const kept = new Set();

    for (const seed of SEED_PRODUCTS) {
      const match = [seed.name, ...oldNames(seed.name)].map((n) => byName.get(n)).find((p) => p && !kept.has(p.id));
      if (!match) {
        products.add({ ...seed, seed: true });
      } else {
        kept.add(match.id);
        // A product modified in the app (no seed flag) is left as is
        if (match.seed) products.put({ ...seed, id: match.id, seed: true });
      }
    }

    for (const product of existing) {
      if (product.seed && !kept.has(product.id) && !used.has(product.id)) products.delete(product.id);
    }
  };

  await done(tx);
  await syncSeedDishes(db);
}

/** Starter dishes: ingredients are looked up by product name; dishes modified in the app are left untouched */
async function syncSeedDishes(db) {
  const tx = db.transaction(['products', 'dishes', 'meta'], 'readwrite');
  const dishes = tx.objectStore('dishes');
  const productsReq = tx.objectStore('products').getAll();
  const dishesReq = dishes.getAll();

  dishesReq.onsuccess = () => {
    const productByName = new Map(productsReq.result.map((p) => [p.name, p]));
    const existing = new Map(dishesReq.result.map((d) => [d.name, d]));
    const seedNames = new Set(SEED_DISHES.map((d) => d.name));
    const now = Date.now();

    for (const seed of SEED_DISHES) {
      const items = seed.items.flatMap(([name, amount, unit]) => {
        const product = productByName.get(name);
        if (!product) return []; // product was removed from the list — skip the ingredient
        const pieces = unit === 'шт' && product.pieceGrams > 0;
        return [{ productId: product.id, grams: pieces ? amount * product.pieceGrams : amount, unit: pieces ? 'pcs' : 'g' }];
      });
      const match = existing.get(seed.name);
      if (!match) dishes.add({ name: seed.name, items, seed: true, createdAt: now, updatedAt: now });
      else if (match.seed) dishes.put({ ...match, items, updatedAt: now });
    }
    for (const dish of dishesReq.result) {
      if (dish.seed && !seedNames.has(dish.name)) dishes.delete(dish.id);
    }

    tx.objectStore('meta').put({ key: 'seedVersion', value: SEED_VERSION });
  };

  await done(tx);
}

/**
 * Run operations in a single transaction.
 * fn(tx) must create requests synchronously; if it returns an IDBRequest, its result becomes the result.
 */
async function run(stores, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    const out = fn(tx);
    tx.oncomplete = () => resolve(out instanceof IDBRequest ? out.result : out);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const db = {
  open,
  run,
  all: (store) => run(store, 'readonly', (tx) => tx.objectStore(store).getAll()),
  get: (store, key) => run(store, 'readonly', (tx) => tx.objectStore(store).get(key)),
  /** Save a record and return its key */
  put: (store, value) => run(store, 'readwrite', (tx) => tx.objectStore(store).put(value)),
  delete: (store, key) => run(store, 'readwrite', (tx) => { tx.objectStore(store).delete(key); }),
};
