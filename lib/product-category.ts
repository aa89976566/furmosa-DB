/** ProductCategory — platform product type (not snack subcategory `Product.category`). */
export const PRODUCT_CATEGORIES = [
  'STANDARD',
  'JAR_EXCHANGE',
  'SERVICE',
  'VOUCHER',
  'DONATION',
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export function isProductCategory(value: string): value is ProductCategory {
  return (PRODUCT_CATEGORIES as readonly string[]).includes(value);
}

export function isJarExchangeProductCategory(
  category: string | null | undefined,
): boolean {
  return category === 'JAR_EXCHANGE';
}
