/**
 * Локальная база на IndexedDB — данные хранятся только на устройстве.
 *
 * Хранилища:
 *   products — { id, name, kcal, protein, fat, carbs, pieceGrams, seed? }  (на 100 г, сухой/сырой вес)
 *              seed: true — продукт из стартового списка, ещё не менявшийся в приложении
 *   days     — { id, date: 'YYYY-MM-DD', targets: { kcal, protein, fat, carbs },
 *                meals: [{ items: [{ productId, grams, unit: 'g' | 'pcs' }] }], createdAt, updatedAt }
 *   dishes   — { id, name, icon?, items: [{ productId, grams, unit }], seed?, createdAt, updatedAt }
 *              блюдо — шаблон: при добавлении в приём его ингредиенты копируются в приём
 *   meta     — { key, value }; key = 'seedVersion' — версия стартового списка, применённая к базе
 *
 * В позиции всегда хранится вес в граммах; unit — только способ ввода и отображения.
 */
import { SEED_PRODUCTS, SEED_DISHES, SEED_VERSION, SEED_RENAMES } from './seed.js';

const DB_NAME = 'calc';
const DB_VERSION = 3;

// Названия из первого стартового списка — чтобы при переходе на версию 2 отличить их от своих продуктов
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
      // Миграции схемы: увеличьте DB_VERSION и добавьте блок if (event.oldVersion < N)
      if (event.oldVersion < 1) {
        db.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
        db.createObjectStore('days', { keyPath: 'id', autoIncrement: true });
      }
      if (event.oldVersion < 2) {
        db.createObjectStore('meta', { keyPath: 'key' });
        if (event.oldVersion >= 1) {
          // Пометить продукты из первого стартового списка, чтобы syncSeed мог их обновлять
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
      // Новая версия приложения в другой вкладке — закрываемся, чтобы не блокировать миграцию
      db.onversionchange = () => db.close();
      syncSeed(db).then(() => resolve(db), reject);
    };
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

/** Привести продукты к стартовому списку, если его версия выросла (правила — в seed.js) */
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
    // Продукты, которые есть в днях или блюдах, не удаляем, даже если их убрали из списка
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
        // Изменённый в приложении продукт (без пометки seed) оставляем как есть
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

/** Стартовые блюда: ингредиенты ищутся по названию продукта; изменённые в приложении блюда не трогаем */
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
        if (!product) return []; // продукт убрали из списка — пропускаем ингредиент
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
 * Выполнить действия в одной транзакции.
 * fn(tx) должна синхронно создать запросы; если она вернула IDBRequest — результатом будет его result.
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
  /** Сохранить запись, вернуть её ключ */
  put: (store, value) => run(store, 'readwrite', (tx) => tx.objectStore(store).put(value)),
  delete: (store, key) => run(store, 'readwrite', (tx) => { tx.objectStore(store).delete(key); }),
};
