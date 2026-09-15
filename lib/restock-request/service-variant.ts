import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { resolveRestockVariant, type RestockVariantInput } from './variant';
export async function resolveRestockItems<T extends RestockVariantInput & { productId: string }>(items: T[], db: Prisma.TransactionClient | typeof prisma = prisma) {
  const products = await db.product.findMany({ where: { id: { in: items.map(i => i.productId) } }, include: { priceTiers: true } });
  return items.map(item => {
    const product = products.find(p => p.id === item.productId);
    if (!product) throw new Error('有商品不存在');
    return { ...item, ...resolveRestockVariant(product.priceTiers, item, product.name) };
  });
}
