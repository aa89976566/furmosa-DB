import type { PrismaClient } from '@prisma/client';
import { previewHqPacks } from './hq-pack-preview.ts';

/** No writes, external calls, global client, or automatic publication. */
export async function loadHqPackPreview(db: Pick<PrismaClient, '$transaction'>, warehouseCode: string) {
  if (!warehouseCode.trim()) throw new Error('WAREHOUSE_REQUIRED');
  return db.$transaction(async tx => {
    const warehouse = await tx.warehouse.findUnique({ where: { code: warehouseCode }, select: { id: true, code: true } });
    if (!warehouse) throw new Error('WAREHOUSE_NOT_FOUND');
    // Include unbound tiers: other HQ sales can consume the same ingredient.
    const tiers = await tx.productPriceTier.findMany({
      where: { status: 'active', OR: [{ weightGrams: { gt: 0 } }, { shopifyVariantId: { not: null } }], product: { status: 'active' } },
      select: {
        id: true, productId: true, weightGrams: true, shopifyVariantId: true, inventoryPolicy: true,
        product: { select: { inventorySourceProductId: true } },
        bundleComponents: { select: { componentProductId: true, gramsPerPack: true } },
      },
      orderBy: { id: 'asc' },
    });
    const productIds = [...new Set(tiers.flatMap(tier => tier.bundleComponents.length ?
      tier.bundleComponents.map(c => c.componentProductId) :
      [tier.product.inventorySourceProductId ?? tier.productId]))];
    const balances = await tx.inventoryBalance.findMany({
      where: { warehouseId: warehouse.id, productId: { in: productIds } },
      select: { productId: true, quantity: true, unit: true },
    });
    return { warehouse, publicationEnabled: false as const, rows: previewHqPacks(tiers, balances) };
  }, { isolationLevel: 'RepeatableRead', maxWait: 3000, timeout: 15000 });
}
