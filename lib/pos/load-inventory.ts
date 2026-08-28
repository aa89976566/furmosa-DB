import { prisma } from '@/lib/prisma';
import { resolveFurmosaProductImage } from '@/lib/pos/furmosa-com-images';
import { suggestedRestockQty } from '@/lib/pos/stock-status';
import { inventoryGroupForProduct, type InventoryGroupId } from '@/lib/pos/inventory-groups';

export type InventoryProduct = {
  productId: string;
  name: string;
  sku: string;
  sourceSku: string | null;
  group: InventoryGroupId;
  quantity: number;
  imageUrl: string | null;
  suggestedQty: number;
};

export async function loadMerchantInventory(
  merchantId: string,
): Promise<InventoryProduct[]> {
  const [products, stocks, rules] = await Promise.all([
    prisma.product.findMany({
      where: {
        status: 'active',
        productCategory: { in: ['JAR_EXCHANGE', 'STANDARD'] },
      },
      select: {
        id: true,
        name: true,
        sku: true,
        sourceSku: true,
        category: true,
        style: true,
        imageUrl: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.merchantStock.findMany({
      where: { merchantId },
      select: { productId: true, quantity: true },
    }),
    prisma.merchantProductRule.findMany({
      where: { merchantId },
      select: { productId: true },
    }),
  ]);

  const qtyByProduct = new Map<string, number>();
  for (const stock of stocks) {
    qtyByProduct.set(stock.productId, (qtyByProduct.get(stock.productId) ?? 0) + stock.quantity);
  }
  const inStore = new Set([...qtyByProduct.keys(), ...rules.map((rule) => rule.productId)]);

  return products
    .filter((product) => inStore.has(product.id))
    .map((product) => {
      const quantity = qtyByProduct.get(product.id) ?? 0;
      return {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        sourceSku: product.sourceSku,
        group: inventoryGroupForProduct({
          name: product.name,
          category: product.category,
          style: product.style,
        }),
        quantity,
        imageUrl: resolveFurmosaProductImage(product.name, product.imageUrl),
        suggestedQty: suggestedRestockQty(quantity),
      };
    })
    .sort((a, b) => a.quantity - b.quantity || a.name.localeCompare(b.name, 'zh-Hant'));
}
