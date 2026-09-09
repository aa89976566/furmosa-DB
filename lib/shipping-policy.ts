import { CARRIER_711 } from '@/lib/carrier-cvs';

/** 7-11 超商取貨運費（元） */
export const SHIPPING_FEE_CVS_711 = 60;

/** 黑貓宅配運費（元） */
export const SHIPPING_FEE_HOME_BLACK_CAT = 120;

export const SHIPPING_FEE_TYPES = ['free', 'prepaid', 'unpaid', 'cod'] as const;
export type ShippingFeeType = (typeof SHIPPING_FEE_TYPES)[number];

export const SHIPPING_CARRIER_DELIVERY = '送貨';

export type ShippingMethod = 'home' | 'convenience' | 'delivery';

/** 依運送方式取得標準運費：超商（7-11）60、宅配（黑貓）120、送貨 0 */
export function standardShippingFee(params: {
  shippingMethod: ShippingMethod | string;
  cvsBrand?: string | null;
}): number {
  if (params.shippingMethod === 'convenience') {
    return SHIPPING_FEE_CVS_711;
  }
  if (params.shippingMethod === 'delivery') {
    return 0;
  }
  return SHIPPING_FEE_HOME_BLACK_CAT;
}

/** 出貨單 carrier 欄位：超商 → 7-11、宅配 → 黑貓、送貨 → 送貨 */
export function shipmentCarrierFromOrder(params: {
  shippingMethod: ShippingMethod | string;
  cvsBrand?: string | null;
}): string {
  if (params.shippingMethod === 'convenience') {
    return CARRIER_711;
  }
  if (params.shippingMethod === 'delivery') {
    return SHIPPING_CARRIER_DELIVERY;
  }
  return '黑貓';
}

export function shippingMethodLabel(params: {
  shippingMethod: ShippingMethod | string;
  cvsBrand?: string | null;
}): string {
  if (params.shippingMethod === 'delivery') {
    return SHIPPING_CARRIER_DELIVERY;
  }
  if (params.shippingMethod === 'convenience') {
    const brand =
      params.cvsBrand === '711'
        ? '7-ELEVEN'
        : params.cvsBrand === 'familymart'
          ? '全家'
          : params.cvsBrand === 'hilife'
            ? '萊爾富'
            : '超商';
    return `${brand} · ${SHIPPING_FEE_CVS_711} 元`;
  }
  return `黑貓宅配 · ${SHIPPING_FEE_HOME_BLACK_CAT} 元`;
}

/**
 * 訂單運費拆解：
 * - 包郵 free：買家付 0，公司負擔標準運費
 * - 已付費 prepaid：買家付 0，公司不另記運費成本（已另行收取）
 * - 不包郵 unpaid / 運費貨到付 cod：買家付標準運費，不算公司成本
 */
export function resolveOrderShipping(params: {
  shippingFeeType: ShippingFeeType | string;
  shippingMethod: ShippingMethod | string;
  cvsBrand?: string | null;
}): {
  standardFee: number;
  shippingFee: number;
  companyShippingCost: number;
} {
  const standardFee = standardShippingFee(params);
  const type = params.shippingFeeType;

  if (type === 'free') {
    return { standardFee, shippingFee: 0, companyShippingCost: standardFee };
  }
  if (type === 'prepaid') {
    return { standardFee, shippingFee: 0, companyShippingCost: 0 };
  }
  // unpaid / cod：買家負擔
  return { standardFee, shippingFee: standardFee, companyShippingCost: 0 };
}

export function orderTotalFromAmounts(subtotal: number, discount: number, shippingFee: number): number {
  return Math.max(0, subtotal - discount + shippingFee);
}

export type ShippingRecipientFields = {
  recipientName: string | null | undefined;
  recipientPhone: string | null | undefined;
  recipientAddress: string | null | undefined;
};

/** HQ home／delivery 與進貨黑貓／送貨共用的必填對照。 */
export const HOME_OR_DELIVERY_RECIPIENT_REQUIREMENTS = [
  { field: 'recipientName', message: '請填寫收件人姓名' },
  { field: 'recipientPhone', message: '請填寫收件人電話' },
  { field: 'recipientAddress', message: '請填寫收件地址' },
] as const;

const HOME_OR_DELIVERY_METHODS = new Set<string>(['home', 'delivery']);
const HOME_OR_DELIVERY_CARRIERS = new Set<string>(['黑貓', SHIPPING_CARRIER_DELIVERY]);

export function parseHqShippingMethod(raw: unknown): ShippingMethod {
  const value = String(raw ?? '').trim();
  if (value === 'home' || value === 'convenience' || value === 'delivery') {
    return value;
  }
  throw new Error('請選擇運送方式');
}

export function shippingMethodRequiresHomeOrDeliveryRecipient(method: string): boolean {
  return HOME_OR_DELIVERY_METHODS.has(method);
}

export function carrierRequiresHomeOrDeliveryRecipient(carrier: string | null | undefined): boolean {
  return HOME_OR_DELIVERY_CARRIERS.has((carrier ?? '').trim());
}

export function assertHomeOrDeliveryRecipient(fields: ShippingRecipientFields): void {
  for (const { field, message } of HOME_OR_DELIVERY_RECIPIENT_REQUIREMENTS) {
    if (!String(fields[field] ?? '').trim()) {
      throw new Error(message);
    }
  }
}

export function assertCarrierHomeOrDeliveryRecipient(
  carrier: string | null | undefined,
  fields: ShippingRecipientFields,
): void {
  if (!carrierRequiresHomeOrDeliveryRecipient(carrier)) return;
  assertHomeOrDeliveryRecipient(fields);
}
