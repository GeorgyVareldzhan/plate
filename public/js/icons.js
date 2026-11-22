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

/** Icon picker grid sections: [title, { key: emoji }] */
export const ICON_GROUPS = [
  ['Мясо и птица', {
    steak: '🥩', meatBone: '🍖', bacon: '🥓', sausage: '🌭', poultry: '🍗',
  }],
  ['Рыба и морепродукты', {
    fish: '🐟', tropicalFish: '🐠', blowfish: '🐡', shark: '🦈', shrimp: '🦐', friedShrimp: '🍤',
    lobster: '🦞', crab: '🦀', squid: '🦑', octopus: '🐙', oyster: '🦪', shell: '🐚',
    caviar: '🍣', fishCake: '🍥',
  }],
  ['Яйца и молочное', {
    egg: '🥚', friedEgg: '🍳', milk: '🥛', babyBottle: '🍼', cheese: '🧀', butter: '🧈',
  }],
  ['Крупы, хлеб, выпечка', {
    rice: '🍚', riceBall: '🍙', riceCracker: '🍘', porridge: '🥣', pasta: '🍝', noodles: '🍜',
    grain: '🌾', beans: '🫘', bread: '🍞', baguette: '🥖', croissant: '🥐', bagel: '🥯',
    flatbread: '🫓', pancakes: '🥞', waffle: '🧇', pretzel: '🥨',
  }],
  ['Готовая еда', {
    salad: '🥗', soup: '🍲', stew: '🥘', fondue: '🫕', curry: '🍛', dumpling: '🥟',
    pizza: '🍕', burger: '🍔', sandwich: '🥪', shawarma: '🥙', wrap: '🌯', taco: '🌮',
    tamale: '🫔', falafel: '🧆', oden: '🍢', bento: '🍱', takeout: '🥡', fortune: '🥠',
  }],
  ['Овощи', {
    potato: '🥔', sweetPotato: '🍠', carrot: '🥕', onion: '🧅', garlic: '🧄', ginger: '🫚',
    cucumber: '🥒', tomato: '🍅', pepper: '🫑', hotPepper: '🌶️', eggplant: '🍆', pumpkin: '🎃',
    cabbage: '🥬', broccoli: '🥦', avocado: '🥑', peas: '🫛', corn: '🌽', olive: '🫒',
  }],
  ['Зелень и грибы', {
    herbs: '🌿', seedling: '🌱', shamrock: '☘️', clover: '🍀', mushroom: '🍄', brownMushroom: '🍄‍🟫',
  }],
  ['Фрукты и ягоды', {
    apple: '🍎', greenApple: '🍏', pear: '🍐', peach: '🍑', cherry: '🍒', grapes: '🍇',
    watermelon: '🍉', melon: '🍈', banana: '🍌', orange: '🍊', lemon: '🍋', lime: '🍋‍🟩',
    pineapple: '🍍', mango: '🥭', kiwi: '🥝', coconut: '🥥', strawberry: '🍓', berries: '🫐',
  }],
  ['Орехи и семечки', {
    peanut: '🥜', nut: '🌰', seeds: '🌻',
  }],
  ['Сладкое', {
    chocolate: '🍫', candy: '🍬', lollipop: '🍭', honey: '🍯', cake: '🍰', birthdayCake: '🎂',
    cupcake: '🧁', pie: '🥧', doughnut: '🍩', cookie: '🍪', custard: '🍮', iceCream: '🍨',
    softIce: '🍦', shavedIce: '🍧', dango: '🍡', mooncake: '🥮',
  }],
  ['Соусы и специи', {
    oil: '🫗', jar: '🫙', salt: '🧂', canned: '🥫',
  }],
  ['Снеки', {
    chips: '🍟', popcorn: '🍿',
  }],
  ['Напитки', {
    water: '💧', ice: '🧊', juice: '🧃', shake: '🥤', bubbleTea: '🧋', tea: '🍵', teapot: '🫖',
    coffee: '☕', mate: '🧉',
  }],
  ['Алкоголь', {
    beer: '🍺', beers: '🍻', wine: '🍷', champagne: '🥂', bottle: '🍾', cocktail: '🍹',
    martini: '🍸', spirits: '🥃', sake: '🍶',
  }],
  ['Другое', {
    plate: '🍽️', cutlery: '🍴', spoon: '🥄', chopsticks: '🥢', pill: '💊',
  }],
];

