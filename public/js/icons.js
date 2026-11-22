/**
 * Product icons and categories.
 *
 * A product stores an icon key (product.icon), not an image. Currently the key is rendered as an emoji;
 * to switch to a custom drawn set, only renderIcon() needs changing — the data stays untouched.
 * Do not rename keys: they are already saved on products on users' devices.
 *
 * If a product has no icon of its own, the icon and category are matched by name (RULES, top to bottom —
 * first match wins). So seed.js can be edited without thinking about icons, and new products get
 * a fitting image right away.
 *
 * Emoji up to Unicode 15.1 (iOS 17.4+). Newer ones (e.g. 🫜 from iOS 18.4) are not used:
 * on older systems they show up as an empty box.
 */
import { h } from './dom.js';
import { RULES } from './i18n/icon-rules.ru.js';

/** Icon picker grid sections: [title, { key: emoji }] */
export const ICON_GROUPS = [
  ['meatPoultry', {
    steak: '🥩', meatBone: '🍖', bacon: '🥓', sausage: '🌭', poultry: '🍗',
  }],
  ['fishSeafood', {
    fish: '🐟', tropicalFish: '🐠', blowfish: '🐡', shark: '🦈', shrimp: '🦐', friedShrimp: '🍤',
    lobster: '🦞', crab: '🦀', squid: '🦑', octopus: '🐙', oyster: '🦪', shell: '🐚',
    caviar: '🍣', fishCake: '🍥',
  }],
  ['eggsDairy', {
    egg: '🥚', friedEgg: '🍳', milk: '🥛', babyBottle: '🍼', cheese: '🧀', butter: '🧈',
  }],
  ['grainsBakery', {
    rice: '🍚', riceBall: '🍙', riceCracker: '🍘', porridge: '🥣', pasta: '🍝', noodles: '🍜',
    grain: '🌾', beans: '🫘', bread: '🍞', baguette: '🥖', croissant: '🥐', bagel: '🥯',
    flatbread: '🫓', pancakes: '🥞', waffle: '🧇', pretzel: '🥨',
  }],
  ['readyMeals', {
    salad: '🥗', soup: '🍲', stew: '🥘', fondue: '🫕', curry: '🍛', dumpling: '🥟',
    pizza: '🍕', burger: '🍔', sandwich: '🥪', shawarma: '🥙', wrap: '🌯', taco: '🌮',
    tamale: '🫔', falafel: '🧆', oden: '🍢', bento: '🍱', takeout: '🥡', fortune: '🥠',
  }],
  ['vegetables', {
    potato: '🥔', sweetPotato: '🍠', carrot: '🥕', onion: '🧅', garlic: '🧄', ginger: '🫚',
    cucumber: '🥒', tomato: '🍅', pepper: '🫑', hotPepper: '🌶️', eggplant: '🍆', pumpkin: '🎃',
    cabbage: '🥬', broccoli: '🥦', avocado: '🥑', peas: '🫛', corn: '🌽', olive: '🫒',
  }],
  ['greens', {
    herbs: '🌿', seedling: '🌱', shamrock: '☘️', clover: '🍀', mushroom: '🍄', brownMushroom: '🍄‍🟫',
  }],
  ['fruits', {
    apple: '🍎', greenApple: '🍏', pear: '🍐', peach: '🍑', cherry: '🍒', grapes: '🍇',
    watermelon: '🍉', melon: '🍈', banana: '🍌', orange: '🍊', lemon: '🍋', lime: '🍋‍🟩',
    pineapple: '🍍', mango: '🥭', kiwi: '🥝', coconut: '🥥', strawberry: '🍓', berries: '🫐',
  }],
  ['nuts', {
    peanut: '🥜', nut: '🌰', seeds: '🌻',
  }],
  ['sweets', {
    chocolate: '🍫', candy: '🍬', lollipop: '🍭', honey: '🍯', cake: '🍰', birthdayCake: '🎂',
    cupcake: '🧁', pie: '🥧', doughnut: '🍩', cookie: '🍪', custard: '🍮', iceCream: '🍨',
    softIce: '🍦', shavedIce: '🍧', dango: '🍡', mooncake: '🥮',
  }],
  ['saucesSpices', {
    oil: '🫗', jar: '🫙', salt: '🧂', canned: '🥫',
  }],
  ['snacks', {
    chips: '🍟', popcorn: '🍿',
  }],
  ['drinks', {
    water: '💧', ice: '🧊', juice: '🧃', shake: '🥤', bubbleTea: '🧋', tea: '🍵', teapot: '🫖',
    coffee: '☕', mate: '🧉',
  }],
  ['alcohol', {
    beer: '🍺', beers: '🍻', wine: '🍷', champagne: '🥂', bottle: '🍾', cocktail: '🍹',
    martini: '🍸', spirits: '🥃', sake: '🍶',
  }],
  ['other', {
    plate: '🍽️', cutlery: '🍴', spoon: '🥄', chopsticks: '🥢', pill: '💊',
  }],
];

