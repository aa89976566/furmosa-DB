/** ProductCategory — platform product type (not snack subcategory `Product.category`). */
export const PRODUCT_CATEGORIES = [
  'STANDARD',
  'JAR_EXCHANGE',
  'SERVICE',
  'VOUCHER',
  'DONATION',
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

/**
 * 換罐計劃的唯一判定規則：只看 Product.productCategory === 'JAR_EXCHANGE'。
 * 不可用店家類型、店名、商品名稱或 SKU 前綴推斷，避免規則分散與歷史資料誤判。
 */
export function isJarExchangeProductCategory(
  category: string | null | undefined,
): boolean {
  return category === 'JAR_EXCHANGE';
}

/**
 * 給 HQ / POS 顯示用的計劃標籤。
 * 一般商品不顯示計劃標籤；換罐商品統一顯示「換罐計劃」。
 */
export function productProgramLabel(
  category: string | null | undefined,
): '換罐計劃' | null {
  return isJarExchangeProductCategory(category) ? '換罐計劃' : null;
}

export function isProductCategory(value: string): value is ProductCategory {
  return (PRODUCT_CATEGORIES as readonly string[]).includes(value);
}

/** 店家補貨單可申請的商品：寄賣零食與換罐口味。 */
export function isRestockableProductCategory(
  category: string | null | undefined,
): boolean {
  return isJarExchangeProductCategory(category) || category === 'STANDARD';
}
