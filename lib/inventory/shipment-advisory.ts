import { bulkConsumption, bulkUnit, type BulkTier } from './bulk';

export const MADE_TO_ORDER_HQ_SKUS = new Set(['FUR-0002']);

type AdvisoryBalance = {
  quantity: number;
  unit?: string | null;
  lastCountedAt?: Date | string | null;
};

type AdvisoryItem = {
  quantity: number;
  weightGrams?: number | null;
  variantKey?: string | null;
  product?: {
    id: string;
    sku: string;
    name: string;
    category: string;
    unit?: string | null;
    priceTiers?: BulkTier[];
    inventoryBalances?: AdvisoryBalance[];
  } | null;
};

const TRACKED_CATEGORIES = new Set(['staple_food', 'treats', 'freeze_dried', 'health']);

export function isMadeToOrderHqProduct(sku: string) {
  return MADE_TO_ORDER_HQ_SKUS.has(sku.trim().toUpperCase());
}

/** 出貨前提醒；只提示，不阻擋物流操作。 */
export function shipmentInventoryAdvisories(items: AdvisoryItem[]): string[] {
  const required = new Map<
    string,
    { name: string; sku: string; unit: string; amount: number; balance: AdvisoryBalance | null }
  >();

  for (const item of items) {
    const product = item.product;
    if (!product?.category || !product.sku) continue;
    if (!TRACKED_CATEGORIES.has(product.category) || isMadeToOrderHqProduct(product.sku)) continue;
    const unit = bulkUnit(product.unit);
    if (!unit) continue;
    try {
      const amount = bulkConsumption(product, item);
      const current = required.get(product.id);
      required.set(product.id, {
        name: product.name,
        sku: product.sku,
        unit,
        amount: (current?.amount ?? 0) + amount,
        balance: current?.balance ?? product.inventoryBalances?.[0] ?? null,
      });
    } catch {
      // 規格錯誤仍由既有後端驗證阻擋；此函式只負責庫存數量提醒。
    }
  }

  return [...required.values()].flatMap(({ name, unit, amount, balance }) => {
    const counted = Boolean(balance?.lastCountedAt) && balance?.unit === unit;
    if (!counted) return [`${name}尚未盤點，本次需 ${amount}${unit}；仍可寄出`];
    if ((balance?.quantity ?? 0) >= amount) return [];
    return [
      `${name}庫存 ${balance?.quantity ?? 0}${unit}，本次需 ${amount}${unit}，寄出後為 ${(balance?.quantity ?? 0) - amount}${unit}`,
    ];
  });
}
