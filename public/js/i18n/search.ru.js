/**
 * Russian search rules.
 *
 * normalizeSearch: case-insensitive, and the letters "yo" and "ye" (ё / е) are the same
 * letter, as Russian readers expect. The length of the text does not change, so positions in
 * the normalized text match the original (used for highlighting).
 *
 * SYNONYMS: words that name the same product but don't share a root closely enough to be
 * found as word forms ("говядина" / "говяжий"). Word forms ("курица" / "куриная",
 * "яйца" / "яйцо") are handled by the search itself.
 */
export const normalizeSearch = (text) => text.toLowerCase().replace(/ё/g, 'е');

export const SYNONYMS = [
  ['курица', 'куриный', 'цыпленок', 'цыплята', 'бройлер'],
  ['говядина', 'говяжий', 'телятина'],
  ['свинина', 'свиной'],
  ['баранина', 'бараний', 'ягненок'],
  ['конина', 'конский'],
  ['индейка', 'индюшачий'],
  ['утка', 'утиный'],
  ['яйцо', 'яичный'],
  ['картофель', 'картошка', 'картофельный'],
  ['помидор', 'томат', 'томатный'],
  ['молоко', 'молочный'],
  ['творог', 'творожный'],
  ['рыба', 'рыбный'],
  ['гриб', 'грибной'],
  ['гречка', 'гречневый'],
  ['овсянка', 'овсяный'],
  ['сосиска', 'сарделька'],
  ['колбаса', 'сервелат', 'колбаска'],
  ['сало', 'шпик'],
  ['фарш', 'рубленый'],
];
