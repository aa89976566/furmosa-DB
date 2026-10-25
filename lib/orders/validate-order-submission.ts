export type OrderSubmissionDraft = {
  orderType: 'customer' | 'merchant';
  customerId: string;
  merchantId: string;
  merchantOrderMode: string;
  items: Array<{ productId: string; quantity: number }>;
  discount: number;
  recipientName: string;
  recipientPhone: string;
  shippingMethod: string;
  shippingAddress: string;
  cvsBrand: string;
  cvsStoreName: string;
};

const CVS_BRANDS = new Set(['711', 'familymart', 'hilife']);

/**
 * 送出前的客戶端檢查。通過只代表畫面資料完整，真正寫入仍由伺服器再驗證一次。
 * 這份結果不是「已儲存」。
 */
export function validateOrderSubmission(input: OrderSubmissionDraft): string | null {
  if (input.orderType === 'customer' && !input.customerId.trim()) return '請選擇客戶';
  if (input.orderType === 'merchant' && !input.merchantId.trim()) return '請選擇合作店家';
  if (input.orderType === 'merchant' && !input.merchantOrderMode.trim()) {
    return '請選擇店家合作方式';
  }

  const lines = input.items.filter((item) => item.productId.trim());
  if (lines.length === 0 || lines.every((item) => item.quantity <= 0)) {
    return '至少要有一筆商品，且數量大於 0';
  }
  if (lines.some((item) => item.quantity <= 0)) return '商品數量必須大於 0';
  if (input.discount < 0) return '折扣不可為負數';
  if (!input.recipientName.trim()) return '請填寫收件人姓名';
  if (!input.shippingMethod) return '請先選擇物流方式';

  if (input.shippingMethod === 'convenience') {
    if (!CVS_BRANDS.has(input.cvsBrand)) {
      return '超商取貨請選擇品牌（7-ELEVEN / 全家 / 萊爾富）';
    }
    if (!input.cvsStoreName.trim()) return '請填寫門市名稱';
  }

  if (input.shippingMethod === 'home' || input.shippingMethod === 'delivery') {
    if (!input.recipientPhone.trim()) return '請填寫收件人電話';
    if (!input.shippingAddress.trim()) return '請填寫收件地址';
  }

  return null;
}
