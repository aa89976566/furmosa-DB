import {
  COMPLETE_SALE_CONFIRM_BODY,
  REFUND_ALREADY,
  REFUND_SUCCESS,
  RESTOCK_ALREADY_SENT,
  RESTOCK_EMPTY_DRAFT,
  RESTOCK_SUCCESS,
  SALE_SUCCESS,
  qtyOverStockError,
} from './copy';
import { PRODUCTS } from './fixtures';
import {
  availableAfterCart,
  cartLineTotals,
  cartTotals,
  findProductBySku,
  findVariant,
  restockCandidates,
  skuAvailability,
} from './selectors';
import type { CartLine, DemoReceipt, MerchantPosSession, TabId } from './types';
import { parseCartQtyInput, parsePositiveIntQty } from './validators';

function makeCartLine(skuId: string, qty: number, listPriceTwd: number): CartLine {
  return {
    skuId,
    qty,
    qtyInput: String(qty),
    actualUnitPriceInput: String(listPriceTwd),
  };
}

export function createSession(): MerchantPosSession {
  const restockQtyBySkuId: Record<string, string> = {};
  for (const row of restockCandidates()) {
    restockQtyBySkuId[row.variant.skuId] = String(row.variant.suggestedRestockQty);
  }

  return {
    tab: 'checkout',
    query: '',
    selectedSkuByProductId: {},
    cart: [],
    cartOpen: false,
    cartDialogStep: 'lines',
    refundConfirmSaleId: null,
    demoReceipts: [],
    receiptSeq: 0,
    saleNotice: null,
    restockQtyBySkuId,
    restockDraft: [],
    restockSubmitting: false,
    restockSubmitted: false,
    restockNotice: null,
    localRefunds: {},
    refundNotice: null,
  };
}

export function setTab(session: MerchantPosSession, tab: TabId): MerchantPosSession {
  if (tab === 'checkout') return { ...session, tab };
  return { ...session, tab, cartOpen: false, cartDialogStep: 'lines' };
}

export function setQuery(session: MerchantPosSession, query: string): MerchantPosSession {
  return { ...session, query };
}

export function selectVariant(
  session: MerchantPosSession,
  productId: string,
  skuId: string,
): MerchantPosSession {
  const product = PRODUCTS.find((item) => item.productId === productId);
  const variant = product?.variants.find((item) => item.skuId === skuId);
  if (!variant) return session;
  if (!skuAvailability(variant.skuId, session.cart).canSelect) return session;
  return {
    ...session,
    selectedSkuByProductId: {
      ...session.selectedSkuByProductId,
      [productId]: skuId,
    },
  };
}

export function addSelectedToCart(
  session: MerchantPosSession,
  productId: string,
): MerchantPosSession {
  const skuId = session.selectedSkuByProductId[productId];
  if (!skuId) return session;
  if (!skuAvailability(skuId, session.cart).canAdd) return session;
  return addCartQty(session, skuId, 1);
}

export function addCartQty(
  session: MerchantPosSession,
  skuId: string,
  delta: number,
): MerchantPosSession {
  const variant = findVariant(skuId);
  if (!variant) return session;

  if (delta > 0) {
    const availability = skuAvailability(skuId, session.cart);
    if (!availability.canAdd) {
      if (availability.reason === 'at_cap' || availability.reason === 'sold_out') {
        return {
          ...session,
          saleNotice: qtyOverStockError(Math.max(availability.availableQty, 1)),
        };
      }
      return session;
    }
  }

  const current = session.cart.find((line) => line.skuId === skuId);
  const nextQty = (current?.qty ?? 0) + delta;
  if (nextQty <= 0) {
    return {
      ...session,
      cart: session.cart.filter((line) => line.skuId !== skuId),
    };
  }
  return applyCartQty(session, skuId, String(nextQty));
}

export function setCartQtyInput(
  session: MerchantPosSession,
  skuId: string,
  raw: string,
): MerchantPosSession {
  return applyCartQty(session, skuId, raw, { draft: true });
}

export function commitCartQty(session: MerchantPosSession, skuId: string): MerchantPosSession {
  const current = session.cart.find((line) => line.skuId === skuId);
  if (!current) return session;
  return applyCartQty(session, skuId, current.qtyInput);
}

