/**
 * One-off upload of the starter list (scripts/seed.js) to Firestore:
 *   catalog/{id}       — shared products
 *   starterDishes/{id} — dishes copied to every new account
 *
 * Writes go through the REST API with the Firebase CLI login (project owner), so security rules
 * do not apply. Ids are derived from names, existing documents are left untouched — safe to re-run.
 *
 * Usage: firebase projects:list >/dev/null && node scripts/upload-catalog.mjs
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';

const PROJECT = 'plate-calc-app';
const BASE = `projects/${PROJECT}/databases/(default)/documents`;

const source = readFileSync(new URL('./seed.js', import.meta.url), 'utf8');
const { SEED_PRODUCTS, SEED_DISHES } = await import(`data:text/javascript,${encodeURIComponent(source)}`);
const { tokens } = JSON.parse(readFileSync(`${homedir()}/.config/configstore/firebase-tools.json`, 'utf8'));
if (tokens.expires_at < Date.now() + 60_000) throw new Error('Token expired: run "firebase projects:list" first');

const idOf = (name) => createHash('sha1').update(name).digest('base64url').slice(0, 20);

/** JS value → Firestore REST value */
function value(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(value) } };
  return { mapValue: { fields: fields(v) } };
}
const fields = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined).map(([k, v]) => [k, value(v)]));

const now = Date.now();
const writes = [];
const catalogIds = new Map();

for (const product of SEED_PRODUCTS) {
  const id = idOf(product.name);
  catalogIds.set(product.name, { id, product });
  writes.push({ path: `catalog/${id}`, data: { ...product, updatedAt: now } });
}

for (const dish of SEED_DISHES) {
  const items = dish.items.flatMap(([name, amount, unit]) => {
    const found = catalogIds.get(name);
    if (!found) { console.warn(`Dish "${dish.name}": no product "${name}"`); return []; }
    const pieces = unit === 'шт' && found.product.pieceGrams > 0;
    return [{ productId: found.id, grams: pieces ? amount * found.product.pieceGrams : amount, unit: pieces ? 'pcs' : 'g' }];
  });
  writes.push({ path: `starterDishes/${idOf(dish.name)}`, data: { name: dish.name, icon: dish.icon, items, order: writes.length } });
}

// One commit per document: precondition exists:false — never overwrite edits made in the console
let created = 0;
let skipped = 0;
for (const w of writes) {
  const res = await fetch(`https://firestore.googleapis.com/v1/${BASE}:commit`, {
    method: 'POST',
    headers: { authorization: `Bearer ${tokens.access_token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      writes: [{ update: { name: `${BASE}/${w.path}`, fields: fields(w.data) }, currentDocument: { exists: false } }],
    }),
  });
  if (res.ok) created += 1;
  else if (res.status === 409 || res.status === 400) skipped += 1;
  else throw new Error(`${w.path}: ${res.status} ${await res.text()}`);
}
console.log(`catalog + starter dishes: ${created} created, ${skipped} already existed`);
