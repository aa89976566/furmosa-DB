/**
 * Default merchant buyout rules.
 * Merchant event/group-buy exceptions are resolved separately and take priority.
 * Values are calculated from the current SKU retail price and snapshotted on the order.
 */
export const CHICKEN_BUYOUT_SKU = 'FUR-0002' as const;

export type BuyoutTierQuote = {
  ruleId: 'chicken-buyout-v2';
  discountBps: 2500 | 3000;
  minimumQuantity: 30 | 50;
  retailUnitPrice: number;
  wholesaleUnitPrice: number;
};

function roundTwdCents(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Returns null for products governed by their own SKU rule. */
export function quoteDefaultBuyoutTier(input: {
  sku: string;
  retailUnitPrice: number;
  quantity: number;
}): BuyoutTierQuote | null {
  if (input.sku !== CHICKEN_BUYOUT_SKU) return null;
  if (!Number.isFinite(input.retailUnitPrice) || input.retailUnitPrice <= 0) {
    throw new Error('雞霸尚未設定有效零售參考價');
  }
  if (!Number.isInteger(input.quantity) || input.quantity < 30) {
    throw new Error('雞霸買斷最低 30 件');
  }

  const discountBps: 2500 | 3000 = input.quantity >= 50 ? 3000 : 2500;
  return {
    ruleId: 'chicken-buyout-v2',
    discountBps,
    minimumQuantity: input.quantity >= 50 ? 50 : 30,
    retailUnitPrice: input.retailUnitPrice,
    wholesaleUnitPrice: roundTwdCents(
      input.retailUnitPrice * (10_000 - discountBps) / 10_000,
    ),
  };
}
