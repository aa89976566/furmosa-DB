export type ProductCommercialTerms = {
  businessTier: 'standard' | 'premium';
  defaultConsignmentCommissionMode: 'percent' | 'amount' | null;
  defaultConsignmentCommissionValue: number | null;
  defaultWholesaleUnitPrice: number | null;
  consignmentEnabled: boolean;
  wholesaleEnabled: boolean;
  jarExchangeEnabled: boolean;
};

function optionalPositiveInteger(value: FormDataEntryValue | null, label: string): number | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label}必須是大於 0 的整數`);
  }
  return parsed;
}

export function parseProductCommercialTerms(
  formData: FormData,
  productCategory: string,
): ProductCommercialTerms {
  const businessTierRaw = String(formData.get('businessTier') ?? 'standard');
  if (businessTierRaw !== 'standard' && businessTierRaw !== 'premium') {
    throw new Error('商品商務等級不正確');
  }

  const consignmentEnabled = formData.has('consignmentEnabled');
  const wholesaleEnabled = formData.has('wholesaleEnabled');
  const jarExchangeEnabled = formData.has('jarExchangeEnabled');

  if (jarExchangeEnabled && productCategory !== 'JAR_EXCHANGE') {
    throw new Error('只有換罐計畫商品可以啟用換罐合作');
  }

  let defaultConsignmentCommissionMode: 'percent' | 'amount' | null = null;
  let defaultConsignmentCommissionValue: number | null = null;
  if (consignmentEnabled) {
    const mode = String(formData.get('defaultConsignmentCommissionMode') ?? '');
    if (mode !== 'percent' && mode !== 'amount') {
      throw new Error('請選擇寄賣佣金計算方式');
    }
    defaultConsignmentCommissionMode = mode;
    if (mode === 'percent') {
      const percent = Number(String(formData.get('defaultConsignmentCommissionDisplayValue') ?? ''));
      if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
        throw new Error('寄賣佣金百分比必須大於 0 且不超過 100');
      }
      defaultConsignmentCommissionValue = Math.round(percent * 100);
    } else {
      defaultConsignmentCommissionValue = optionalPositiveInteger(
        formData.get('defaultConsignmentCommissionDisplayValue'),
        '每件寄賣佣金',
      );
      if (defaultConsignmentCommissionValue == null) {
        throw new Error('請填寫每件寄賣佣金');
      }
    }
  }

  const defaultWholesaleUnitPrice = wholesaleEnabled
    ? optionalPositiveInteger(formData.get('defaultWholesaleUnitPrice'), '預設買斷價')
    : null;

  return {
    businessTier: businessTierRaw,
    defaultConsignmentCommissionMode,
    defaultConsignmentCommissionValue,
    defaultWholesaleUnitPrice,
    consignmentEnabled,
    wholesaleEnabled,
    jarExchangeEnabled,
  };
}

export function productCommercialTermsChanged(
  current: { [Key in keyof ProductCommercialTerms]?: ProductCommercialTerms[Key] | null },
  next: ProductCommercialTerms,
): boolean {
  return (Object.keys(next) as (keyof ProductCommercialTerms)[]).some(
    (key) => (current[key] ?? null) !== next[key],
  );
}
