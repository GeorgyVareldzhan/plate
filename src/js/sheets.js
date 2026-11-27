/**
 * Sheets shared by screens (mounted once in App.vue). Each sheet component registers its
 * open() here when mounted; screens call the functions below.
 */
export const sheets = { account: null, picker: null, product: null };

export const openAccount = () => sheets.account();

/** options: { title, onProduct(product), dishes?: [...], onDish?(dish) } */
export const openPicker = (options) => sheets.picker(options);

/**
 * Open the product card (product = null — new product). Resolves with the saved product,
 * { deleted: true }, or null on cancel.
 */
export const openProductDialog = (product = null, prefill = {}) => sheets.product(product, prefill);
