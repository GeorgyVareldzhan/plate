/**
 * App data in Firestore. Works offline: the SDK keeps a local copy and a queue of writes.
 *
 * Collections:
 *   catalog/{id}             — shared products, read-only in the app (edited in the Firebase console)
 *   starterDishes/{id}       — dishes copied to a new account
 *   users/{uid}/products     — the user's own products
 *   users/{uid}/days         — { date: 'YYYY-MM-DD', targets: { kcal, protein, fat, carbs }, weight?,
 *                                meals: [{ items: [{ productId, grams, unit: 'g' | 'pcs' }] }], createdAt, updatedAt }
 *                              weight — morning weight that day, kg (the result of the previous day)
 *   users/{uid}/dishes       — { name, icon?, items: [{ productId, grams, unit }], createdAt, updatedAt }
 *   users/{uid}/meta/{key}   — { value }; 'account' — { createdAt } once the account is set up
 *
 * Products: { id, name, kcal, protein, fat, carbs, pieceGrams, icon? } per 100 g, dry/raw weight;
 * catalog products come with catalog: true. An item always stores weight in grams; unit is only
 * how it is entered and displayed.
 *
 * Screens read from an in-memory mirror kept up to date by snapshot listeners, so reads are instant
 * and never wait for the network. Writes update the mirror at once and are synced in the background.
 * Every change of the mirror bumps `revision`, so Vue computeds that read the data recompute.
 */
import {
  collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch, waitForPendingWrites, getDocFromServer, getDocsFromServer,
} from 'firebase/firestore';
import { shallowRef, toRaw } from 'vue';
import { firestore } from './firebase.js';

const USER_STORES = ['products', 'days', 'dishes', 'meta'];
const cache = { catalog: new Map(), products: new Map(), days: new Map(), dishes: new Map(), meta: new Map() };

/** Bumped on every change of the mirror: read it in a computed to recompute when data changes */
export const revision = shallowRef(0);
const changed = () => { revision.value += 1; };

let uid = null;
let pending = 0;
let remoteListener = () => {};
let statusListener = () => {};

const ref = (store, id) => (store === 'catalog' || store === 'starterDishes'
  ? doc(firestore, store, id)
  : doc(firestore, 'users', uid, store, id));
const newId = () => doc(collection(firestore, 'ids')).id;
/** Deep copy of plain data; also unwraps Vue reactive proxies (structuredClone can't copy them) */
function clone(v) {
  const raw = toRaw(v);
  if (Array.isArray(raw)) return raw.map(clone);
  if (raw && typeof raw === 'object') return Object.fromEntries(Object.entries(raw).map(([k, x]) => [k, clone(x)]));
  return raw;
}

/** Track a write until the server confirms it */
function track(promise) {
  pending += 1;
  statusListener();
  promise.catch((error) => console.error(error)).finally(() => {
    pending -= 1;
    statusListener();
  });
}

function withoutId({ id, catalog, ...data }) {
  return data;
}

/** Subscribe to the user's data; resolves when every collection has its first snapshot */
function start(userId) {
  uid = userId;
  const sources = [
    ['catalog', collection(firestore, 'catalog')],
    ...USER_STORES.map((store) => [store, collection(firestore, 'users', uid, store)]),
  ];
  let first = true;
  const ready = sources.map(([store, source]) => new Promise((resolve, reject) => {
    onSnapshot(source, (snap) => {
      for (const change of snap.docChanges()) {
        if (change.type === 'removed') cache[store].delete(change.doc.id);
        else cache[store].set(change.doc.id, { ...change.doc.data(), id: change.doc.id, ...(store === 'catalog' && { catalog: true }) });
      }
      if (snap.docChanges().length) changed();
      resolve();
      // Changes from another device: let the open screen redraw
      if (!first && !snap.metadata.hasPendingWrites && snap.docChanges().length) remoteListener();
    }, (error) => { console.error(error); reject(error); });
  }));
  // Writes queued in an earlier session (offline) count as unsaved until the server confirms them
  track(waitForPendingWrites(firestore));
  return Promise.all(ready).then(() => { first = false; });
}

function all(store) {
  if (store === 'products') return [...cache.catalog.values(), ...cache.products.values()].map(clone);
  return [...cache[store].values()].map(clone);
}

function get(store, id) {
  if (id == null) return undefined;
  if (store === 'products') return clone(cache.products.get(String(id)) ?? cache.catalog.get(String(id)));
  return clone(cache[store].get(String(id)));
}

/** Save a record (a new one gets an id) and return its id */
function put(store, value) {
  if (store === 'products' && value.catalog) throw new Error('Catalog products are read-only');
  const id = value.id ? String(value.id) : newId();
  const data = clone(value);
  cache[store].set(id, { ...data, id });
  changed();
  track(setDoc(ref(store, id), withoutId(data)));
  return id;
}

function remove(store, id) {
  cache[store].delete(String(id));
  changed();
  track(deleteDoc(ref(store, String(id))));
}

/** Several writes at once: [{ put: store, value } | { delete: store, id }]; returns new ids in order */
function batch(ops) {
  const ids = [];
  // A Firestore batch holds up to 500 writes
  for (let i = 0; i < ops.length; i += 450) {
    const b = writeBatch(firestore);
    for (const op of ops.slice(i, i + 450)) {
      if (op.put) {
        const id = op.value.id ? String(op.value.id) : newId();
        const data = clone(op.value);
        cache[op.put].set(id, { ...data, id });
        b.set(ref(op.put, id), withoutId(data));
        ids.push(id);
      } else {
        cache[op.delete].delete(String(op.id));
        b.delete(ref(op.delete, String(op.id)));
      }
    }
    track(b.commit());
  }
  changed();
  return ids;
}

/** Read a document straight from the server (null when offline or missing) */
async function fetchFromServer(store, id) {
  try {
    const snap = await getDocFromServer(ref(store, id));
    return snap.exists() ? { ...snap.data(), id: snap.id } : null;
  } catch {
    return undefined; // offline — unknown
  }
}

/** All documents of a shared collection, straight from the server */
async function fetchShared(name) {
  const snap = await getDocsFromServer(collection(firestore, name));
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
}

export const db = {
  start,
  all,
  get,
  put,
  delete: remove,
  batch,
  fetchFromServer,
  fetchShared,
  newId,
  /** Number of writes not yet confirmed by the server */
  pending: () => pending,
  onRemoteChange: (fn) => { remoteListener = fn; },
  onStatusChange: (fn) => { statusListener = fn; },
};
