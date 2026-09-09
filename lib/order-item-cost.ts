/** 訂單明細用：由商品／規格解析進貨成本 */
export type OrderItemCostProduct = {
  cost: number;
  priceTiers: Array<{
    id: string;
    cost: number | null;
  }>;
};

export function resolveOrderItemUnitCost(
  product: OrderItemCostProduct,
  tierId?: string | null,
): number {
  if (tierId) {
    const tier = product.priceTiers.find((t) => t.id === tierId);
    if (tier?.cost != null && Number.isFinite(tier.cost)) {
      return tier.cost;
    }
  }
  return Number.isFinite(product.cost) ? product.cost : 0;
}

/** 新增客戶訂單用：單價一律由商品主檔／所選規格取得。 */
export type OrderItemPriceProduct = {
  price: number;
  priceTiers: Array<{
    id: string;
    price: number;
  }>;
};

export function resolveOrderItemUnitPrice(
  product: OrderItemPriceProduct,
  tierId?: string | null,
): number {
  if (tierId) {
    const tier = product.priceTiers.find((candidate) => candidate.id === tierId);
    if (tier && Number.isFinite(tier.price)) return Math.max(0, tier.price);
  }
  return Number.isFinite(product.price) ? Math.max(0, product.price) : 0;
}
