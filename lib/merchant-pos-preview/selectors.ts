import {
  ADD_TO_CART,
  AT_STOCK_CAP,
  FIX_CART_QTY,
  SELECT_SPEC_HINT,
  VIEW_RESTOCK,
  cartHasQtyLabel,
} from './copy';
import { PRODUCTS, SALES, SETTLEMENTS } from './fixtures';
import type {
  CartLine,
  CartTotals,
  CatalogAddState,
  CatalogRow,
  MerchantPosSession,
  Product,
  ProductVariant,
  SaleSnapshot,
  SettlementSnapshot,
  SkuAvailability,
  StockLevel,
} from './types';
import { parseCartQtyInput, parsePositiveIntTwd } from './validators';

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

export function visibleVariantsForProduct(product: Product, query: string): ProductVariant[] {
  const q = normalizeQuery(query);
  if (!q) return product.variants;
  if (product.name.toLowerCase().includes(q)) return product.variants;
  return product.variants.filter(
    (variant) => variant.sku.toLowerCase().includes(q) || variant.specLabel.toLowerCase().includes(q),
  );
}

function makeSkuAvailability(partial: Omit<SkuAvailability, 'cartQty' | 'qtyInputValid'>): SkuAvailability {
  return {
    ...partial,
    cartQty: partial.committedCartQty,
    qtyInputValid: partial.qtyDraftValid,
  };
}

export function filterCatalog(query: string): CatalogRow[] {
  return PRODUCTS.map((product) => {
    const visibleVariants = visibleVariantsForProduct(product, query);
    return {
      product,
      visibleVariants,
      selected: null,
      stockLevel: null,
      matches: visibleVariants.length > 0,
      add: catalogAddAvailability(product, null, []),
    };
  }).filter((row) => row.matches);
}

export function skuAvailability(skuId: string, cart: CartLine[]): SkuAvailability {
  const variant = findVariant(skuId);
  const line = cart.find((item) => item.skuId === skuId);
  const committedCartQty = line?.qty ?? 0;

  if (!variant) {
    return makeSkuAvailability({
      skuId,
      availableQty: 0,
      committedCartQty,
      availableToAdd: 0,
      qtyDraftValid: true,
      canSelect: false,
      canAdd: false,
      reason: 'unknown_sku',
    });
  }

  const availableToAdd = Math.max(0, variant.availableQty - committedCartQty);
  if (variant.availableQty <= 0) {
    return makeSkuAvailability({
      skuId,
      availableQty: variant.availableQty,
      committedCartQty,
      availableToAdd: 0,
      qtyDraftValid: true,
      canSelect: true,
      canAdd: false,
      reason: 'sold_out',
    });
  }

  if (!line) {
    return makeSkuAvailability({
      skuId,
      availableQty: variant.availableQty,
      committedCartQty: 0,
      availableToAdd,
      qtyDraftValid: true,
      canSelect: true,
      canAdd: availableToAdd > 0,
      reason: null,
    });
  }

  const parsed = parseCartQtyInput(line.qtyInput, variant.availableQty);
  if (!parsed.ok) {
    return makeSkuAvailability({
      skuId,
      availableQty: variant.availableQty,
      committedCartQty,
      availableToAdd,
      qtyDraftValid: false,
      canSelect: true,
      canAdd: false,
      reason: 'invalid_qty',
    });
  }

  const atCap = availableToAdd <= 0;
  return makeSkuAvailability({
    skuId,
    availableQty: variant.availableQty,
    committedCartQty,
    availableToAdd,
    qtyDraftValid: true,
    canSelect: true,
    canAdd: !atCap,
    reason: atCap ? 'at_cap' : null,
  });
}

