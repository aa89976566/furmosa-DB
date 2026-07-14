import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  suggestMerchantCommissionPercent,
  type MerchantCommissionPercent,
} from '@/lib/merchant-commission';
import { merchantSuggestedUnitPrice } from '@/lib/merchant-product-catalog';

type Db = Prisma.TransactionClient | typeof prisma;

type ProductForRule = {
  id: string;
  name: string;
  category: string;
  price: number;
  priceTiers?: { price: number }[];
};

/**
 * 為店家×商品寫入／更新分潤規則（肉乾 20%、凍乾 30%）。
 * 新建時用建議售價；更新時保留既有建議售價，只校正分潤比例。
 */
export async function upsertSuggestedMerchantRule(
  db: Db,
  merchantId: string,
  product: ProductForRule,
  options?: { forcePercent?: MerchantCommissionPercent },
) {
  const percent =
    options?.forcePercent ??
    suggestMerchantCommissionPercent({ name: product.name, category: product.category });
  const existing = await db.merchantProductRule.findUnique({
    where: { merchantId_productId: { merchantId, productId: product.id } },
  });
  const suggestedPrice =
    existing?.suggestedPrice ??
    merchantSuggestedUnitPrice(
      {
        id: product.id,
        name: product.name,
        sku: '',
        price: product.price,
        priceTiers: product.priceTiers ?? [],
      },
      null,
    );

  return db.merchantProductRule.upsert({
    where: { merchantId_productId: { merchantId, productId: product.id } },
    update: {
      commissionMode: 'percent',
      commissionValue: percent,
      notes: existing?.notes ?? `自動：${percent === 30 ? '凍乾 30%' : '肉乾 20%'}`,
    },
    create: {
      merchantId,
      productId: product.id,
      suggestedPrice,
      commissionMode: 'percent',
      commissionValue: percent,
      notes: `自動：${percent === 30 ? '凍乾 30%' : '肉乾 20%'}`,
    },
  });
}

/** 針對某店所有有庫存／已有規則的商品，依品名自動填寫分潤 */
export async function autoFillMerchantCommissionRulesForMerchant(
  db: Db,
  merchantId: string,
) {
  const [stocks, rules] = await Promise.all([
    db.merchantStock.findMany({
      where: { merchantId },
      select: { productId: true },
      distinct: ['productId'],
    }),
    db.merchantProductRule.findMany({
      where: { merchantId },
      select: { productId: true },
    }),
  ]);
  const productIds = [
    ...new Set([...stocks.map((s) => s.productId), ...rules.map((r) => r.productId)]),
  ];
  if (productIds.length === 0) return { updated: 0 };

  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    include: { priceTiers: { orderBy: { price: 'asc' }, take: 1 } },
  });

  let updated = 0;
  for (const product of products) {
    await upsertSuggestedMerchantRule(db, merchantId, product);
    updated += 1;
  }
  return { updated };
}
