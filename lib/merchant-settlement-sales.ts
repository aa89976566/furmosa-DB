import { prisma } from '@/lib/prisma';
import { merchantSuggestedUnitPrice } from '@/lib/merchant-product-catalog';

type ProductForPricing = {
  price: number;
  priceTiers: { price: number }[];
};

type RuleForPricing = {
  suggestedPrice: number;
  commissionMode: string;
  commissionValue: number;
};

function commissionForQty(rule: RuleForPricing, qty: number, unitPrice: number) {
  const perUnit =
    rule.commissionMode === 'percent'
      ? (unitPrice * rule.commissionValue) / 100
      : rule.commissionValue;
  const commissionAmount = perUnit * qty;
  const gross = unitPrice * qty;
  return { commissionAmount, companyRevenue: gross - commissionAmount };
}

export function saleAmountsForQty(
  product: ProductForPricing,
  rule: RuleForPricing | undefined,
  qty: number,
  unitPriceOverride?: number | null,
) {
  const unitPrice =
    unitPriceOverride ??
    merchantSuggestedUnitPrice(
      { price: product.price, priceTiers: product.priceTiers } as Parameters<
        typeof merchantSuggestedUnitPrice
      >[0],
      rule as Parameters<typeof merchantSuggestedUnitPrice>[1],
    );
  const gross = unitPrice * qty;
  const { commissionAmount, companyRevenue } = rule
    ? commissionForQty(rule, qty, unitPrice)
    : { commissionAmount: 0, companyRevenue: gross };
  return {
    unitPrice,
    grossSales: gross,
    commissionAmount,
    companyRevenue,
  };
}

/** 月結納入：sale 流水 + 尚未配對 sale 的盤點減量（adjust 負數） */
export async function fetchSettlementSaleTxns({
  merchantId,
  periodStart,
  periodEnd,
  settlementFilter,
}: {
  merchantId: string;
  periodStart: Date;
  periodEnd: Date;
  settlementFilter: Record<string, unknown>;
}) {
  const txns = await prisma.merchantStockTxn.findMany({
    where: {
      merchantId,
      createdAt: { gte: periodStart, lte: periodEnd },
      ...settlementFilter,
      OR: [{ type: 'sale' }, { type: 'adjust', quantity: { lt: 0 } }],
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          price: true,
          priceTiers: { orderBy: { price: 'asc' }, take: 1 },
        },
      },
      order: { select: { id: true, orderNumber: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const productIds = [...new Set(txns.map((t) => t.productId))];
  const rules = await prisma.merchantProductRule.findMany({
    where: { merchantId, productId: { in: productIds } },
  });
  const ruleByProduct = new Map(rules.map((r) => [r.productId, r]));

  const lines: typeof txns = [];
  for (const t of txns) {
    if (t.type === 'sale') {
      lines.push(t);
      continue;
    }
    if (t.type === 'adjust' && t.quantity < 0) {
      const qty = Math.abs(t.quantity);
      const paired = txns.some(
        (s) =>
          s.type === 'sale' &&
          s.productId === t.productId &&
          Math.abs(s.quantity) === qty &&
          Math.abs(s.createdAt.getTime() - t.createdAt.getTime()) < 5000,
      );
      if (!paired) lines.push(t);
    }
  }

  return lines.map((t) => {
    const qty = Math.abs(t.quantity);
    const rule = ruleByProduct.get(t.productId);
    const amounts =
      t.type === 'sale' && t.unitPrice != null
        ? {
            unitPrice: t.unitPrice,
            grossSales: qty * (t.unitPrice ?? 0),
            commissionAmount: t.commissionAmount ?? 0,
            companyRevenue: t.companyRevenue ?? 0,
          }
        : saleAmountsForQty(
            { price: t.product.price, priceTiers: t.product.priceTiers },
            rule,
            qty,
            t.unitPrice,
          );

    return {
      txn: t,
      qty,
      ...amounts,
      lineSource: t.type === 'sale' ? ('sale' as const) : ('stocktake' as const),
    };
  });
}
