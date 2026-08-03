/**
 * 換罐商品主檔 ↔ 本期口味目錄同步。
 *
 * 對齊專業零售／訂閱系統的 Catalog + Assortment 模式：
 * - Product（productCategory=JAR_EXCHANGE）= 可賣／可叫貨／可出貨身份
 * - RefillFlavour = 本期上架／LINE 展示覆寫，必須掛 productId
 *
 * 計劃價（129／99）仍由 refill constants／plan settings 掌管，不寫進 Product.price 作為付款依據。
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { REFILL_PRICES } from '@/lib/refill/constants';
import { formatFlavourLabel } from '@/lib/jar-exchange/refill-plan-content';

type Db = Prisma.TransactionClient | typeof prisma;

export type FlavourCatalogueInput = {
  code: string;
  name: string;
  weightGrams: number;
  sortOrder?: number;
};

/** 穩定 SKU：RF-{code}，例 RF-chicken-20 */
export function jarFlavourSku(code: string): string {
  return `RF-${code.trim().toLowerCase()}`;
}

/** 穩定商品編號：JAR-CHICKEN-20 */
export function jarFlavourProductId(code: string): string {
  return `JAR-${code.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-')}`;
}

/**
 * 確保口味有對應的 JAR_EXCHANGE Product，並寫回 flavour.productId。
 * 冪等：可重跑。
 */
export async function ensureJarProductForFlavour(
  flavour: FlavourCatalogueInput & { id?: string },
  db: Db = prisma,
): Promise<{ productId: string; created: boolean }> {
  const code = flavour.code.trim();
  const sku = jarFlavourSku(code);
  const productCode = jarFlavourProductId(code);
  const displayName = formatFlavourLabel(flavour.name.trim(), flavour.weightGrams);

  let product = await db.product.findUnique({
    where: { sku },
    select: { id: true, productCategory: true, status: true, name: true },
  });

  let created = false;

  if (!product) {
    const byProductId = await db.product.findUnique({
      where: { productId: productCode },
      select: { id: true, productCategory: true, status: true, name: true },
    });
    product = byProductId;
  }

  if (!product) {
    product = await db.product.create({
      data: {
        productId: productCode,
        sku,
        sourceSku: code,
        name: displayName,
        category: 'freeze_dried',
        productCategory: 'JAR_EXCHANGE',
        style: flavour.name.trim(),
        unit: '罐',
        // 會計參考價＝換罐價；LIFF 實收仍讀 REFILL_PRICES
        price: REFILL_PRICES.exchange,
        cost: 0,
        reorderPoint: 5,
        status: 'active',
        notes: `換罐口味自動對應（code=${code}）`,
      },
      select: { id: true, productCategory: true, status: true, name: true },
    });
    created = true;
  } else {
    const patch: Prisma.ProductUpdateInput = {};
    if (product.productCategory !== 'JAR_EXCHANGE') {
      patch.productCategory = 'JAR_EXCHANGE';
    }
    if (product.status !== 'active') {
      patch.status = 'active';
    }
    if (product.name !== displayName) {
      patch.name = displayName;
    }
    if (Object.keys(patch).length > 0) {
      product = await db.product.update({
        where: { id: product.id },
        data: patch,
        select: { id: true, productCategory: true, status: true, name: true },
      });
    }
  }

  if (flavour.id) {
    await db.refillFlavour.update({
      where: { id: flavour.id },
      data: { productId: product.id },
    });
  } else {
    await db.refillFlavour.updateMany({
      where: { code },
      data: { productId: product.id },
    });
  }

  return { productId: product.id, created };
}

/** 把尚未連結的口味全部補上 Product（後台／POS／建置時呼叫） */
export async function syncJarExchangeCatalogue(db: Db = prisma): Promise<{
  linked: number;
  created: number;
}> {
  const flavours = await db.refillFlavour.findMany({
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      code: true,
      name: true,
      weightGrams: true,
      sortOrder: true,
      productId: true,
    },
  });

  let linked = 0;
  let created = 0;

  for (const f of flavours) {
    if (f.productId) {
      // 仍強制對應商品為 JAR_EXCHANGE + active
      await db.product.updateMany({
        where: { id: f.productId },
        data: { productCategory: 'JAR_EXCHANGE', status: 'active' },
      });
      linked += 1;
      continue;
    }
    const result = await ensureJarProductForFlavour(f, db);
    linked += 1;
    if (result.created) created += 1;
  }

  return { linked, created };
}

/**
 * 將指定 Product 標為換罐可叫貨，並可選掛到口味。
 */
export async function linkProductToFlavour(opts: {
  productId: string;
  flavourId: string;
}): Promise<void> {
  const product = await prisma.product.findUnique({
    where: { id: opts.productId },
    select: { id: true },
  });
  if (!product) throw new Error('找不到商品');

  await prisma.$transaction(async (tx) => {
    // 一個商品同時只能掛一個口味 slot
    await tx.refillFlavour.updateMany({
      where: { productId: opts.productId, NOT: { id: opts.flavourId } },
      data: { productId: null },
    });
    await tx.product.update({
      where: { id: opts.productId },
      data: { productCategory: 'JAR_EXCHANGE' },
    });
    await tx.refillFlavour.update({
      where: { id: opts.flavourId },
      data: { productId: opts.productId },
    });
  });
}
