export type ProductOrderEligibilityCode =
  | 'AVAILABLE'
  | 'OUT_OF_STOCK'
  | 'MISSING_WHOLESALE_PRICE';

export type ProductOrderEligibility = {
  canSelect: boolean;
  code: ProductOrderEligibilityCode;
  message: string | null;
};

export function evaluateProductOrderEligibility(input: {
  scope: 'all' | 'customer_in_stock' | 'merchant_standard' | 'merchant_jar_exchange';
  availableStock: number;
  hasWholesalePrice?: boolean;
}): ProductOrderEligibility {
  if (input.scope === 'customer_in_stock' && input.availableStock <= 0) {
    return {
      canSelect: false,
      code: 'OUT_OF_STOCK',
      message: '目前無庫存，請先補貨',
    };
  }

  if (input.scope === 'merchant_standard' && input.hasWholesalePrice === false) {
    return {
      canSelect: false,
      code: 'MISSING_WHOLESALE_PRICE',
      message: '尚未設定此店家的進貨價',
    };
  }

  return { canSelect: true, code: 'AVAILABLE', message: null };
}
