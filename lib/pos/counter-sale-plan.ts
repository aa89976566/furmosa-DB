import { counterLineKey } from '@/lib/pos/counter-cart';
import { saleAmountsForQty } from '@/lib/merchant-settlement-sales';

export type RequestedCounterLine = {
  productId: string;
  tierId: string;
  qty: number;
};

export type PricedCounterProduct = {
  productId: string;
  tierId: string;
  name: string;
  specLabel?: string | null;
  price: number;
  priceTiers: { price: number }[];
  suggestedPrice: number | null;
  commissionMode: string | null;
  commissionValue: number | null;
  stock: number;
};

export type PlannedCounterSaleLine = {
  productId: string;
  tierId: string;
  name: string;
  specLabel: string | null;
  qty: number;
  unitPrice: number;
  commissionAmount: number;
  companyRevenue: number;
  balanceAfter: number;
};

export function planCounterSale(
  requested: RequestedCounterLine[],
  catalog: PricedCounterProduct[],
): PlannedCounterSaleLine[] {
  if (requested.length === 0) {
    throw new Error('本單是空的');
  }

  const byKey = new Map(
    catalog.map((item) => [counterLineKey(item.productId, item.tierId), item]),
  );
  const seen = new Set<string>();
  const planned: PlannedCounterSaleLine[] = [];

  for (const line of requested) {
    const qty = Math.floor(line.qty);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error('數量需大於 0');
    }
    const key = counterLineKey(line.productId, line.tierId);
    if (seen.has(key)) {
      throw new Error('同一商品請合併成一列');
    }
    seen.add(key);
    const item = byKey.get(key);
    if (!item) {
      throw new Error('商品不在本店寄賣清單');
    }
    if (qty > item.stock) {
      throw new Error(`${item.name} 庫存不足`);
    }

    const rule =
      item.commissionMode && item.suggestedPrice != null
        ? {
            suggestedPrice: item.suggestedPrice,
            commissionMode: item.commissionMode,
            commissionValue: item.commissionValue ?? 0,
          }
        : undefined;
    const amounts = saleAmountsForQty(
      { price: item.price, priceTiers: item.priceTiers },
      rule,
      qty,
    );

    planned.push({
      productId: item.productId,
      tierId: item.tierId,
      name: item.name,
      specLabel: item.specLabel ?? null,
      qty,
      unitPrice: amounts.unitPrice,
      commissionAmount: amounts.commissionAmount,
      companyRevenue: amounts.companyRevenue,
      balanceAfter: item.stock - qty,
    });
  }

  return planned;
}

export function plannedSaleTotal(lines: PlannedCounterSaleLine[]) {
  return lines.reduce((sum, line) => sum + line.unitPrice * line.qty, 0);
}
