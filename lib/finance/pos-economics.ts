import { Prisma } from '@prisma/client';
import { RECOGNIZED_REFILL_STATUSES } from '@/lib/finance/channels';
import { scopedMerchantId } from '@/lib/finance/access-policy';
import { dollarsToCents } from '@/lib/finance/money';
import { prisma } from '@/lib/prisma';

export type PosEconomicsRow = {
  productId: string;
  sku: string;
  name: string;
  sellingPriceCents: number | null;
  wholesalePricesCents: number[];
  commissionPerUnitCents: number | null;
  stockUnits: number;
  soldQuantity: number;
  salesGrossCents: number | null;
  earnedCommissionCents: number | null;
};

export function toPosEconomicsResponse(input: {
  merchantId: string;
  refillCount: number;
  rows: PosEconomicsRow[];
}) {
  return {
    merchantId: input.merchantId,
    refillCount: input.refillCount,
    rows: input.rows.map((row) => ({
      sku: row.sku,
      name: row.name,
      sellingPriceCents: row.sellingPriceCents,
      wholesalePricesCents: row.wholesalePricesCents,
      commissionPerUnitCents: row.commissionPerUnitCents,
      stockUnits: row.stockUnits,
      soldQuantity: row.soldQuantity,
      salesGrossCents: row.salesGrossCents,
      earnedCommissionCents: row.earnedCommissionCents,
    })),
  };
}

export function posResponseHasCompanyCost(payload: unknown): boolean {
  const serialized = JSON.stringify(payload);
  return ['foodCostCents', 'packagingCostCents', '"cost"', 'companyRevenue', 'contributionCents'].some((key) =>
    serialized.includes(key),
  );
}

export async function loadPosEconomics(sessionMerchantId: string, requestedMerchantId?: string | null) {
  const merchantId = scopedMerchantId(sessionMerchantId, requestedMerchantId);
  const recognized = Prisma.join([...RECOGNIZED_REFILL_STATUSES]);
  const [stocks, rules, wholesales, sales, refillCount] = await Promise.all([
    prisma.merchantStock.groupBy({
      by: ['productId'],
      where: { merchantId },
      _sum: { quantity: true },
    }),
    prisma.merchantProductRule.findMany({
      where: { merchantId },
      select: {
        productId: true,
        suggestedPrice: true,
        commissionMode: true,
        commissionValue: true,
        product: { select: { id: true, sku: true, name: true, price: true } },
      },
    }),
    prisma.merchantWholesalePrice.findMany({
      where: { merchantId },
      select: {
        productId: true,
        unitPrice: true,
        product: { select: { id: true, sku: true, name: true, price: true } },
      },
    }),
    prisma.$queryRaw<Array<{
      product_id: string;
      quantity: number | bigint;
      gross_cents: number | bigint | null;
      commission_cents: number | bigint | null;
    }>>`
      SELECT "productId" AS product_id,
        SUM(ABS(quantity))::int AS quantity,
        CASE
          WHEN SUM(CASE WHEN "unitPrice" IS NULL THEN 1 ELSE 0 END) > 0 THEN NULL
          ELSE ROUND(SUM("unitPrice" * ABS(quantity)) * 100)::bigint
        END AS gross_cents,
        CASE
          WHEN SUM(CASE WHEN "commissionAmount" IS NULL THEN 1 ELSE 0 END) > 0 THEN NULL
          ELSE ROUND(SUM("commissionAmount") * 100)::bigint
        END AS commission_cents
      FROM "MerchantStockTxn"
      WHERE "merchantId" = ${merchantId}
        AND type = 'sale'
      GROUP BY 1
    `,
    prisma.refillOrder.count({
      where: { merchantId, status: { in: [...RECOGNIZED_REFILL_STATUSES] } },
    }),
  ]);

  const catalog = new Map<string, { sku: string; name: string; price: number }>();
  for (const rule of rules) catalog.set(rule.product.id, rule.product);
  for (const price of wholesales) catalog.set(price.product.id, price.product);
  const missingIds = [
    ...stocks.map((row) => row.productId),
    ...sales.map((row) => row.product_id),
  ].filter((id) => !catalog.has(id));
  if (missingIds.length > 0) {
    const extra = await prisma.product.findMany({
      where: { id: { in: missingIds } },
      select: { id: true, sku: true, name: true, price: true },
    });
    for (const product of extra) catalog.set(product.id, product);
  }

  const ruleByProduct = new Map(rules.map((rule) => [rule.productId, rule]));
  const wholesaleByProduct = new Map<string, number[]>();
  for (const price of wholesales) {
    const list = wholesaleByProduct.get(price.productId) ?? [];
    const cents = dollarsToCents(price.unitPrice);
    if (cents != null) list.push(cents);
    wholesaleByProduct.set(price.productId, list);
  }
  const stockByProduct = new Map(stocks.map((row) => [row.productId, row._sum.quantity ?? 0]));
  const salesByProduct = new Map(sales.map((row) => [row.product_id, row]));
  const ids = new Set<string>([
    ...catalog.keys(),
    ...stockByProduct.keys(),
    ...salesByProduct.keys(),
  ]);

  const rows: PosEconomicsRow[] = [...ids].flatMap((productId) => {
    const product = catalog.get(productId);
    if (!product) return [];
    const rule = ruleByProduct.get(productId);
    const selling = dollarsToCents(rule?.suggestedPrice ?? product.price);
    let commission: number | null = null;
    if (rule && selling != null) {
      commission =
        rule.commissionMode === 'percent'
          ? Math.round((selling * rule.commissionValue) / 100)
          : dollarsToCents(rule.commissionValue);
    }
    const sale = salesByProduct.get(productId);
    return [{
      productId,
      sku: product.sku,
      name: product.name,
      sellingPriceCents: selling,
      wholesalePricesCents: wholesaleByProduct.get(productId) ?? [],
      commissionPerUnitCents: commission,
      stockUnits: stockByProduct.get(productId) ?? 0,
      soldQuantity: sale ? Number(sale.quantity) : 0,
      salesGrossCents: sale ? (sale.gross_cents == null ? null : Number(sale.gross_cents)) : null,
      earnedCommissionCents: sale
        ? sale.commission_cents == null
          ? null
          : Number(sale.commission_cents)
        : null,
    }];
  }).sort((a, b) => a.sku.localeCompare(b.sku, 'zh-Hant'));

  return toPosEconomicsResponse({ merchantId, refillCount, rows });
}
