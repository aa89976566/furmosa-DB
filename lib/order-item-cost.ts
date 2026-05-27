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
