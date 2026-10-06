import {
  merchantOrderProductCategory,
  type MerchantOrderMode,
} from './merchant-order-mode';

type OrderContextProduct = {
  productCategory: string;
};

export type OrderContextSwitch = {
  orderType: 'customer' | 'merchant';
  merchantOrderMode: MerchantOrderMode;
};

export function lineFitsOrderContext(
  product: OrderContextProduct | undefined,
  next: OrderContextSwitch,
): boolean {
  if (!product) return false;
  if (next.orderType === 'customer') return product.productCategory === 'STANDARD';
  return product.productCategory === merchantOrderProductCategory(next.merchantOrderMode);
}

/** 空白列保留；只有不符合下一個類型的既有商品會被標成移除。 */
export function splitLinesForContext<T extends { productId: string }>(
  items: T[],
  productFor: (productId: string) => OrderContextProduct | undefined,
  next: OrderContextSwitch,
): { kept: T[]; removed: T[] } {
  const kept: T[] = [];
  const removed: T[] = [];
  for (const item of items) {
    if (!item.productId) {
      kept.push(item);
      continue;
    }
    if (lineFitsOrderContext(productFor(item.productId), next)) kept.push(item);
    else removed.push(item);
  }
  return { kept, removed };
}

export function incompatibleLineSwitchPrompt(nextLabel: string, removedCount: number) {
  return `改為「${nextLabel}」會移除 ${removedCount} 項不相容商品。取消會保留目前的商品與表單內容。要繼續嗎？`;
}
