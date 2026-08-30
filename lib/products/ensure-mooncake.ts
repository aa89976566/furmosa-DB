import type { Prisma, PrismaClient } from '@prisma/client';
import { MOONCAKE_CATALOG } from '@/lib/products/mooncake-catalog';

type Db = PrismaClient | Prisma.TransactionClient;

const pad = (n: number, width = 4) => String(n).padStart(width, '0');

async function nextProductId(db: Db) {
  const last = await db.product.findFirst({
    where: { productId: { startsWith: 'PROD-' } },
    orderBy: { productId: 'desc' },
  });
  const seq = last ? Number(last.productId.slice('PROD-'.length)) + 1 : 1;
  return `PROD-${pad(seq, 4)}`;
}

async function nextSku(db: Db, productSeq: number) {
  let seq = productSeq;
  let sku = `FUR-${pad(seq, 4)}`;
  while (await db.product.findUnique({ where: { sku } })) {
    seq += 1;
    sku = `FUR-${pad(seq, 4)}`;
  }
  return sku;
}

export async function findMooncakeProduct(db: Db) {
  const bySku = await db.product.findFirst({
    where: { sourceSku: MOONCAKE_CATALOG.sourceSku },
    include: { priceTiers: { select: { weightGrams: true, price: true } } },
  });
  if (bySku) return bySku;

  const byName = await db.product.findFirst({
    where: { name: MOONCAKE_CATALOG.name },
    include: { priceTiers: { select: { weightGrams: true, price: true } } },
  });
  if (byName) return byName;

  const named = await db.product.findMany({
    where: { name: { contains: '月餅' } },
    include: { priceTiers: { select: { weightGrams: true, price: true } } },
  });
  if (named.length === 1) return named[0]!;
  return null;
}

/** 找到就回傳；沒有就建立一筆月餅主檔，方便 Shopify 訂單對到商品。 */
export async function ensureMooncakeProduct(db: Db) {
  const existing = await findMooncakeProduct(db);
  const vendor = await db.vendor.findFirst({
    where: { name: MOONCAKE_CATALOG.vendor, status: 'active' },
    select: { id: true },
  });

  if (existing) {
    const needsSku = !existing.sourceSku;
    const needsActive = existing.status !== 'active';
    const product =
      needsSku || needsActive
        ? await db.product.update({
            where: { id: existing.id },
            data: {
              sourceSku: existing.sourceSku ?? MOONCAKE_CATALOG.sourceSku,
              status: 'active',
            },
            include: { priceTiers: { select: { weightGrams: true, price: true } } },
          })
        : existing;

    await db.productPriceTier.upsert({
      where: {
        productId_weightGrams_unit_unitQty: {
          productId: product.id,
          weightGrams: MOONCAKE_CATALOG.weightGrams,
          unit: MOONCAKE_CATALOG.unit,
          unitQty: 1,
        },
      },
      update: {},
      create: {
        productId: product.id,
        weightGrams: MOONCAKE_CATALOG.weightGrams,
        unit: MOONCAKE_CATALOG.unit,
        unitQty: 1,
        price: MOONCAKE_CATALOG.price,
        cost: MOONCAKE_CATALOG.cost,
      },
    });
    return product;
  }

  const productId = await nextProductId(db);
  const sku = await nextSku(db, Number(productId.slice('PROD-'.length)));
  return db.product.create({
    data: {
      productId,
      sku,
      sourceSku: MOONCAKE_CATALOG.sourceSku,
      name: MOONCAKE_CATALOG.name,
      category: MOONCAKE_CATALOG.category,
      unit: MOONCAKE_CATALOG.unit,
      price: MOONCAKE_CATALOG.price,
      cost: MOONCAKE_CATALOG.cost,
      imageUrl: MOONCAKE_CATALOG.imageUrl,
      notes: MOONCAKE_CATALOG.notes,
      status: 'active',
      vendorId: vendor?.id ?? null,
      reorderPoint: 10,
      priceTiers: {
        create: {
          weightGrams: MOONCAKE_CATALOG.weightGrams,
          unit: MOONCAKE_CATALOG.unit,
          unitQty: 1,
          price: MOONCAKE_CATALOG.price,
          cost: MOONCAKE_CATALOG.cost,
        },
      },
    },
    include: { priceTiers: { select: { weightGrams: true, price: true } } },
  });
}