/** All icons: key → emoji */
export const ICONS = Object.assign({}, ...ICON_GROUPS.map(([, icons]) => icons));

export const DEFAULT_ICON = 'plate';

/** Categories in display order in the product list; hue — icon tile hue */
export const CATEGORIES = [
  ['meat', 8], ['poultry', 28], ['fish', 205], ['seafood', 190], ['eggs', 45],
  ['dairy', 210], ['grains', 38], ['bakery', 32], ['readyMeals', 18], ['vegetables', 110],
  ['greens', 95], ['fruits', 350], ['berries', 280], ['driedFruits', 30],
  ['nuts', 32], ['oilsSauces', 55], ['snacks', 20], ['sweets', 300],
  ['Bombbar', 300], ['Snaq Fabriq', 300],
  ['drinks', 260], ['other', 0],
];
const HUE = Object.fromEntries(CATEGORIES);


/** Category and icon by product name */
export function classify(name) {
  const n = name.toLowerCase();
  for (const [category, icon, pattern] of RULES) {
    if (pattern.test(n)) return { category, icon };
  }
  return { category: 'other', icon: DEFAULT_ICON };
}

/** Category by icon — for products with an unrecognized name but a manually chosen icon */
const ICON_CATEGORY = {};
for (const [category, key] of RULES) ICON_CATEGORY[key] ??= category;
// Icons with no name-based rules
Object.assign(ICON_CATEGORY, {
  tropicalFish: 'fish', blowfish: 'fish', shark: 'fish',
  friedShrimp: 'seafood', shell: 'seafood', fishCake: 'seafood', babyBottle: 'dairy',
  riceBall: 'grains', riceCracker: 'grains', fondue: 'readyMeals', tamale: 'readyMeals',
  oden: 'readyMeals', bento: 'readyMeals', takeout: 'readyMeals', fortune: 'bakery',
  shamrock: 'greens', clover: 'greens', brownMushroom: 'greens',
  birthdayCake: 'bakery', softIce: 'sweets', shavedIce: 'sweets',
  dango: 'sweets', mooncake: 'bakery', ice: 'drinks', teapot: 'drinks',
  beers: 'drinks', bottle: 'drinks',
});

export const productIcon = (product) => (product?.icon && ICONS[product.icon] ? product.icon : classify(product?.name ?? '').icon);

/** Brands get their own sections in the product list. Icon and tile color follow the product type. */
const BRANDS = [
  ['Bombbar', /bombbar/],
  ['Snaq Fabriq', /snaq fabriq/],
];

/** Category by product type (meat, sweets…) — determines the icon tile color */
function typeCategory(product) {
  const { category } = classify(product?.name ?? '');
  if (category !== 'other' || !product?.icon) return category;
  return ICON_CATEGORY[product.icon] ?? category;
}

/** Product list section: the brand for branded products, otherwise the type category */
export function productCategory(product) {
  const name = (product?.name ?? '').toLowerCase();
  const brand = BRANDS.find(([, pattern]) => pattern.test(name));
  return brand ? brand[0] : typeCategory(product);
}

/** Product icon tile */
export function iconTile(product, size = '') {
  const key = productIcon(product);
  const hue = HUE[typeCategory(product)] ?? 0;
  return h('span', {
    class: `tile ${size}`,
    style: `--hue:${hue}`,
    'aria-hidden': 'true',
  }, renderIcon(key));
}

/** How an icon is rendered. For a drawn set, return an <svg> for the key here. */
export function renderIcon(key) {
  return ICONS[key] ?? ICONS[DEFAULT_ICON];
}
