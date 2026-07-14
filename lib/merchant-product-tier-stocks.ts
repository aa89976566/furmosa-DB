import {
  isMultiWeightProduct,
  LEGACY_MERCHANT_STOCK_TIER_ID,
  weightTiersForProduct,
} from '@/lib/merchant-stock-key';
import {
  pickDefaultTier,
  tierSpecLabel,
  type MerchantProductTierOption,
} from '@/lib/merchant-product-tier';

export type MerchantProductTierStock = {
  tierId: string;
  label: string;
  quantity: number;
};

export function toMerchantProductTierOptions(
  tiers: {
    id: string;
    weightGrams: number | null;
    unit: string;
    unitQty: number;
    price: number;
    notes: string | null;
  }[],
): MerchantProductTierOption[] {
  return tiers.map((tier) => ({
    id: tier.id,
    weightGrams: tier.weightGrams,
    unit: tier.unit,
    unitQty: tier.unitQty,
    price: tier.price,
    notes: tier.notes,
  }));
}

/**
 * 店家庫存顯示：只列出該店「有庫存紀錄」的規格列。
 * - 多規格商品不預先列出未進貨的規格
 * - 舊版未分規格（tierId=''）單獨顯示，避免合計與各規格 0 不一致
 */
export function buildMerchantProductTierStocks(
  productId: string,
  priceTiers: MerchantProductTierOption[],
  stocks: { productId: string; tierId: string; quantity: number }[],
): { tierStocks: MerchantProductTierStock[]; totalQuantity: number } {
  const productStocks = stocks.filter((s) => s.productId === productId);

  if (!isMultiWeightProduct(priceTiers)) {
    const defaultTier = pickDefaultTier(priceTiers);
    const totalQuantity = productStocks.reduce((sum, s) => sum + s.quantity, 0);
    const primary =
      productStocks.find((s) => s.tierId === (defaultTier?.id ?? LEGACY_MERCHANT_STOCK_TIER_ID)) ??
      productStocks.find((s) => s.tierId === LEGACY_MERCHANT_STOCK_TIER_ID) ??
      productStocks[0];

    return {
      totalQuantity,
      tierStocks: [
        {
          tierId: primary?.tierId ?? defaultTier?.id ?? LEGACY_MERCHANT_STOCK_TIER_ID,
          label: tierSpecLabel(defaultTier) ?? '預設',
          quantity: totalQuantity,
        },
      ],
    };
  }

  const tierStockById = new Map(
    productStocks
      .filter((s) => s.tierId !== LEGACY_MERCHANT_STOCK_TIER_ID)
      .map((s) => [s.tierId, s]),
  );
  const legacyStock = productStocks.find((s) => s.tierId === LEGACY_MERCHANT_STOCK_TIER_ID);

  const tierStocks: MerchantProductTierStock[] = [];

  for (const tier of weightTiersForProduct(priceTiers)) {
    const stock = tierStockById.get(tier.id);
    if (!stock) continue;
    const fullTier = priceTiers.find((t) => t.id === tier.id) ?? null;
    tierStocks.push({
      tierId: tier.id,
      label: tierSpecLabel(fullTier) ?? '規格',
      quantity: stock.quantity,
    });
  }

  if (legacyStock) {
    tierStocks.push({
      tierId: LEGACY_MERCHANT_STOCK_TIER_ID,
      label: '未分規格',
      quantity: legacyStock.quantity,
    });
  }

  const totalQuantity = tierStocks.reduce((sum, row) => sum + row.quantity, 0);

  return { tierStocks, totalQuantity };
}