export function catalogAddAvailability(
  product: Product,
  selected: ProductVariant | null,
  cart: CartLine[],
): CatalogAddState {
  const allSoldOut = product.variants.every(
    (variant) => skuAvailability(variant.skuId, cart).reason === 'sold_out',
  );
  if (allSoldOut || (selected && skuAvailability(selected.skuId, cart).reason === 'sold_out')) {
    const committed = selected ? skuAvailability(selected.skuId, cart).committedCartQty : 0;
    return {
      canAdd: false,
      showRestock: true,
      reason: 'sold_out',
      cartQty: committed,
      buttonLabel: VIEW_RESTOCK,
      hint: null,
    };
  }
  if (!selected) {
    return {
      canAdd: false,
      showRestock: false,
      reason: 'select_spec',
      cartQty: 0,
      buttonLabel: ADD_TO_CART,
      hint: SELECT_SPEC_HINT,
    };
  }

  const availability = skuAvailability(selected.skuId, cart);
  if (availability.reason === 'invalid_qty') {
    return {
      canAdd: false,
      showRestock: false,
      reason: 'invalid_qty',
      cartQty: availability.committedCartQty,
      buttonLabel: FIX_CART_QTY,
      hint: FIX_CART_QTY,
    };
  }
  if (availability.reason === 'at_cap') {
    return {
      canAdd: false,
      showRestock: false,
      reason: 'at_cap',
      cartQty: availability.committedCartQty,
      buttonLabel: AT_STOCK_CAP,
      hint: cartHasQtyLabel(availability.committedCartQty),
    };
  }

  return {
    canAdd: true,
    showRestock: false,
    reason: null,
    cartQty: availability.committedCartQty,
    buttonLabel: ADD_TO_CART,
    hint: availability.committedCartQty > 0 ? cartHasQtyLabel(availability.committedCartQty) : null,
  };
}

export function catalogRows(session: MerchantPosSession): CatalogRow[] {
  return filterCatalog(session.query).map((row) => {
    const visibleVariants = visibleVariantsForProduct(row.product, session.query);
    const selectedId = session.selectedSkuByProductId[row.product.productId];
    const sessionSelected = row.product.variants.find((variant) => variant.skuId === selectedId) ?? null;
    const selected =
      sessionSelected && visibleVariants.some((variant) => variant.skuId === sessionSelected.skuId)
        ? sessionSelected
        : null;
    const add = catalogAddAvailability(row.product, selected, session.cart);
    const displayVariant = selected ?? (add.showRestock && visibleVariants.length === 1 ? visibleVariants[0] : null);
    return {
      ...row,
      visibleVariants,
      selected,
      stockLevel: displayVariant ? stockLevelOf(displayVariant) : null,
      add,
    };
  });
}

export function cartLineTotals(line: CartLine): {
  listLineTwd: number | null;
  actualLineTwd: number | null;
  priceError: string | null;
  qtyError: string | null;
  variant: ProductVariant | null;
} {
  const variant = findVariant(line.skuId);
  if (!variant) {
    return {
      listLineTwd: null,
      actualLineTwd: null,
      priceError: '找不到示意規格。',
      qtyError: null,
      variant: null,
    };
  }
  const parsedPrice = parsePositiveIntTwd(line.actualUnitPriceInput);
  const parsedQty = parseCartQtyInput(line.qtyInput, variant.availableQty);
  const qty = parsedQty.ok ? parsedQty.value : null;
  return {
    variant,
    listLineTwd: qty != null ? variant.listPriceTwd * qty : null,
    actualLineTwd: parsedPrice.ok && qty != null ? parsedPrice.value * qty : null,
    priceError: parsedPrice.ok ? null : parsedPrice.error,
    qtyError: parsedQty.ok ? null : parsedQty.error,
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
    if (result.actualLineTwd == null || result.priceError || result.qtyError) {
      blocked = true;
      if (!firstError) firstError = result.qtyError ?? result.priceError;
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
        statusLabel: '已提出退款申請',
        note: '門市已提出退款申請，等待總部審核。此頁沒有審核按鈕。',
        nextPeriodNote: null,
        inventoryNote: '庫存處置由總部結果決定。',
        commissionNote: '佣金回沖以總部結算結果為準。',
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

export function sumHqPerspectiveSigned(rows: SettlementSnapshot['ledger']): number {
  return rows.reduce((sum, row) => sum + row.hqPerspectiveSignedTwd, 0);
}

export function netDirectionFromSignedSum(sum: number): SettlementSnapshot['netDirection'] {
  if (sum > 0) return 'hq_owes_merchant';
  if (sum < 0) return 'merchant_owes_hq';
  return 'balanced';
}

export function availableAfterCart(skuId: string, cart: CartLine[]): number {
  return skuAvailability(skuId, cart).availableToAdd;
}

export function cartDockState(cart: CartLine[]): {
  itemCount: number;
  blocked: boolean;
  dealTwd: number | null;
  notice: string | null;
} {
  const totals = cartTotals(cart);
  const hasInvalidQty = cart.some((line) => Boolean(cartLineTotals(line).qtyError));
  return {
    itemCount: totals.itemCount,
    blocked: totals.blocked,
    dealTwd: totals.blocked ? null : totals.actualSubtotalTwd,
    notice: hasInvalidQty ? FIX_CART_QTY : null,
  };
}
