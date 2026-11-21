/**
 * Default merchant buyout rules from「匠寵｜零食產品清單」.
 * A merchant-specific price always takes priority. Otherwise:
 * - 肉乾／常溫零食：零售價 8 折
 * - 凍乾：零售價 7 折
 * - 棒棒牛／棒棒雞單支小禮包：固定 NT$25
 * All calculated prices round to whole TWD.
 */
const FIXED_PRICE_GIFT_PACK = /^(棒棒牛|棒棒雞)(?:｜單支小禮包|小禮包)?$/;

export type BuyoutTierQuote = {
  ruleId: 'sheet-buyout-v1';
  discountBps: 2000 | 3000 | null;
  retailUnitPrice: number;
  wholesaleUnitPrice: number;
  calculation: 'retail_discount' | 'fixed_price';
};

function roundTwd(value: number) {
  return Math.round(value + Number.EPSILON);
}

/** Calculates the default shop buyout price for a single sellable SKU/tier. */
export function quoteDefaultBuyoutTier(input: {
  name: string;
  category: string;
  retailUnitPrice: number;
  quantity: number;
}): BuyoutTierQuote {
  if (!Number.isFinite(input.retailUnitPrice) || input.retailUnitPrice <= 0) {
    throw new Error('商品尚未設定有效零售參考價');
  }
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new Error('買斷數量必須大於 0');
  }

  if (FIXED_PRICE_GIFT_PACK.test(input.name)) {
    return {
      ruleId: 'sheet-buyout-v1',
      discountBps: null,
      retailUnitPrice: input.retailUnitPrice,
      wholesaleUnitPrice: 25,
      calculation: 'fixed_price',
    };
  }

  const discountBps: 2000 | 3000 = input.category === 'freeze_dried' ? 3000 : 2000;
  return {
    ruleId: 'sheet-buyout-v1',
    discountBps,
    retailUnitPrice: input.retailUnitPrice,
    wholesaleUnitPrice: roundTwd(
      input.retailUnitPrice * (10_000 - discountBps) / 10_000,
    ),
    calculation: 'retail_discount',
  };
}