function applyCartQty(
  session: MerchantPosSession,
  skuId: string,
  raw: string,
  opts: { draft?: boolean } = {},
): MerchantPosSession {
  const variant = findVariant(skuId);
  if (!variant) return session;
  const current = session.cart.find((line) => line.skuId === skuId);
  const parsed = parseCartQtyInput(raw, variant.availableQty);

  if (parsed.ok) {
    const nextLine: CartLine = current
      ? { ...current, qty: parsed.value, qtyInput: String(parsed.value) }
      : makeCartLine(skuId, parsed.value, variant.listPriceTwd);
    const cart = current
      ? session.cart.map((line) => (line.skuId === skuId ? nextLine : line))
      : [...session.cart, nextLine];
    return {
      ...session,
      cart,
      saleNotice: null,
      cartOpen: session.cartOpen,
      cartDialogStep: session.cartDialogStep,
    };
  }

  if (opts.draft && current) {
    return {
      ...session,
      cart: session.cart.map((line) => (line.skuId === skuId ? { ...line, qtyInput: raw } : line)),
      cartOpen: session.cartOpen,
      cartDialogStep: session.cartDialogStep,
    };
  }

  return {
    ...session,
    saleNotice: parsed.error,
    cartOpen: session.cartOpen,
    cartDialogStep: session.cartDialogStep,
  };
}

export function removeCartLine(session: MerchantPosSession, skuId: string): MerchantPosSession {
  return { ...session, cart: session.cart.filter((line) => line.skuId !== skuId) };
}

export function setActualUnitPrice(
  session: MerchantPosSession,
  skuId: string,
  actualUnitPriceInput: string,
): MerchantPosSession {
  return {
    ...session,
    cart: session.cart.map((line) =>
      line.skuId === skuId ? { ...line, actualUnitPriceInput } : line,
    ),
    cartOpen: session.cartOpen,
    cartDialogStep: session.cartDialogStep,
  };
}

export function setCartOpen(session: MerchantPosSession, cartOpen: boolean): MerchantPosSession {
  return {
    ...session,
    cartOpen,
    cartDialogStep: 'lines',
    refundConfirmSaleId: cartOpen ? null : session.refundConfirmSaleId,
  };
}

export function openCompleteConfirm(session: MerchantPosSession): MerchantPosSession {
  const totals = cartTotals(session.cart);
  if (totals.blocked || !session.cartOpen) return session;
  return { ...session, cartOpen: true, cartDialogStep: 'confirm', refundConfirmSaleId: null };
}

export function closeCompleteConfirm(session: MerchantPosSession): MerchantPosSession {
  if (!session.cartOpen) return session;
  return { ...session, cartOpen: true, cartDialogStep: 'lines' };
}

export function escapeActiveDialog(session: MerchantPosSession): MerchantPosSession {
  if (session.refundConfirmSaleId) return closeRefundConfirm(session);
  if (session.cartOpen && session.cartDialogStep === 'confirm') return closeCompleteConfirm(session);
  if (session.cartOpen) return setCartOpen(session, false);
  return session;
}

export function openPreviewDialogCount(session: MerchantPosSession): number {
  return Number(session.cartOpen) + Number(Boolean(session.refundConfirmSaleId));
}

export function activePreviewDialog(session: MerchantPosSession): 'none' | 'cart' | 'refund' {
  if (session.cartOpen && session.refundConfirmSaleId) return 'cart';
  if (session.cartOpen) return 'cart';
  if (session.refundConfirmSaleId) return 'refund';
  return 'none';
}

export function completeDemoSale(session: MerchantPosSession): MerchantPosSession {
  const totals = cartTotals(session.cart);
  if (totals.blocked) return session;

  const lines = session.cart.map((line) => {
    const result = cartLineTotals(line);
    const product = findProductBySku(line.skuId);
    const variant = result.variant;
    const actualUnitPriceTwd = Number(line.actualUnitPriceInput);
    return {
      skuId: line.skuId,
      name: product?.name ?? '',
      specLabel: variant?.specLabel ?? '',
      qty: line.qty,
      listPriceTwd: variant?.listPriceTwd ?? 0,
      actualUnitPriceTwd,
      listLineTwd: result.listLineTwd ?? 0,
      actualLineTwd: result.actualLineTwd ?? 0,
    };
  });

  const receiptSeq = session.receiptSeq + 1;
  const receipt: DemoReceipt = {
    receiptId: `DEMO-RCPT-${String(receiptSeq).padStart(3, '0')}`,
    notice: SALE_SUCCESS,
    itemCount: totals.itemCount,
    listSubtotalTwd: totals.listSubtotalTwd,
    actualSubtotalTwd: totals.actualSubtotalTwd,
    allowanceTwd: totals.allowanceTwd,
    lines,
  };

  return {
    ...session,
    cart: [],
    cartOpen: false,
    cartDialogStep: 'lines',
    demoReceipts: [receipt, ...session.demoReceipts],
    receiptSeq,
    saleNotice: SALE_SUCCESS,
  };
}

