/**
 * Search normalization for Russian text: case-insensitive, and the letters "yo" and "ye"
 * (ё / е) are treated as the same letter, as Russian readers expect.
 */
export const normalizeSearch = (text) => text.toLowerCase().replace(/ё/g, 'е');
