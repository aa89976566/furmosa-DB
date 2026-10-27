export type VendorConsignmentSettings = {
  supplierConsignmentEnabled: boolean;
  furmosaShareBps: number | null;
  settlementCurrency: 'TWD';
};

export function parseVendorConsignmentSettings(input: {
  enabled: boolean;
  furmosaSharePercent: string;
}): VendorConsignmentSettings {
  if (!input.enabled) {
    return {
      supplierConsignmentEnabled: false,
      furmosaShareBps: null,
      settlementCurrency: 'TWD',
    };
  }

  const text = input.furmosaSharePercent.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
    throw new Error('請填寫 0 至 100 的匠寵分潤比例，最多兩位小數');
  }
  const percent = Number(text);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new Error('匠寵分潤比例必須介於 0% 至 100%');
  }
  const furmosaShareBps = Math.round(percent * 100);
  return {
    supplierConsignmentEnabled: true,
    furmosaShareBps,
    settlementCurrency: 'TWD',
  };
}

export function basisPointsToPercent(basisPoints: number | null): string {
  if (basisPoints == null) return '';
  return String(basisPoints / 100);
}
