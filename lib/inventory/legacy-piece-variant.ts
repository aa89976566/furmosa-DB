import { bulkUnit } from './bulk';

type LegacyShipmentItem = {
  id: string;
  productId: string;
  variantKey?: string | null;
  weightGrams?: number | null;
  unit?: string | null;
};

type ProductWithTiers = {
  id: string;
  unit?: string | null;
  priceTiers: Array<{
    id: string;
    unit?: string | null;
    unitQty: number;
    weightGrams?: number | null;
  }>;
};

export type LegacyPieceVariantRepair = { itemId: string; variantKey: string };

/**
 * 舊訂單可能只有「3 隻／3 片」，尚未保存後來新增的 variantKey。
 * 只有商品與訂單單位一致，且存在唯一「單件」規格時才補值；其餘維持 fail closed。
 */
export function resolveLegacyPieceVariantRepairs(
  items: LegacyShipmentItem[],
  products: ProductWithTiers[],
): LegacyPieceVariantRepair[] {
  const productById = new Map(products.map((product) => [product.id, product]));

  return items.flatMap((item) => {
    if (item.variantKey || item.weightGrams != null) return [];
    const itemUnit = bulkUnit(item.unit);
    const product = productById.get(item.productId);
    const productUnit = bulkUnit(product?.unit);
    if (!itemUnit || itemUnit === 'g' || itemUnit !== productUnit || !product) return [];

    const unitTiers = product.priceTiers.filter(
      (tier) =>
        bulkUnit(tier.unit) === itemUnit &&
        tier.weightGrams == null &&
        tier.unitQty === 1,
    );
    return unitTiers.length === 1
      ? [{ itemId: item.id, variantKey: unitTiers[0].id }]
      : [];
  });
}
