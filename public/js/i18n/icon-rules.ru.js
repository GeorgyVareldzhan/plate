/**
 * Icon and category matching rules for Russian product names.
 *
 * Each rule is [category id, icon key, name pattern]; rules are checked top to bottom and the
 * first match wins. Products in the starter list are Russian, so these patterns are Russian;
 * rules for another language can live next to this file and be added to icons.js.
 */
// Whole word: \b in JS doesn't work with Cyrillic
const W = (re) => new RegExp(`(^|[^а-яё])(${re})(?![а-яё])`);

/** [category, icon, name pattern] — checked top to bottom */
export const RULES = [
  // --- First, things that more general rules would otherwise catch
  ['bakery', 'cookie', /^(?!.*(батончик|сывороточн|изолят|казеин)).*печенье/],      // before "liver"; "bar, Cookies & cream flavour" is a bar
  ['sweets', 'jar', /^(?!.*батончик).*(nutella|нутелл|топпинг|орехов\S* паст|паст\S* .*орехов)/],   // before "paste/pasta"
  ['sweets', 'cookie', /oreo|choco pie|cookie/],
  ['sweets', 'candy', /raffaello|ferrero|toffifee|m&m|skittles|мишка косолап|белочк|птичье молоко|коровк|рот фронт|красная шапочк|грильяж|ласточк/],
  // Protein powders (before brands: Bombbar has both bars and powders)
  ['sweets', 'shake', /^(?!.*(батончик|протеинов\S* печенье|панкейк|шоколад без)).*(протеин|изолят|казеин|whey)/],
  ['sweets', 'chocolate', /^(?!.*(панкейк|вафл)).*(snickers|twix|mars(?![a-z])|bounty|milky way|kitkat|kinder|alpen gold|bombbar|snaq fabriq)/],
  ['snacks', 'bacon', /мясн\S* чипс|джерки/],
  ['snacks', 'chips', /чипс|начос/],
  ['snacks', 'popcorn', /попкорн/],
  ['snacks', 'pretzel', /сухари|крекер|гренк|сушк/],
  ['snacks', 'squid', /кальмар\S* суш|сушен\S* кальмар/],
  ['snacks', 'fish', /вобл|вялен|сушен\S* рыб|рыб\S* суш/],
  ['snacks', 'cheese', /косичк/],
  ['snacks', 'peanut', /арахис\S* жарен|солен\S* арахис/],
  ['snacks', 'seeds', /семечки жарен/],
  ['oilsSauces', 'salt', /соль|специ|приправ|паприк|куркум|корица|молот\S* перец|перец молот/],
  ['oilsSauces', 'butter', /масло сливоч|масло топл|спред|маргарин/],
  ['vegetables', 'olive', /маслин|оливк/],                     // before "oil/butter"
  ['oilsSauces', 'oil', /масло/],
  ['oilsSauces', 'jar', /майонез|соус|горчиц|хрен|аджик|песто|ткемали|сметанн\S* соус/],
  ['oilsSauces', 'tomato', /кетчуп|томатн\S* паст/],

  // --- Ready meals (before meat and fish: "pork dumplings" are dumplings)
  ['readyMeals', 'dumpling', /пельмен|вареник|манты|хинкал|равиол|гедза|дамплинг/],
  ['readyMeals', 'pizza', /пицц/],
  ['readyMeals', 'burger', /бургер/],
  ['readyMeals', 'shawarma', /шаурм|шаверм|донер|гирос|кебаб/],
  ['readyMeals', 'sandwich', /бутерброд|сэндвич|сендвич|тост/],
  ['readyMeals', 'sausage', /хот-?дог/],
  ['readyMeals', 'taco', /тако(?![а-яё])|буррито|кесадиль/],
  ['readyMeals', 'falafel', /фалафел|котлет|тефтел|фрикадел/],
  ['readyMeals', 'caviar', /суши|ролл(?!тон)|сашими/],
  ['readyMeals', 'soup', W('суп|борщ|щи|уха|солянк\\S*|бульон|рассольник|окрошк\\S*|харчо')],
  ['readyMeals', 'stew', /плов|рагу|жаркое|^гуляш|азу(?![а-яё])/],
  ['readyMeals', 'curry', /карри/],
  ['readyMeals', 'noodles', /рамен|удон|доширак|роллтон|лапша быстр|фо бо/],
  ['readyMeals', 'salad', /салат (?!лист)|винегрет|оливье|цезарь|шуба/],
  ['readyMeals', 'canned', /тушёнк|тушенк|паштет/],

  // --- Baked goods
  ['bakery', 'cake', /торт|пирожное|эклер|чизкейк|тирамису|наполеон|медовик/],
  ['bakery', 'pie', /пирог|пирожк|пирожок|чебурек|беляш|самса|хачапури|ватрушк|кулебяк|штрудел/],
  ['bakery', 'pancakes', /блин|оладь|оладуш|сырник|панкейк/],
  ['bakery', 'waffle', /вафл/],
  ['bakery', 'croissant', /круассан|слойк/],
  ['bakery', 'baguette', /багет|чиабат/],
  ['bakery', 'bagel', /бублик|бейгл|баранк/],
  ['bakery', 'cupcake', /кекс|маффин|капкейк/],
  ['bakery', 'doughnut', /пончик|донат/],

  // --- Eggs, seafood, fish, poultry, meat
  ['eggs', 'friedEgg', /яичниц|омлет|глазун/],
  ['eggs', 'egg', /яйц|яичн/],
  ['seafood', 'shrimp', /кревет/],
  ['seafood', 'lobster', /лобстер|омар|лангуст|рак(?![а-яё])|раки/],
  ['seafood', 'octopus', /осьминог/],
  ['seafood', 'squid', /кальмар|каракатиц/],
  ['seafood', 'crab', /краб/],
  ['seafood', 'oyster', /мидии|гребеш|устриц/],
  ['seafood', 'caviar', /икра/],
  ['fish', 'fish', /минтай|треск|хек|судак|камбал|тилапи|сибас|дорадо|тунец|горбуш|кет[аы](?![а-яё])|форел|лосос|с[её]мг|щук|сельд(?!ер)|сел[её]дк|скумбри|карп|окун|кильк|шпрот|сардин|анчоус|навага|пикш|палтус|нерк|чавыч|кижуч|сом(?![а-яё])|рыб/],
  ['poultry', 'poultry', /кур[иы]|куриц|бройлер|цыпл|перепел|утк|утин|гус|индей/],
  ['meat', 'sausage', /сосис|сардельк|колбас|купат|шпикачк/],
  ['meat', 'meatBone', /ветчин|буженин|салями|карбонад|рёбр|ребр|хамон|бастурм|окорок копч/],
  ['meat', 'bacon', /грудинка|бекон|сало(?![а-яё])/],
  ['meat', 'steak', /говяд|говяж|свинин|телятин|конин|баранин|ягнят|ягн[её]н|козлятин|кролик|крольч|оленин|лосятин|кабан|дичь|фарш|печень|почки|язык|сердц|вырезк|стейк|мяс/],

  // --- Dairy
  ['sweets', 'iceCream', /морожен|пломбир|эскимо|сорбет|джелато/],
  ['dairy', 'cheese', /сыр(?!оеж|ник)|брынз|моцарел|пармезан|фет[аы](?![а-яё])/],
  ['dairy', 'milk', /молок|кефир|йогурт|сметан|творог|ряженк|сливк|простокваш|айран|кумыс|ацидофил|снежок|варенец|(^|[^а-яё])тан(?![а-яё])/],

  // --- Grains and bread
  ['grains', 'rice', W('рис')],
  ['grains', 'porridge', /овсян|хлопь|каш|мюсли|гранол/],
  ['grains', 'pasta', /макарон|спагет|лапш|вермишел|фунчоз|(^|[^а-яё])паст[аы](?![а-яё])/],
  ['grains', 'beans', /чечевиц|фасоль(?! стручк)|(^|[^а-яё])нут(?![а-яё])|горох(?!.*консерв)|соя(?![а-яё])|маш(?![а-яё])/],
  ['grains', 'flatbread', /лаваш|лепёшк|лепешк|пита(?![а-яё])/],
  ['grains', 'taco', /тортиль/],                 // 🌯 looks like a pie on iPhone
  ['grains', 'bread', /хлеб|батон(?!чик)|булк|хлебц/],
  ['grains', 'grain', /греч|булгур|киноа|перлов|пш[её]н|кус-кус|кускус|манк|ячн|мука|отруб/],

  // --- Vegetables, greens, mushrooms
  ['vegetables', 'sweetPotato', /батат/],
  ['vegetables', 'potato', /картоф/],
  ['vegetables', 'carrot', /морков/],
  ['greens', 'herbs', /лук зел[её]н|укроп|петрушк|кинз|базилик|щавел|шпинат|руккол|мят[аы]|розмарин|тимьян|эстрагон|черемш/],
  ['vegetables', 'onion', /лук|порей|шалот/],
  ['vegetables', 'garlic', /чеснок/],
  ['vegetables', 'ginger', /имбир/],
  ['vegetables', 'cucumber', /огур|кабач|цукин|патиссон/],
  ['vegetables', 'tomato', /помидор|томат/],
  ['vegetables', 'hotPepper', /чили|остр\S* перец|халапен/],
  ['vegetables', 'pepper', /перец/],
  ['vegetables', 'eggplant', /баклажан/],
  ['vegetables', 'pumpkin', /тыкв(?!енн)/],
  ['vegetables', 'broccoli', /брокколи|капуста цветн|романеско/],
  ['vegetables', 'cabbage', /капуст|сельдере|спарж/],
  ['vegetables', 'avocado', /авокадо/],
  ['vegetables', 'peas', /горош|фасоль стручк|эдамам/],
  ['vegetables', 'corn', /кукуруз/],
  ['greens', 'cabbage', /салат/],
  ['greens', 'seedling', /микрозел|ростк|проросш/],
  ['greens', 'mushroom', /гриб|шампиньон|вешенк|лисичк|опят|маслят|сыроеж|грузд|подбер|подосин|шиитаке|рыжик|трюфел/],
  ['vegetables', 'salad', /овощ|св[её]кл|редис|редьк|(^|[^а-яё])реп[аы](?![а-яё])|хрен|пастернак|топинамбур|дайкон/],

  // --- Fruits, berries, dried fruits (juice first: "lemon juice" is juice)
  ['drinks', 'juice', /сок(?![а-яё])|нектар|морс|компот|смузи/],
  ['driedFruits', 'grapes', /изюм/],
  ['driedFruits', 'peach', /кураг/],
  ['driedFruits', 'berries', /черносл|финик|инжир сушен|сухофрукт/],
  ['fruits', 'apple', /яблок/],
  ['fruits', 'pear', /груш|айв/],
  ['fruits', 'peach', /абрикос|персик|нектарин|слив|алыч|хурм/],
  ['fruits', 'cherry', /вишн|черешн/],
  ['fruits', 'grapes', /виноград/],
  ['fruits', 'watermelon', /арбуз/],
  ['fruits', 'melon', /дын/],
  ['fruits', 'banana', /банан/],
  ['fruits', 'orange', /апельсин|мандарин|грейпфрут|помело/],
  ['fruits', 'lime', /лайм/],
  ['fruits', 'lemon', /лимон/],
  ['fruits', 'pineapple', /ананас/],
  ['fruits', 'mango', /манго/],
  ['fruits', 'kiwi', /киви|фейхоа/],
  ['berries', 'strawberry', /клубник|землян/],
  ['berries', 'berries', /малин|смородин|крыжов|черник|голубик|брусник|клюкв|облепих|ежевик|жимолост|шиповник|ирг|ягод/],

  // --- Nuts
  ['nuts', 'peanut', /арахис/],
  ['nuts', 'coconut', /кокос/],
  ['nuts', 'seeds', /семечк|семен|кунжут|чиа(?![а-яё])/],
  ['nuts', 'nut', /орех|фундук|миндал|кешью|фисташ|пекан|макадам/],

  // --- Sweets and sports nutrition
  ['sweets', 'pill', /витамин|омега|креатин|bcaa|аминокисл|рыбий жир|коллаген|л-карнитин/],
  ['sweets', 'chocolate', /батончик|шоколад/],
  ['sweets', 'shake', /протеин|гейнер/],
  ['sweets', 'honey', W('м[её]д')],
  ['sweets', 'custard', /пудинг|десерт|желе|панакот|суфле|крем-брюле/],
  ['sweets', 'lollipop', /карамел|леденц|чупа/],
  ['sweets', 'candy', /сахар|конфет|варень|джем|повидл|зефир|пастил|мармелад|халв|козинак|сироп/],

  // --- Drinks and alcohol
  ['drinks', 'beer', /пиво|квас/],
  ['drinks', 'greenApple', /сидр/],
  ['drinks', 'champagne', /шампан|игрист|просекко|ламбруск/],
  ['drinks', 'wine', /вино|глинтвейн/],
  ['drinks', 'martini', /вермут|мартини/],
  ['drinks', 'cocktail', /коктейл|мохито/],
  ['drinks', 'sake', /саке/],
  ['drinks', 'spirits', /водк|коньяк|виски|(^|[^а-яё])ром(?![а-яё])|(^|[^а-яё])джин(?![а-яё])|текил|бренди|настойк|ликер|ликёр|самогон|чач|абсент|бальзам/],
  ['drinks', 'shake', /лимонад|газиров|кола(?![а-яё])|тоник|энергетик|спрайт|фант/],
  ['drinks', 'bubbleTea', /бабл/],
  ['drinks', 'mate', /мате(?![а-яё])/],
  ['drinks', 'tea', /чай|чая(?![а-яё])/],
  ['drinks', 'coffee', /кофе|какао|капучин|латте|эспрессо|американо/],
  ['drinks', 'water', /вода|минерал/],

  // --- At the very end: canned goods not caught by the rules above
  ['other', 'canned', /консерв/],
];
