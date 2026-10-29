import { prisma } from '@/lib/prisma';
import { resolveFurmosaProductImage } from '@/lib/pos/furmosa-com-images';
import { suggestedRestockQty } from '@/lib/pos/stock-status';
import { inventoryGroupForProduct, type InventoryGroupId } from '@/lib/pos/inventory-groups';
import { productProgramLabel } from '@/lib/product-category';

export type InventoryProduct = {
  productId: string;
  name: string;
  sku: string;
  sourceSku: string | null;
  group: InventoryGroupId;
  quantity: number;
  imageUrl: string | null;
  suggestedQty: number;
  productCategory: string;
  programLabel: '換罐計劃' | null;
  tiers?: { id: string; label: string; quantity: number }[];
};

export async function loadMerchantInventory(
  merchantId: string,
): Promise<InventoryProduct[]> {
  const products = await prisma.product.findMany({
      where: {
        status: 'active',
        OR: [
          { productCategory: 'JAR_EXCHANGE' },
          {
            productCategory: 'STANDARD',
            OR: [
              { merchantStocks: { some: { merchantId } } },
              { merchantRules: { some: { merchantId } } },
            ],
          },
        ],
      },
      select: {
        id: true,
        name: true,
        sku: true,
        sourceSku: true,
        category: true,
        style: true,
        imageUrl: true,
        productCategory: true,
        merchantStocks: {
          where: { merchantId },
          select: { quantity: true, tierId: true },
        },
        priceTiers: { select: { id: true, weightGrams: true, unit: true, unitQty: true } },
      },
      orderBy: { name: 'asc' },
    });
  return products
    .map((product) => {
      const quantity = product.merchantStocks.reduce((sum, stock) => sum + stock.quantity, 0);
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
        productCategory: product.productCategory,
        programLabel: productProgramLabel(product.productCategory),
        tiers: [
          ...product.priceTiers.map(tier => ({ id: tier.id, label: tier.weightGrams ? `${tier.weightGrams}g` : `${tier.unitQty} ${tier.unit}`, quantity: product.merchantStocks.find(s => s.tierId === tier.id)?.quantity ?? 0 })),
          ...product.merchantStocks.filter(s => !product.priceTiers.some(t => t.id === s.tierId)).map(s => ({ id: s.tierId, label: '舊庫存（未分規格）', quantity: s.quantity })),
        ],
      };
    })
    .sort((a, b) => a.quantity - b.quantity || a.name.localeCompare(b.name, 'zh-Hant'));
}
