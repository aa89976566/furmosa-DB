/** Purchase costs retain cents; do not use the general whole-dollar price formatter. */
export function formatPurchaseMoney(value: number | string) {
  return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));
}
export function formatPurchaseDate(value: Date) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);
}
export function formatPurchaseTime(value: Date) {
  return new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(value);
}
type ReceiptProgress = { id: string; purchaseOrderId: string | null; items: { productId: string; quantityGrams: number; sourceOrderItemId: string | null }[] };
export function purchaseLineReceived(orderId: string, line: { id: string; productId: string }, receipts: ReceiptProgress[]) {
  return [...new Map(receipts.map(r => [r.id,r])).values()].reduce((sum,r) => sum + r.items.filter(item => item.sourceOrderItemId === line.id || (!item.sourceOrderItemId && r.purchaseOrderId === orderId && item.productId === line.productId)).reduce((n,item) => n+item.quantityGrams,0),0);
}