/** All icons: key → emoji */
export const ICONS = Object.assign({}, ...ICON_GROUPS.map(([, icons]) => icons));

export const DEFAULT_ICON = 'plate';

/** Categories in display order in the product list; hue — icon tile hue */
export const CATEGORIES = [
  ['Мясо', 8], ['Птица', 28], ['Рыба', 205], ['Морепродукты', 190], ['Яйца', 45],
  ['Молочное', 210], ['Крупы и хлеб', 38], ['Выпечка', 32], ['Готовая еда', 18], ['Овощи', 110],
  ['Зелень и грибы', 95], ['Фрукты', 350], ['Ягоды', 280], ['Сухофрукты', 30],
  ['Орехи и семечки', 32], ['Масла и соусы', 55], ['Снеки', 20], ['Сладкое и спортпит', 300],
  ['Bombbar', 300], ['Snaq Fabriq', 300],
  ['Напитки', 260], ['Другое', 0],
];
const HUE = Object.fromEntries(CATEGORIES);

// Whole word: \b in JS doesn't work with Cyrillic
const W = (re) => new RegExp(`(^|[^а-яё])(${re})(?![а-яё])`);

/** [category, icon, name pattern] — checked top to bottom */
const RULES = [
  // --- First, things that more general rules would otherwise catch
  ['Выпечка', 'cookie', /^(?!.*(батончик|сывороточн|изолят|казеин)).*печенье/],      // before "liver"; "bar, Cookies & cream flavour" is a bar
  ['Сладкое и спортпит', 'jar', /^(?!.*батончик).*(nutella|нутелл|топпинг|орехов\S* паст|паст\S* .*орехов)/],   // before "paste/pasta"
  ['Сладкое и спортпит', 'cookie', /oreo|choco pie|cookie/],
  ['Сладкое и спортпит', 'candy', /raffaello|ferrero|toffifee|m&m|skittles|мишка косолап|белочк|птичье молоко|коровк|рот фронт|красная шапочк|грильяж|ласточк/],
  // Protein powders (before brands: Bombbar has both bars and powders)
  ['Сладкое и спортпит', 'shake', /^(?!.*(батончик|протеинов\S* печенье|панкейк|шоколад без)).*(протеин|изолят|казеин|whey)/],
  ['Сладкое и спортпит', 'chocolate', /^(?!.*(панкейк|вафл)).*(snickers|twix|mars(?![a-z])|bounty|milky way|kitkat|kinder|alpen gold|bombbar|snaq fabriq)/],
  ['Снеки', 'bacon', /мясн\S* чипс|джерки/],
  ['Снеки', 'chips', /чипс|начос/],
  ['Снеки', 'popcorn', /попкорн/],
  ['Снеки', 'pretzel', /сухари|крекер|гренк|сушк/],
  ['Снеки', 'squid', /кальмар\S* суш|сушен\S* кальмар/],
  ['Снеки', 'fish', /вобл|вялен|сушен\S* рыб|рыб\S* суш/],
  ['Снеки', 'cheese', /косичк/],
  ['Снеки', 'peanut', /арахис\S* жарен|солен\S* арахис/],
  ['Снеки', 'seeds', /семечки жарен/],
  ['Масла и соусы', 'salt', /соль|специ|приправ|паприк|куркум|корица|молот\S* перец|перец молот/],
  ['Масла и соусы', 'butter', /масло сливоч|масло топл|спред|маргарин/],
  ['Овощи', 'olive', /маслин|оливк/],                     // before "oil/butter"
  ['Масла и соусы', 'oil', /масло/],
  ['Масла и соусы', 'jar', /майонез|соус|горчиц|хрен|аджик|песто|ткемали|сметанн\S* соус/],
  ['Масла и соусы', 'tomato', /кетчуп|томатн\S* паст/],

  // --- Ready meals (before meat and fish: "pork dumplings" are dumplings)
  ['Готовая еда', 'dumpling', /пельмен|вареник|манты|хинкал|равиол|гедза|дамплинг/],
  ['Готовая еда', 'pizza', /пицц/],
  ['Готовая еда', 'burger', /бургер/],
  ['Готовая еда', 'shawarma', /шаурм|шаверм|донер|гирос|кебаб/],
  ['Готовая еда', 'sandwich', /бутерброд|сэндвич|сендвич|тост/],
  ['Готовая еда', 'sausage', /хот-?дог/],
  ['Готовая еда', 'taco', /тако(?![а-яё])|буррито|кесадиль/],
  ['Готовая еда', 'falafel', /фалафел|котлет|тефтел|фрикадел/],
  ['Готовая еда', 'caviar', /суши|ролл(?!тон)|сашими/],
  ['Готовая еда', 'soup', W('суп|борщ|щи|уха|солянк\\S*|бульон|рассольник|окрошк\\S*|харчо')],
  ['Готовая еда', 'stew', /плов|рагу|жаркое|^гуляш|азу(?![а-яё])/],
  ['Готовая еда', 'curry', /карри/],
  ['Готовая еда', 'noodles', /рамен|удон|доширак|роллтон|лапша быстр|фо бо/],
  ['Готовая еда', 'salad', /салат (?!лист)|винегрет|оливье|цезарь|шуба/],
  ['Готовая еда', 'canned', /тушёнк|тушенк|паштет/],

  // --- Baked goods
  ['Выпечка', 'cake', /торт|пирожное|эклер|чизкейк|тирамису|наполеон|медовик/],
  ['Выпечка', 'pie', /пирог|пирожк|пирожок|чебурек|беляш|самса|хачапури|ватрушк|кулебяк|штрудел/],
  ['Выпечка', 'pancakes', /блин|оладь|оладуш|сырник|панкейк/],
  ['Выпечка', 'waffle', /вафл/],
  ['Выпечка', 'croissant', /круассан|слойк/],
  ['Выпечка', 'baguette', /багет|чиабат/],
  ['Выпечка', 'bagel', /бублик|бейгл|баранк/],
  ['Выпечка', 'cupcake', /кекс|маффин|капкейк/],
  ['Выпечка', 'doughnut', /пончик|донат/],

  // --- Eggs, seafood, fish, poultry, meat
  ['Яйца', 'friedEgg', /яичниц|омлет|глазун/],
  ['Яйца', 'egg', /яйц|яичн/],
  ['Морепродукты', 'shrimp', /кревет/],
  ['Морепродукты', 'lobster', /лобстер|омар|лангуст|рак(?![а-яё])|раки/],
  ['Морепродукты', 'octopus', /осьминог/],
  ['Морепродукты', 'squid', /кальмар|каракатиц/],
  ['Морепродукты', 'crab', /краб/],
  ['Морепродукты', 'oyster', /мидии|гребеш|устриц/],
  ['Морепродукты', 'caviar', /икра/],
  ['Рыба', 'fish', /минтай|треск|хек|судак|камбал|тилапи|сибас|дорадо|тунец|горбуш|кет[аы](?![а-яё])|форел|лосос|с[её]мг|щук|сельд(?!ер)|сел[её]дк|скумбри|карп|окун|кильк|шпрот|сардин|анчоус|навага|пикш|палтус|нерк|чавыч|кижуч|сом(?![а-яё])|рыб/],
  ['Птица', 'poultry', /кур[иы]|куриц|бройлер|цыпл|перепел|утк|утин|гус|индей/],
  ['Мясо', 'sausage', /сосис|сардельк|колбас|купат|шпикачк/],
  ['Мясо', 'meatBone', /ветчин|буженин|салями|карбонад|рёбр|ребр|хамон|бастурм|окорок копч/],
  ['Мясо', 'bacon', /грудинка|бекон|сало(?![а-яё])/],
  ['Мясо', 'steak', /говяд|говяж|свинин|телятин|конин|баранин|ягнят|ягн[её]н|козлятин|кролик|крольч|оленин|лосятин|кабан|дичь|фарш|печень|почки|язык|сердц|вырезк|стейк|мяс/],

  // --- Dairy
  ['Сладкое и спортпит', 'iceCream', /морожен|пломбир|эскимо|сорбет|джелато/],
  ['Молочное', 'cheese', /сыр(?!оеж|ник)|брынз|моцарел|пармезан|фет[аы](?![а-яё])/],
  ['Молочное', 'milk', /молок|кефир|йогурт|сметан|творог|ряженк|сливк|простокваш|айран|кумыс|ацидофил|снежок|варенец|(^|[^а-яё])тан(?![а-яё])/],

  // --- Grains and bread
  ['Крупы и хлеб', 'rice', W('рис')],
  ['Крупы и хлеб', 'porridge', /овсян|хлопь|каш|мюсли|гранол/],
  ['Крупы и хлеб', 'pasta', /макарон|спагет|лапш|вермишел|фунчоз|(^|[^а-яё])паст[аы](?![а-яё])/],
  ['Крупы и хлеб', 'beans', /чечевиц|фасоль(?! стручк)|(^|[^а-яё])нут(?![а-яё])|горох(?!.*консерв)|соя(?![а-яё])|маш(?![а-яё])/],
  ['Крупы и хлеб', 'flatbread', /лаваш|лепёшк|лепешк|пита(?![а-яё])/],
  ['Крупы и хлеб', 'taco', /тортиль/],                 // 🌯 looks like a pie on iPhone
  ['Крупы и хлеб', 'bread', /хлеб|батон(?!чик)|булк|хлебц/],
  ['Крупы и хлеб', 'grain', /греч|булгур|киноа|перлов|пш[её]н|кус-кус|кускус|манк|ячн|мука|отруб/],

  // --- Vegetables, greens, mushrooms
  ['Овощи', 'sweetPotato', /батат/],
  ['Овощи', 'potato', /картоф/],
  ['Овощи', 'carrot', /морков/],
  ['Зелень и грибы', 'herbs', /лук зел[её]н|укроп|петрушк|кинз|базилик|щавел|шпинат|руккол|мят[аы]|розмарин|тимьян|эстрагон|черемш/],
  ['Овощи', 'onion', /лук|порей|шалот/],
  ['Овощи', 'garlic', /чеснок/],
  ['Овощи', 'ginger', /имбир/],
  ['Овощи', 'cucumber', /огур|кабач|цукин|патиссон/],
  ['Овощи', 'tomato', /помидор|томат/],
  ['Овощи', 'hotPepper', /чили|остр\S* перец|халапен/],
  ['Овощи', 'pepper', /перец/],
  ['Овощи', 'eggplant', /баклажан/],
  ['Овощи', 'pumpkin', /тыкв(?!енн)/],
  ['Овощи', 'broccoli', /брокколи|капуста цветн|романеско/],
  ['Овощи', 'cabbage', /капуст|сельдере|спарж/],
  ['Овощи', 'avocado', /авокадо/],
  ['Овощи', 'peas', /горош|фасоль стручк|эдамам/],
  ['Овощи', 'corn', /кукуруз/],
  ['Зелень и грибы', 'cabbage', /салат/],
  ['Зелень и грибы', 'seedling', /микрозел|ростк|проросш/],
  ['Зелень и грибы', 'mushroom', /гриб|шампиньон|вешенк|лисичк|опят|маслят|сыроеж|грузд|подбер|подосин|шиитаке|рыжик|трюфел/],
  ['Овощи', 'salad', /овощ|св[её]кл|редис|редьк|(^|[^а-яё])реп[аы](?![а-яё])|хрен|пастернак|топинамбур|дайкон/],

  // --- Fruits, berries, dried fruits (juice first: "lemon juice" is juice)
  ['Напитки', 'juice', /сок(?![а-яё])|нектар|морс|компот|смузи/],
  ['Сухофрукты', 'grapes', /изюм/],
  ['Сухофрукты', 'peach', /кураг/],
  ['Сухофрукты', 'berries', /черносл|финик|инжир сушен|сухофрукт/],
  ['Фрукты', 'apple', /яблок/],
  ['Фрукты', 'pear', /груш|айв/],
  ['Фрукты', 'peach', /абрикос|персик|нектарин|слив|алыч|хурм/],
  ['Фрукты', 'cherry', /вишн|черешн/],
  ['Фрукты', 'grapes', /виноград/],
  ['Фрукты', 'watermelon', /арбуз/],
  ['Фрукты', 'melon', /дын/],
  ['Фрукты', 'banana', /банан/],
  ['Фрукты', 'orange', /апельсин|мандарин|грейпфрут|помело/],
  ['Фрукты', 'lime', /лайм/],
  ['Фрукты', 'lemon', /лимон/],
  ['Фрукты', 'pineapple', /ананас/],
  ['Фрукты', 'mango', /манго/],
  ['Фрукты', 'kiwi', /киви|фейхоа/],
  ['Ягоды', 'strawberry', /клубник|землян/],
  ['Ягоды', 'berries', /малин|смородин|крыжов|черник|голубик|брусник|клюкв|облепих|ежевик|жимолост|шиповник|ирг|ягод/],

  // --- Nuts
  ['Орехи и семечки', 'peanut', /арахис/],
  ['Орехи и семечки', 'coconut', /кокос/],
  ['Орехи и семечки', 'seeds', /семечк|семен|кунжут|чиа(?![а-яё])/],
  ['Орехи и семечки', 'nut', /орех|фундук|миндал|кешью|фисташ|пекан|макадам/],

  // --- Sweets and sports nutrition
  ['Сладкое и спортпит', 'pill', /витамин|омега|креатин|bcaa|аминокисл|рыбий жир|коллаген|л-карнитин/],
  ['Сладкое и спортпит', 'chocolate', /батончик|шоколад/],
  ['Сладкое и спортпит', 'shake', /протеин|гейнер/],
  ['Сладкое и спортпит', 'honey', W('м[её]д')],
  ['Сладкое и спортпит', 'custard', /пудинг|десерт|желе|панакот|суфле|крем-брюле/],
  ['Сладкое и спортпит', 'lollipop', /карамел|леденц|чупа/],
  ['Сладкое и спортпит', 'candy', /сахар|конфет|варень|джем|повидл|зефир|пастил|мармелад|халв|козинак|сироп/],

  // --- Drinks and alcohol
  ['Напитки', 'beer', /пиво|квас/],
  ['Напитки', 'greenApple', /сидр/],
  ['Напитки', 'champagne', /шампан|игрист|просекко|ламбруск/],
  ['Напитки', 'wine', /вино|глинтвейн/],
  ['Напитки', 'martini', /вермут|мартини/],
  ['Напитки', 'cocktail', /коктейл|мохито/],
  ['Напитки', 'sake', /саке/],
  ['Напитки', 'spirits', /водк|коньяк|виски|(^|[^а-яё])ром(?![а-яё])|(^|[^а-яё])джин(?![а-яё])|текил|бренди|настойк|ликер|ликёр|самогон|чач|абсент|бальзам/],
  ['Напитки', 'shake', /лимонад|газиров|кола(?![а-яё])|тоник|энергетик|спрайт|фант/],
  ['Напитки', 'bubbleTea', /бабл/],
  ['Напитки', 'mate', /мате(?![а-яё])/],
  ['Напитки', 'tea', /чай|чая(?![а-яё])/],
  ['Напитки', 'coffee', /кофе|какао|капучин|латте|эспрессо|американо/],
  ['Напитки', 'water', /вода|минерал/],

  // --- At the very end: canned goods not caught by the rules above
  ['Другое', 'canned', /консерв/],
];

