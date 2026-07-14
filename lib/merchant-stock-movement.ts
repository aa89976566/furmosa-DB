import type { MerchantCommissionPercent } from '@/lib/merchant-commission';

/** 登記庫存異動：減少 */
export const STOCK_DECREASE_REASONS = ['sale', 'damage', 'return_hq'] as const;
/** 登記庫存異動：增加 */
export const STOCK_INCREASE_REASONS = ['restock_correction', 'count_correction'] as const;

export type StockDecreaseReason = (typeof STOCK_DECREASE_REASONS)[number];
export type StockIncreaseReason = (typeof STOCK_INCREASE_REASONS)[number];
export type StockMovementReason = StockDecreaseReason | StockIncreaseReason;

export type StockMovementReasonMeta = {
  value: StockMovementReason;
  label: string;
  description: string;
  countsAsSale: boolean;
  txnType: 'sale' | 'adjust' | 'return' | 'restock';
};

export const STOCK_DECREASE_REASON_OPTIONS: StockMovementReasonMeta[] = [
  {
    value: 'sale',
    label: '現場售出',
    description: '計入分潤與下次結算',
    countsAsSale: true,
    txnType: 'sale',
  },
  {
    value: 'damage',
    label: '盤損／過期報廢',
    description: '不計金額，請填備註',
    countsAsSale: false,
    txnType: 'adjust',
  },
  {
    value: 'return_hq',
    label: '退回總部／調撥',
    description: '不計分潤金額',
    countsAsSale: false,
    txnType: 'return',
  },
];

export const STOCK_INCREASE_REASON_OPTIONS: StockMovementReasonMeta[] = [
  {
    value: 'restock_correction',
    label: '補登進貨',
    description: '忘了登記的到貨，不計銷售金額',
    countsAsSale: false,
    txnType: 'restock',
  },
  {
    value: 'count_correction',
    label: '盤點清點錯誤更正',
    description: '更正誤鍵／清點誤差，不計金額',
    countsAsSale: false,
    txnType: 'adjust',
  },
];

export function isStockDecreaseReason(v: string): v is StockDecreaseReason {
  return (STOCK_DECREASE_REASONS as readonly string[]).includes(v);
}

export function isStockIncreaseReason(v: string): v is StockIncreaseReason {
  return (STOCK_INCREASE_REASONS as readonly string[]).includes(v);
}

export function resolveStockMovementReason(
  delta: number,
  raw: string | null | undefined,
): StockMovementReasonMeta {
  const value = (raw ?? '').trim();
  if (delta === 0) {
    throw new Error('數量沒有變化');
  }
  if (delta < 0) {
    const opt =
      STOCK_DECREASE_REASON_OPTIONS.find((o) => o.value === value) ??
      // 舊表單未傳 reason：相容視為現場售出
      STOCK_DECREASE_REASON_OPTIONS[0];
    if (value && !isStockDecreaseReason(value)) {
      throw new Error('減少庫存請選擇有效原因');
    }
    return opt;
  }
  const opt =
    STOCK_INCREASE_REASON_OPTIONS.find((o) => o.value === value) ??
    STOCK_INCREASE_REASON_OPTIONS[1];
  if (value && !isStockIncreaseReason(value)) {
    throw new Error('增加庫存請選擇有效原因');
  }
  return opt;
}

export function commissionBadgeLabel(
  mode: string | null | undefined,
  value: number | null | undefined,
): string | null {
  if (mode !== 'percent' || value == null) return null;
  if (value === 30) return '凍乾 30%';
  if (value === 20) return '肉乾／零食 20%';
  return `${value}%`;
}

export function previewSaleAmounts(
  unitPrice: number,
  qty: number,
  commissionPercent: MerchantCommissionPercent | number,
) {
  const commission = (unitPrice * commissionPercent) / 100 * qty;
  const gross = unitPrice * qty;
  return {
    unitPrice,
    qty,
    gross,
    commission,
    companyRevenue: gross - commission,
    commissionPercent,
  };
}
