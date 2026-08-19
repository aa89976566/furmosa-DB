import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addCartQty,
  addSelectedToCart,
  closeCompleteConfirm,
  completeDemoSale,
  createSession,
  escapeActiveDialog,
  openCompleteConfirm,
  openPreviewDialogCount,
  openRefundConfirm,
  selectVariant,
  setActualUnitPrice,
  setCartOpen,
  setQuery,
} from '../session';

function readyCart() {
  let session = createSession();
  session = selectVariant(session, 'prod-beef', 'sku-beef-80');
  session = addSelectedToCart(session, 'prod-beef');
  session = setCartOpen(session, true);
  return session;
}

describe('merchant POS preview modal state invariants', () => {
  it('allows only one dialog at a time', () => {
    let session = readyCart();
    assert.equal(openPreviewDialogCount(session), 1);
    session = openRefundConfirm(session, 'sale-cash-open');
    assert.equal(session.cartOpen, false);
    assert.equal(session.refundConfirmSaleId, 'sale-cash-open');
    assert.equal(openPreviewDialogCount(session), 1);

    session = setCartOpen(session, true);
    assert.equal(session.refundConfirmSaleId, null);
    assert.equal(session.cartOpen, true);
    assert.equal(openPreviewDialogCount(session), 1);
  });

  it('moves cart to confirm, cancel returns to cart, complete closes all', () => {
    let session = readyCart();
    assert.equal(session.cartDialogStep, 'lines');
    session = openCompleteConfirm(session);
    assert.equal(session.cartOpen, true);
    assert.equal(session.cartDialogStep, 'confirm');
    assert.equal(openPreviewDialogCount(session), 1);

    session = closeCompleteConfirm(session);
    assert.equal(session.cartOpen, true);
    assert.equal(session.cartDialogStep, 'lines');
    assert.equal(session.cart.length, 1);

    session = openCompleteConfirm(session);
    session = completeDemoSale(session);
    assert.equal(session.cartOpen, false);
    assert.equal(session.cartDialogStep, 'lines');
    assert.equal(session.cart.length, 0);
    assert.equal(session.demoReceipts.length, 1);
    assert.equal(openPreviewDialogCount(session), 0);
  });

  it('keeps the cart dialog open when search or price input changes', () => {
    let session = readyCart();
    session = setQuery(session, '牛肉');
    session = setActualUnitPrice(session, 'sku-beef-80', '170');
    session = addCartQty(session, 'sku-beef-80', 1);
    assert.equal(session.cartOpen, true);
    assert.equal(session.cartDialogStep, 'lines');
    assert.equal(session.cart[0]?.actualUnitPriceInput, '170');
    assert.equal(session.cart[0]?.qty, 2);
    assert.equal(openPreviewDialogCount(session), 1);
  });

  it('keeps one cart dialog when three lines stay on the lines step', () => {
    let session = createSession();
    session = selectVariant(session, 'prod-beef', 'sku-beef-80');
    session = addSelectedToCart(session, 'prod-beef');
    session = selectVariant(session, 'prod-beef', 'sku-beef-150');
    session = addSelectedToCart(session, 'prod-beef');
    session = selectVariant(session, 'prod-chicken', 'sku-chkn-50');
    session = addSelectedToCart(session, 'prod-chicken');
    session = setCartOpen(session, true);
    assert.equal(session.cart.length, 3);
    assert.equal(session.cartDialogStep, 'lines');
    assert.equal(openPreviewDialogCount(session), 1);
    session = openCompleteConfirm(session);
    assert.equal(session.cartDialogStep, 'confirm');
    assert.equal(session.cartOpen, true);
    assert.equal(openPreviewDialogCount(session), 1);
  });

  it('uses Escape to leave confirm then close cart', () => {
    let session = readyCart();
    session = openCompleteConfirm(session);
    session = escapeActiveDialog(session);
    assert.equal(session.cartOpen, true);
    assert.equal(session.cartDialogStep, 'lines');
    session = escapeActiveDialog(session);
    assert.equal(session.cartOpen, false);
    assert.equal(openPreviewDialogCount(session), 0);
  });
});
