/**
 * Words that mark nutrition values on a product label. Labels are matched in Russian and
 * English regardless of the UI language. Text is lower-cased and "yo" is folded to "ye"
 * before matching (see normalizeSearch).
 */
export const LABEL_WORDS = {
  protein: /белк|белок|protein/,
  fat: /жир|(^|[^a-z])fats?(?![a-z])/,
  carbs: /углевод|carbohydrate|carbs/,
  // Energy value: "энергетическая ценность 1046 кДж / 250 ккал", "калорийность: 250"
  energy: /калорийн|энергетическ\S* ценност|energy/,
};

/** Units right after a number */
export const KCAL_UNIT = /^\s*(ккал|kcal)/;
export const KJ_UNIT = /^\s*(кдж|kj)/;
// Words before a portion size: "на 100 г", "per 100 g" — that number is not a value
export const PORTION_BEFORE = /(^|[^а-яa-z])(на|в|per|in)\s*$/;
export const WEIGHT_UNIT = /^\s*(г|g|мл|ml)(?![а-яa-z])/;