/** Category and icon by product name */
export function classify(name) {
  const n = name.toLowerCase();
  for (const [category, icon, pattern] of RULES) {
    if (pattern.test(n)) return { category, icon };
  }
  return { category: 'Другое', icon: DEFAULT_ICON };
}

/** Category by icon — for products with an unrecognized name but a manually chosen icon */
const ICON_CATEGORY = {};
for (const [category, key] of RULES) ICON_CATEGORY[key] ??= category;
// Icons with no name-based rules
Object.assign(ICON_CATEGORY, {
  tropicalFish: 'Рыба', blowfish: 'Рыба', shark: 'Рыба',
  friedShrimp: 'Морепродукты', shell: 'Морепродукты', fishCake: 'Морепродукты', babyBottle: 'Молочное',
  riceBall: 'Крупы и хлеб', riceCracker: 'Крупы и хлеб', fondue: 'Готовая еда', tamale: 'Готовая еда',
  oden: 'Готовая еда', bento: 'Готовая еда', takeout: 'Готовая еда', fortune: 'Выпечка',
  shamrock: 'Зелень и грибы', clover: 'Зелень и грибы', brownMushroom: 'Зелень и грибы',
  birthdayCake: 'Выпечка', softIce: 'Сладкое и спортпит', shavedIce: 'Сладкое и спортпит',
  dango: 'Сладкое и спортпит', mooncake: 'Выпечка', ice: 'Напитки', teapot: 'Напитки',
  beers: 'Напитки', bottle: 'Напитки',
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
  if (category !== 'Другое' || !product?.icon) return category;
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
