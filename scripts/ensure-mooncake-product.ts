/**
 * 只補上中秋「地瓜山藥雞肉月餅」，不重跑整份單價表。
 *
 * 預設 dry-run，不會寫入資料庫。
 * 確認後再加 --apply。
 *
 * 範例：
 *   npx tsx scripts/ensure-mooncake-product.ts
 *   npx tsx scripts/ensure-mooncake-product.ts --apply
 */
import { PrismaClient } from '@prisma/client';
import { MOONCAKE_CATALOG } from '../lib/products/mooncake-catalog';

const pad = (n: number, width = 4) => String(n).padStart(width, '0');

function wantsApply(argv: string[]) {
  return argv.includes('--apply');
}

function createPrisma() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error('缺少 DATABASE_URL / DIRECT_URL');
  }
  return new PrismaClient({
    datasources: { db: { url } },
  });
}

async function nextProductId(prisma: PrismaClient) {
  const last = await prisma.product.findFirst({
    where: { productId: { startsWith: 'PROD-' } },
    orderBy: { productId: 'desc' },
  });
  const seq = last ? Number(last.productId.slice('PROD-'.length)) + 1 : 1;
  return `PROD-${pad(seq, 4)}`;
}

async function nextSku(prisma: PrismaClient, productSeq: number) {
  let seq = productSeq;
  let sku = `FUR-${pad(seq, 4)}`;
  while (await prisma.product.findUnique({ where: { sku } })) {
    seq += 1;
    sku = `FUR-${pad(seq, 4)}`;
  }
  return sku;
}

async function findMooncake(prisma: PrismaClient) {
  const bySku = await prisma.product.findFirst({
    where: { sourceSku: MOONCAKE_CATALOG.sourceSku },
    include: { priceTiers: true, vendor: true },
  });
  if (bySku) return bySku;

  const byName = await prisma.product.findFirst({
    where: { name: MOONCAKE_CATALOG.name },
    include: { priceTiers: true, vendor: true },
  });
  if (byName) return byName;

  const namedMooncakes = await prisma.product.findMany({
    where: { name: { contains: '月餅' } },
    include: { priceTiers: true, vendor: true },
  });
  if (namedMooncakes.length === 1) return namedMooncakes[0];
  if (namedMooncakes.length > 1) {
    throw new Error(
      `找到多筆名稱含「月餅」的商品（${namedMooncakes.map((p) => p.name).join('、')}），請先確認要更新哪一筆`,
    );
  }
  return null;
}

async function main() {
  const apply = wantsApply(process.argv.slice(2));
  const prisma = createPrisma();

  try {
    const vendor = await prisma.vendor.findFirst({
      where: { name: MOONCAKE_CATALOG.vendor, status: 'active' },
      select: { id: true, name: true, vendorId: true },
    });
    if (!vendor) {
      throw new Error(`找不到廠商「${MOONCAKE_CATALOG.vendor}」，請先確認廠商主檔`);
    }

    const existing = await findMooncake(prisma);
    const productData = {
      name: MOONCAKE_CATALOG.name,
      sourceSku: MOONCAKE_CATALOG.sourceSku,
      category: MOONCAKE_CATALOG.category,
      unit: MOONCAKE_CATALOG.unit,
      price: MOONCAKE_CATALOG.price,
      imageUrl: MOONCAKE_CATALOG.imageUrl,
      notes: MOONCAKE_CATALOG.notes,
      status: 'active',
      vendorId: vendor.id,
    };

    console.log(apply ? '將寫入商品主檔：' : '預覽（尚未寫入，加上 --apply 才會新增）：');
    console.log(
      JSON.stringify(
        {
          vendor: vendor.name,
          sourceSku: productData.sourceSku,
          name: productData.name,
          unit: productData.unit,
          price: productData.price,
          weightGrams: MOONCAKE_CATALOG.weightGrams,
          existingProductId: existing?.productId ?? null,
          existingSku: existing?.sku ?? null,
        },
        null,
        2,
      ),
    );

    if (!apply) {
      console.log('未加 --apply，沒有變更資料庫。');
      return;
    }

    const product = existing
      ? await prisma.product.update({
          where: { id: existing.id },
          data: productData,
        })
      : await (async () => {
          const productId = await nextProductId(prisma);
          const sku = await nextSku(prisma, Number(productId.slice('PROD-'.length)));
          return prisma.product.create({
            data: {
              productId,
              sku,
              cost: 0,
              reorderPoint: 10,
              ...productData,
            },
          });
        })();

    await prisma.productPriceTier.upsert({
      where: {
        productId_weightGrams_unit_unitQty: {
          productId: product.id,
          weightGrams: MOONCAKE_CATALOG.weightGrams,
          unit: MOONCAKE_CATALOG.unit,
          unitQty: 1,
        },
      },
      update: {
        price: MOONCAKE_CATALOG.price,
      },
      create: {
        productId: product.id,
        weightGrams: MOONCAKE_CATALOG.weightGrams,
        unit: MOONCAKE_CATALOG.unit,
        unitQty: 1,
        price: MOONCAKE_CATALOG.price,
      },
    });

    console.log(
      JSON.stringify(
        {
          action: existing ? 'updated' : 'created',
          productId: product.productId,
          sku: product.sku,
          sourceSku: product.sourceSku,
          name: product.name,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
