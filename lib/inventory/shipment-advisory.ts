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
  product: {
    productCategory?: string;
    inventorySourceProduct?: { id: string; sku: string; name: string; status: string; unit: string; inventoryBalances: AdvisoryBalance[] } | null;
    id: string;
    sku: string;
    name: string;
    category: string;
    unit?: string | null;
    priceTiers?: BulkTier[];
    inventoryBalances?: AdvisoryBalance[];
  };
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
    if ((product.productCategory !== 'JAR_EXCHANGE' && !TRACKED_CATEGORIES.has(product.category)) || isMadeToOrderHqProduct(product.sku)) continue;
    const source = product.productCategory === 'JAR_EXCHANGE' ? product.inventorySourceProduct : product;
    if (!source || ('status' in source && source.status !== 'active')) {
      return [`${product.name}尚未設定有效庫存來源單品，無法出貨`];
    }
    const unit = bulkUnit(source.unit);
    if (!unit) continue;
    try {
      const amount = bulkConsumption(product.productCategory === 'JAR_EXCHANGE' ? { ...product, unit: 'g' } : product, item);
      const current = required.get(source.id);
      required.set(source.id, {
        name: source.name,
        sku: source.sku,
        unit,
        amount: (current?.amount ?? 0) + amount,
        balance: current?.balance ?? source.inventoryBalances?.[0] ?? null,
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
