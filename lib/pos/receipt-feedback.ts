export type ReceiptFeedback =
  | { status: 'success' | 'redirect'; href: string }
  | { status: 'error'; message: string };

export const RECEIPT_UNKNOWN_RESULT = '無法確認收貨是否完成，請先重新整理查看收貨狀態，避免重複操作。';
const safe = new Set([
  '找不到這張補貨出貨單', '商品尚未出貨，現在不能確認收貨', '出貨狀態已變更',
  '補貨入庫舊資料無法自動判定，請聯絡管理員人工檢查', '補貨出貨單缺少店家',
  '補貨出貨單沒有品項', '補貨出貨單品項資料不完整',
  '補貨入庫紀錄不完整，請聯絡管理員', '補貨出貨單包含不存在的商品',
]);
export function receiptErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  return safe.has(message) ? message : RECEIPT_UNKNOWN_RESULT;
}
