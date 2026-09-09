export type PaymentCollectionSummary = {
  receivedAmount: number | null;
  outstandingAmount: number | null;
  note: string | null;
};

/**
 * 尚未導入收款流水帳前，只回傳能由付款狀態確定的金額。
 * partial 不猜測實收數字，避免 HQ 帳務顯示不存在的金額。
 */
export function paymentCollectionSummary(
  total: number,
  paymentStatus: string,
): PaymentCollectionSummary {
  const safeTotal = Math.max(0, Number.isFinite(total) ? total : 0);
  if (paymentStatus === 'paid') {
    return { receivedAmount: safeTotal, outstandingAmount: 0, note: null };
  }
  if (paymentStatus === 'refunded') {
    return { receivedAmount: 0, outstandingAmount: 0, note: '款項已退款，不列入淨實收' };
  }
  if (paymentStatus === 'partial') {
    return {
      receivedAmount: null,
      outstandingAmount: null,
      note: '尚未建立收款流水帳，無法準確計算部分付款與尾款',
    };
  }
  return { receivedAmount: 0, outstandingAmount: safeTotal, note: null };
}
