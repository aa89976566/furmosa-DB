import { shippingFeeTypeLabel } from '@/lib/labels';
import {
  orderTotalFromAmounts,
  resolveOrderShipping,
  type ShippingFeeType,
} from '@/lib/shipping-policy';

export type OrderAmountInput = {
  subtotal: number;
  discount: number;
  shippingFee: number;
  shippingFeeType: string;
  shippingMethod: string;
  cvsBrand?: string | null;
  companyShippingCost?: number;
  total?: number;
};

/** 買家應付 = 小計 − 折扣 + 運費（買家負擔部分） */
export function orderBuyerTotal(order: Pick<OrderAmountInput, 'subtotal' | 'discount' | 'shippingFee'>) {
  return orderTotalFromAmounts(
    Number(order.subtotal),
    Number(order.discount),
    Number(order.shippingFee),
  );
}

export type OrderAmountLine = {
  key: string;
  label: string;
  value: number;
  /** 顯示用修飾（如刪除線原價） */
  hint?: string;
  tone?: 'default' | 'success' | 'warning' | 'muted';
  /** 是否計入買家合計 */
  countsTowardBuyerTotal?: boolean;
};

export function buildOrderAmountSummary(order: OrderAmountInput) {
  const subtotal = Number(order.subtotal);
  const discount = Number(order.discount);
  const shipping = resolveOrderShipping({
    shippingFeeType: order.shippingFeeType as ShippingFeeType,
    shippingMethod: order.shippingMethod,
    cvsBrand: order.cvsBrand,
  });
  const buyerTotal = orderTotalFromAmounts(subtotal, discount, shipping.shippingFee);
  const feeTypeLabel = shippingFeeTypeLabel[order.shippingFeeType] ?? order.shippingFeeType;

  const lines: OrderAmountLine[] = [
    { key: 'subtotal', label: '小計', value: subtotal, countsTowardBuyerTotal: true },
  ];

  if (discount > 0) {
    lines.push({
      key: 'discount',
      label: '折扣',
      value: -discount,
      tone: 'success',
      countsTowardBuyerTotal: true,
    });
  }

  if (order.shippingFeeType === 'free') {
    lines.push({
      key: 'shipping-buyer',
      label: '運費',
      value: 0,
      hint: `包郵（原 ${shipping.standardFee} 元由公司吸收）`,
      tone: 'muted',
      countsTowardBuyerTotal: true,
    });
  } else if (order.shippingFeeType === 'prepaid') {
    lines.push({
      key: 'shipping-buyer',
      label: '運費',
      value: 0,
      hint: '已付費（不計入此單）',
      tone: 'muted',
      countsTowardBuyerTotal: true,
    });
  } else {
    lines.push({
      key: 'shipping-buyer',
      label: order.shippingFeeType === 'cod' ? '運費（貨到付）' : '運費',
      value: shipping.shippingFee,
      countsTowardBuyerTotal: true,
    });
  }

  const companyCost =
    Number(order.companyShippingCost) > 0
      ? Number(order.companyShippingCost)
      : shipping.companyShippingCost;

  return {
    lines,
    buyerTotal,
    companyShippingCost: companyCost,
    standardShippingFee: shipping.standardFee,
    feeTypeLabel,
    /** DB 存的 total 應等於 buyerTotal */
    storedTotal: order.total != null ? Number(order.total) : buyerTotal,
    totalMismatch: order.total != null && Math.abs(Number(order.total) - buyerTotal) > 0.009,
  };
}
