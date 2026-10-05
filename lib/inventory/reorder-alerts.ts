export type ReorderProductInput = {
  id: string;
  name: string;
  sku: string;
  reorderPoint: number;
  vendorName: string | null;
  onHand: number;
  unit: string | null;
  lastCountedAt: Date | null;
  incoming: number;
};

export type ReorderAlertRow = ReorderProductInput & {
  projected: number;
  deficit: number;
  state: 'order_now' | 'incoming' | 'stocktake';
};

export type ReorderAlertSummary = {
  orderNow: ReorderAlertRow[];
  incoming: ReorderAlertRow[];
  stocktake: ReorderAlertRow[];
};

/**
 * 補貨點是商品主檔的安全線；待收貨採購需先扣抵，避免重複下單。
 * 沒有盤點時間的舊數字不直接拿來產生採購建議。
 */
export function buildReorderAlertSummary(products: ReorderProductInput[]): ReorderAlertSummary {
  const result: ReorderAlertSummary = { orderNow: [], incoming: [], stocktake: [] };

  for (const product of products) {
    const projected = product.onHand + product.incoming;
    const deficit = Math.max(0, product.reorderPoint - projected);
    const base = { ...product, projected, deficit };

    if (!product.lastCountedAt) {
      result.stocktake.push({ ...base, state: 'stocktake' });
      continue;
    }
    if (product.onHand > product.reorderPoint) continue;
    if (projected > product.reorderPoint) {
      result.incoming.push({ ...base, state: 'incoming' });
      continue;
    }
    result.orderNow.push({ ...base, state: 'order_now' });
  }

  const urgency = (a: ReorderAlertRow, b: ReorderAlertRow) => {
    if ((a.onHand <= 0) !== (b.onHand <= 0)) return a.onHand <= 0 ? -1 : 1;
    if (a.projected !== b.projected) return a.projected - b.projected;
    return a.name.localeCompare(b.name, 'zh-Hant');
  };
  result.orderNow.sort(urgency);
  result.incoming.sort(urgency);
  result.stocktake.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
  return result;
}

