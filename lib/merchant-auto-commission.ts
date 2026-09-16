import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  suggestMerchantCommissionPercent,
  type MerchantCommissionPercent,
} from '@/lib/merchant-commission';
import { merchantSuggestedUnitPrice } from '@/lib/merchant-product-catalog';
import { isConsignmentProductCategory } from '@/lib/product-category';

type Db = Prisma.TransactionClient | typeof prisma;

type ProductForRule = {
  id: string;
  name: string;
  category: string;
  price: number;
  priceTiers?: { price: number }[];
  productCategory?: string | null;
};

/**
 * 為店家×商品寫入分潤規則（肉乾 20%、凍乾 30%）。
 * - 預設：僅在規則不存在時建立，不覆蓋既有（含人工調整）
 * - overwrite: true 時才強制覆寫分潤比例（「依品名自動填分潤」用）
 */
export async function upsertSuggestedMerchantRule(
  db: Db,
  merchantId: string,
  product: ProductForRule,
  options?: { forcePercent?: MerchantCommissionPercent; overwrite?: boolean },
) {
  // 換罐是獨立專案：不得建立或覆寫一般寄賣 20%／30% 規則。
  if (!isConsignmentProductCategory(product.productCategory ?? 'STANDARD')) {
    return null;
  }
  const percent =
    options?.forcePercent ??
    suggestMerchantCommissionPercent({ name: product.name, category: product.category });
  const existing = await db.merchantProductRule.findUnique({
    where: { merchantId_productId: { merchantId, productId: product.id } },
  });

  if (existing && !options?.overwrite) {
    return existing;
  }

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
      notes: `自動：${percent === 30 ? '凍乾 30%' : '肉乾 20%'}`,
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

/** 針對某店所有啟用中的一般商品，依品名覆寫分潤。換罐商品維持獨立流程。 */
export async function autoFillMerchantCommissionRulesForMerchant(
  db: Db,
  merchantId: string,
) {
  const products = await db.product.findMany({
    where: { status: 'active', productCategory: 'STANDARD' },
    include: { priceTiers: { orderBy: { price: 'asc' }, take: 1 } },
  });

  let updated = 0;
  for (const product of products) {
    const rule = await upsertSuggestedMerchantRule(db, merchantId, product, { overwrite: true });
    if (rule) updated += 1;
  }
  return { updated };
}
