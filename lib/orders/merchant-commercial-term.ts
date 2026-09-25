import type { MerchantOrderMode } from './merchant-order-mode.ts';

export type CommercialValueMode = 'percent' | 'amount' | 'fixed_price';
export type CommercialRuleSource =
  | 'order_override'
  | 'merchant_exception'
  | 'product_default';

export type CommercialTermProduct = {
  businessTier: string | null;
  commercialTermsVersion: number | null;
  defaultConsignmentCommissionMode: string | null;
  defaultConsignmentCommissionValue: number | null;
  defaultWholesaleUnitPrice: number | null;
};

export type CommercialTermTier = {
  defaultWholesaleUnitPrice: number | null;
} | null;

export type CommercialTermMerchantException = {
  mode: string;
  value: number;
} | null;

export type CommercialTermOverride = {
  mode: string;
  value: number | null;
  reason: string;
} | null;

export type ResolvedCommercialTerm = {
  businessTierSnapshot: string | null;
  commercialTermsVersionSnapshot: number | null;
  commercialRuleSource: CommercialRuleSource | null;
  defaultCommercialMode: CommercialValueMode | null;
  defaultCommercialValue: number | null;
  appliedCommercialMode: CommercialValueMode | null;
  appliedCommercialValue: number | null;
  commercialOverrideReason: string | null;
  isOverride: boolean;
};

function positiveInteger(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0 || !Number.isInteger(value)) {
    return null;
  }
  return value;
}

function consignmentMode(value: string | null | undefined): CommercialValueMode | null {
  return value === 'percent' || value === 'amount' ? value : null;
}

function merchantExceptionValue(
  exception: CommercialTermMerchantException,
): { mode: CommercialValueMode; value: number } | null {
  if (!exception) return null;
  const mode = consignmentMode(exception.mode);
  if (!mode || !Number.isFinite(exception.value) || exception.value <= 0) return null;
  const normalized = mode === 'percent' ? exception.value * 100 : exception.value;
  if (!Number.isInteger(normalized)) {
    throw new Error('店家特約金額無法用整數台幣保存，請先更新特約設定');
  }
  return {
    mode,
    // 舊 MerchantProductRule 的 percent 單位是百分比；新快照固定存 basis points。
    value: normalized,
  };
}

function assertOverride(
  override: CommercialTermOverride,
  expectedMode: CommercialValueMode,
): { mode: CommercialValueMode; value: number; reason: string } | null {
  if (!override) return null;
  const value = positiveInteger(override.value);
  if (override.mode !== expectedMode || value == null) {
    throw new Error('本單調整值格式不正確');
  }
  const reason = override.reason.trim();
  if (reason.length < 4) throw new Error('調整本單條件時，請填寫至少 4 個字的原因');
  return { mode: expectedMode, value, reason };
}

export function resolveMerchantCommercialTerm(input: {
  orderMode: MerchantOrderMode;
  product: CommercialTermProduct;
  tier: CommercialTermTier;
  merchantException: CommercialTermMerchantException;
  override: CommercialTermOverride;
}): ResolvedCommercialTerm {
  const base = {
    businessTierSnapshot: input.product.businessTier,
    commercialTermsVersionSnapshot: input.product.commercialTermsVersion,
  };

  if (input.orderMode === 'jar_exchange') {
    if (input.override) throw new Error('換罐計畫不可套用一般寄賣或買斷條件');
    return {
      ...base,
      commercialRuleSource: null,
      defaultCommercialMode: null,
      defaultCommercialValue: null,
      appliedCommercialMode: null,
      appliedCommercialValue: null,
      commercialOverrideReason: null,
      isOverride: false,
    };
  }

  if (input.orderMode === 'consignment' && input.override) {
    throw new Error('寄賣佣金不可在補貨單逐單調整，請使用 SKU 預設或店家特約');
  }

  let defaultMode: CommercialValueMode;
  let defaultValue: number;
  let defaultSource: Exclude<CommercialRuleSource, 'order_override'>;

  if (input.orderMode === 'consignment') {
    const exception = merchantExceptionValue(input.merchantException);
    const productMode = consignmentMode(input.product.defaultConsignmentCommissionMode);
    const productValue = positiveInteger(input.product.defaultConsignmentCommissionValue);
    if (input.merchantException && !exception) {
      throw new Error('店家寄賣特約格式不正確，請先更新特約設定');
    }
    if (exception) {
      defaultMode = exception.mode;
      defaultValue = exception.value;
      defaultSource = 'merchant_exception';
    } else if (productMode && productValue != null) {
      defaultMode = productMode;
      defaultValue = productValue;
      defaultSource = 'product_default';
    } else {
      throw new Error('此商品尚未設定寄賣佣金，請先更新商品主檔');
    }
  } else {
    const exceptionValue = positiveInteger(input.merchantException?.value);
    const tierValue = positiveInteger(input.tier?.defaultWholesaleUnitPrice);
    const productValue = positiveInteger(input.product.defaultWholesaleUnitPrice);
    defaultMode = 'fixed_price';
    if (input.merchantException?.mode === 'fixed_price' && exceptionValue == null) {
      throw new Error('店家特約買斷價必須是整數台幣，請先更新特約設定');
    }
    if (input.merchantException?.mode === 'fixed_price' && exceptionValue != null) {
      defaultValue = exceptionValue;
      defaultSource = 'merchant_exception';
    } else if (tierValue != null || productValue != null) {
      defaultValue = tierValue ?? productValue!;
      defaultSource = 'product_default';
    } else {
      throw new Error('此商品尚未設定買斷進貨價，請先更新商品主檔');
    }
  }

  const override = assertOverride(input.override, defaultMode);
  if (!override || override.value === defaultValue) {
    return {
      ...base,
      commercialRuleSource: defaultSource,
      defaultCommercialMode: defaultMode,
      defaultCommercialValue: defaultValue,
      appliedCommercialMode: defaultMode,
      appliedCommercialValue: defaultValue,
      commercialOverrideReason: null,
      isOverride: false,
    };
  }

  return {
    ...base,
    commercialRuleSource: 'order_override',
    defaultCommercialMode: defaultMode,
    defaultCommercialValue: defaultValue,
    appliedCommercialMode: override.mode,
    appliedCommercialValue: override.value,
    commercialOverrideReason: override.reason,
    isOverride: true,
  };
}

export function commercialTermValueLabel(
  mode: CommercialValueMode | null,
  value: number | null,
): string {
  if (!mode || value == null) return '不適用';
  if (mode === 'percent') return `${(value / 100).toFixed(value % 100 === 0 ? 0 : 2)}%`;
  return `NT$ ${value}`;
}

export function commercialRuleSourceLabel(source: CommercialRuleSource | null): string {
  if (source === 'order_override') return '本單調整';
  if (source === 'merchant_exception') return '店家特約';
  if (source === 'product_default') return 'SKU 預設';
  return '不適用';
}

export function businessTierLabel(tier: string | null): string {
  if (tier === 'premium') return 'Premium Product';
  if (tier === 'standard') return '一般商品';
  return tier?.trim() || '未設定';
}
