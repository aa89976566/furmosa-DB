import { isRestockableProductCategory } from '@/lib/product-category';

export type MerchantRestockEligibilityProduct = {
  id: string;
  status: string;
  productCategory: string;
};

/** 與補貨目錄相同：這家店的庫存列或寄賣規則都算店內資格。 */
export function buildMerchantRestockInStoreIds(
  stocks: Array<{ productId: string }>,
  rules: Array<{ productId: string }>,
): Set<string> {
  const ids = new Set<string>();
  for (const row of stocks) ids.add(row.productId);
  for (const row of rules) ids.add(row.productId);
  return ids;
}

/**
 * 與 listMerchantRestockCatalog 同一套資格：
 * 啟用中的 JAR_EXCHANGE；啟用中的 STANDARD 且這家店有庫存列或寄賣規則。
 */
export function isMerchantRestockCatalogEligible(
  product: MerchantRestockEligibilityProduct | null | undefined,
  inStoreProductIds: Set<string>,
): boolean {
  if (!product || product.status !== 'active') return false;
  if (!isRestockableProductCategory(product.productCategory)) return false;
  if (product.productCategory === 'JAR_EXCHANGE') return true;
  return inStoreProductIds.has(product.id);
}

export type MerchantRestockSubmitEligibility =
  | { ok: true }
  | { ok: false; reason: 'missing' | 'ineligible' };

export function merchantRestockSubmitEligibility(
  productIds: string[],
  products: MerchantRestockEligibilityProduct[],
  inStoreProductIds: Set<string>,
): MerchantRestockSubmitEligibility {
  const uniqueIds = [...new Set(productIds)];
  const byId = new Map(products.map((product) => [product.id, product]));
  for (const id of uniqueIds) {
    const product = byId.get(id);
    if (!product) return { ok: false, reason: 'missing' };
    if (!isMerchantRestockCatalogEligible(product, inStoreProductIds)) {
      return { ok: false, reason: 'ineligible' };
    }
  }
  return { ok: true };
}
