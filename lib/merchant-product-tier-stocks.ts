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
 * 店家庫存顯示：多重量商品列出所有正式規格，尚未建庫存列的規格顯示為 0。
 * - 多規格／單規格都按規格拆開，不加總混寫
 * - 舊版未分規格（tierId=''）單獨顯示
 */
export function buildMerchantProductTierStocks(
  productId: string,
  priceTiers: MerchantProductTierOption[],
  stocks: { productId: string; tierId: string; quantity: number }[],
): { tierStocks: MerchantProductTierStock[]; totalQuantity: number } {
  const productStocks = stocks.filter((s) => s.productId === productId);

  if (productStocks.length === 0) {
    if (isMultiWeightProduct(priceTiers)) {
      return {
        totalQuantity: 0,
        tierStocks: weightTiersForProduct(priceTiers).map((tier) => {
          const fullTier = priceTiers.find((candidate) => candidate.id === tier.id) ?? null;
          return {
            tierId: tier.id,
            label: tierSpecLabel(fullTier) ?? '規格',
            quantity: 0,
          };
        }),
      };
    }
    const defaultTier = pickDefaultTier(priceTiers);
    return {
      totalQuantity: 0,
      tierStocks: [
        {
          tierId: defaultTier?.id ?? LEGACY_MERCHANT_STOCK_TIER_ID,
          label: tierSpecLabel(defaultTier) ?? '預設',
          quantity: 0,
        },
      ],
    };
  }

  // 有多筆實際庫存列時，逐列顯示（避免加總顯示卻只寫回一列）
  if (productStocks.length > 1 || isMultiWeightProduct(priceTiers)) {
    const tierStockById = new Map(
      productStocks
        .filter((s) => s.tierId !== LEGACY_MERCHANT_STOCK_TIER_ID)
        .map((s) => [s.tierId, s]),
    );
    const legacyStock = productStocks.find((s) => s.tierId === LEGACY_MERCHANT_STOCK_TIER_ID);

    const tierStocks: MerchantProductTierStock[] = [];

    for (const tier of weightTiersForProduct(priceTiers)) {
      const stock = tierStockById.get(tier.id);
      const fullTier = priceTiers.find((t) => t.id === tier.id) ?? null;
      tierStocks.push({
        tierId: tier.id,
        label: tierSpecLabel(fullTier) ?? '規格',
        quantity: stock?.quantity ?? 0,
      });
    }

    // 非克數規格（例如「片」）或其他未列入 weightTiers 的列
    for (const stock of productStocks) {
      if (stock.tierId === LEGACY_MERCHANT_STOCK_TIER_ID) continue;
      if (tierStocks.some((row) => row.tierId === stock.tierId)) continue;
      const fullTier = priceTiers.find((t) => t.id === stock.tierId) ?? null;
      tierStocks.push({
        tierId: stock.tierId,
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

  const stock = productStocks[0]!;
  const fullTier = priceTiers.find((t) => t.id === stock.tierId) ?? pickDefaultTier(priceTiers);
  return {
    totalQuantity: stock.quantity,
    tierStocks: [
      {
        tierId: stock.tierId || fullTier?.id || LEGACY_MERCHANT_STOCK_TIER_ID,
        label:
          stock.tierId === LEGACY_MERCHANT_STOCK_TIER_ID
            ? '未分規格'
            : tierSpecLabel(fullTier) ?? '預設',
        quantity: stock.quantity,
      },
    ],
  };
}
