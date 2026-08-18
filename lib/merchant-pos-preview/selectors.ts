import { PRODUCTS, SALES, SETTLEMENTS } from './fixtures';
import type {
  CartLine,
  CartTotals,
  CatalogRow,
  MerchantPosSession,
  Product,
  ProductVariant,
  SaleSnapshot,
  SettlementSnapshot,
  StockLevel,
} from './types';
import { parsePositiveIntTwd } from './validators';

export function listProducts(): Product[] {
  return PRODUCTS;
}

export function findVariant(skuId: string): ProductVariant | null {
  for (const product of PRODUCTS) {
    const found = product.variants.find((variant) => variant.skuId === skuId);
    if (found) return found;
  }
  return null;
}

export function findProductBySku(skuId: string): Product | null {
  return PRODUCTS.find((product) => product.variants.some((variant) => variant.skuId === skuId)) ?? null;
}

export function stockLevelOf(variant: ProductVariant): StockLevel {
  if (variant.availableQty <= 0) return 'sold_out';
  if (variant.availableQty <= variant.lowStockAt) return 'low';
  return 'normal';
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function variantMatchesQuery(product: Product, variant: ProductVariant, query: string): boolean {
  const q = normalizeQuery(query);
  if (!q) return true;
  return (
    product.name.toLowerCase().includes(q) ||
    variant.sku.toLowerCase().includes(q) ||
    variant.specLabel.toLowerCase().includes(q)
  );
}

export function filterCatalog(query: string): CatalogRow[] {
  return PRODUCTS.map((product) => {
    const matchingVariants = product.variants.filter((variant) =>
      variantMatchesQuery(product, variant, query),
    );
    return {
      product,
      selected: null,
      stockLevel: null,
      matches: matchingVariants.length > 0,
    };
  }).filter((row) => row.matches);
}

export function catalogRows(session: MerchantPosSession): CatalogRow[] {
  return filterCatalog(session.query).map((row) => {
    const selectedId = session.selectedSkuByProductId[row.product.productId];
    const selected = row.product.variants.find((variant) => variant.skuId === selectedId) ?? null;
    return {
      ...row,
      selected,
      stockLevel: selected ? stockLevelOf(selected) : null,
    };
  });
}

export function cartLineTotals(line: CartLine): {
  listLineTwd: number | null;
  actualLineTwd: number | null;
  priceError: string | null;
  variant: ProductVariant | null;
} {
  const variant = findVariant(line.skuId);
  if (!variant) {
    return { listLineTwd: null, actualLineTwd: null, priceError: '找不到示意規格。', variant: null };
  }
  const parsed = parsePositiveIntTwd(line.actualUnitPriceInput);
  return {
    variant,
    listLineTwd: variant.listPriceTwd * line.qty,
    actualLineTwd: parsed.ok ? parsed.value * line.qty : null,
    priceError: parsed.ok ? null : parsed.error,
  };
}

export function cartTotals(cart: CartLine[]): CartTotals & { blocked: boolean; firstError: string | null } {
  let itemCount = 0;
  let listSubtotalTwd = 0;
  let actualSubtotalTwd = 0;
  let blocked = cart.length === 0;
  let firstError: string | null = cart.length === 0 ? '購物車是空的。' : null;

  for (const line of cart) {
    const result = cartLineTotals(line);
    itemCount += line.qty;
    if (result.listLineTwd != null) listSubtotalTwd += result.listLineTwd;
    if (result.actualLineTwd == null || result.priceError) {
      blocked = true;
      if (!firstError) firstError = result.priceError;
    } else {
      actualSubtotalTwd += result.actualLineTwd;
    }
  }

  return {
    itemCount,
    listSubtotalTwd,
    actualSubtotalTwd: blocked ? 0 : actualSubtotalTwd,
    allowanceTwd: blocked ? 0 : listSubtotalTwd - actualSubtotalTwd,
    blocked,
    firstError,
  };
}

export function restockCandidates() {
  return PRODUCTS.flatMap((product) =>
    product.variants
      .filter((variant) => stockLevelOf(variant) !== 'normal')
      .map((variant) => ({ product, variant, stockLevel: stockLevelOf(variant) })),
  );
}

export function visibleSales(session: MerchantPosSession): SaleSnapshot[] {
  return SALES.map((sale) => {
    if (!session.localRefunds[sale.saleId]) return sale;
    return {
      ...sale,
      canMerchantRequestRefund: false,
      refund: sale.refund ?? {
        status: 'requested',
        statusLabel: '退款申請中',
        note: '店家已申請，等待總部處理。此頁沒有核准按鈕。',
        nextPeriodNote: null,
        inventoryNote: '庫存處置由總部結果決定，畫面只顯示快照。',
        commissionNote: '佣金回沖以伺服器結果為準，此頁不重算。',
        inventoryDisposition: 'pending',
        conditionLabel: null,
        lossReason: null,
        sellableStockReturned: false,
        settledInLockedPeriod: false,
      },
    };
  });
}

export function settlementViews(): SettlementSnapshot[] {
  return SETTLEMENTS;
}

export function expectedMerchantNetTwd(row: SettlementSnapshot): number {
  return (
    row.merchantCollectedSalesTwd -
    row.merchantCollectedCommissionTwd +
    row.merchantCollectedVoucherSubsidyTwd -
    row.merchantCollectedRefundAdjustmentTwd
  );
}

export function expectedFurmosaNetTwd(row: SettlementSnapshot): number {
  return (
    row.furmosaCollectedSalesTwd -
    row.furmosaCollectedCommissionTwd +
    row.furmosaCollectedVoucherSubsidyTwd -
    row.furmosaCollectedRefundAdjustmentTwd
  );
}

export function expectedTotalNetTwd(row: SettlementSnapshot): number {
  return row.merchantCollectedNetTwd + row.furmosaCollectedNetTwd;
}

export function expectedNetDirection(netAmountTwd: number): SettlementSnapshot['netDirection'] {
  if (netAmountTwd > 0) return 'hq_owes_merchant';
  if (netAmountTwd < 0) return 'merchant_owes_hq';
  return 'balanced';
}

export function availableAfterCart(skuId: string, cart: CartLine[]): number {
  const variant = findVariant(skuId);
  if (!variant) return 0;
  const inCart = cart.find((line) => line.skuId === skuId)?.qty ?? 0;
  return variant.availableQty - inCart;
}