export function setRestockQty(
  session: MerchantPosSession,
  skuId: string,
  raw: string,
): MerchantPosSession {
  return {
    ...session,
    restockQtyBySkuId: { ...session.restockQtyBySkuId, [skuId]: raw },
  };
}

export function addRestockLine(session: MerchantPosSession, skuId: string): MerchantPosSession {
  if (session.restockSubmitted) {
    return { ...session, restockNotice: RESTOCK_ALREADY_SENT };
  }
  const variant = findVariant(skuId);
  if (!variant) return session;
  const parsed = parsePositiveIntQty(session.restockQtyBySkuId[skuId] ?? '');
  if (!parsed.ok) {
    return { ...session, restockNotice: parsed.error };
  }
  const existing = session.restockDraft.find((line) => line.skuId === skuId);
  const restockDraft = existing
    ? session.restockDraft.map((line) =>
        line.skuId === skuId ? { ...line, qty: parsed.value } : line,
      )
    : [...session.restockDraft, { skuId, qty: parsed.value }];
  return { ...session, restockDraft, restockNotice: null };
}

export function addAllRestockCandidates(session: MerchantPosSession): MerchantPosSession {
  let next = session;
  for (const row of restockCandidates()) {
    next = addRestockLine(next, row.variant.skuId);
  }
  return next;
}

export function submitRestockDraft(session: MerchantPosSession): MerchantPosSession {
  if (session.restockSubmitted || session.restockSubmitting) {
    return { ...session, restockNotice: RESTOCK_ALREADY_SENT };
  }
  if (session.restockDraft.length === 0) {
    return { ...session, restockNotice: RESTOCK_EMPTY_DRAFT };
  }
  return {
    ...session,
    restockSubmitting: false,
    restockSubmitted: true,
    restockNotice: RESTOCK_SUCCESS,
    restockDraft: session.restockDraft,
  };
}

export function finishRestockSubmit(session: MerchantPosSession): MerchantPosSession {
  if (!session.restockSubmitted) return session;
  return { ...session, restockSubmitting: false, restockNotice: RESTOCK_SUCCESS };
}

export function openRefundConfirm(
  session: MerchantPosSession,
  saleId: string,
): MerchantPosSession {
  if (session.localRefunds[saleId]) {
    return { ...session, refundNotice: REFUND_ALREADY };
  }
  const sale = sessionHasRequestableSale(saleId);
  if (!sale) return session;
  return {
    ...session,
    refundConfirmSaleId: saleId,
    cartOpen: false,
    cartDialogStep: 'lines',
  };
}

export function closeRefundConfirm(session: MerchantPosSession): MerchantPosSession {
  return { ...session, refundConfirmSaleId: null };
}

export function requestDemoRefund(session: MerchantPosSession, saleId: string): MerchantPosSession {
  if (session.localRefunds[saleId]) {
    return { ...session, refundConfirmSaleId: null, refundNotice: REFUND_ALREADY };
  }
  if (!sessionHasRequestableSale(saleId)) return session;
  return {
    ...session,
    refundConfirmSaleId: null,
    localRefunds: { ...session.localRefunds, [saleId]: true },
    refundNotice: REFUND_SUCCESS,
  };
}

function sessionHasRequestableSale(saleId: string): boolean {
  return ['sale-cash-open', 'sale-line-pickup'].includes(saleId);
}

export function remainingStock(session: MerchantPosSession, skuId: string): number {
  return availableAfterCart(skuId, session.cart);
}

export function demoSaleCopy(): string {
  return COMPLETE_SALE_CONFIRM_BODY;
}
