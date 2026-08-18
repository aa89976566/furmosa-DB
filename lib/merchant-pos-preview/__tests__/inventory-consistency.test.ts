import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AT_STOCK_CAP,
  FIX_CART_QTY,
  cartHasQtyLabel,
  qtyOverStockError,
} from '../copy';
import {
  catalogRows,
  skuAvailability,
} from '../selectors';
import {
  addCartQty,
  addSelectedToCart,
  completeDemoSale,
  createSession,
  removeCartLine,
  selectVariant,
  setCartOpen,
  setCartQtyInput,
  setQuery,
  setTab,
} from '../session';

function selectAndAdd(productId: string, skuId: string, times: number) {
  let session = createSession();
  session = selectVariant(session, productId, skuId);
  for (let index = 0; index < times; index += 1) {
    session = addSelectedToCart(session, productId);
  }
  return session;
}

function beef150Row(session: ReturnType<typeof createSession>) {
  return catalogRows(session).find((row) => row.product.productId === 'prod-beef');
}

describe('merchant POS preview catalog/cart inventory consistency', () => {
  it('disables add at the SKU cap after three units of stock-3 and ignores a fourth click', () => {
    let session = selectAndAdd('prod-beef', 'sku-beef-150', 3);
    assert.equal(session.cart[0]?.skuId, 'sku-beef-150');
    assert.equal(session.cart[0]?.qty, 3);
    assert.equal(session.saleNotice, null);

    const row = beef150Row(session);
    assert.equal(row?.add.canAdd, false);
    assert.equal(row?.add.reason, 'at_cap');
    assert.equal(row?.add.buttonLabel, AT_STOCK_CAP);
    assert.equal(row?.add.hint, cartHasQtyLabel(3));
    assert.equal(skuAvailability('sku-beef-150', session.cart).canAdd, false);

    const before = session;
    session = addSelectedToCart(session, 'prod-beef');
    assert.equal(session, before);
    assert.equal(session.cart[0]?.qty, 3);
    assert.equal(session.saleNotice, null);
  });

  it('recomputes availability per selected variant and restores the previous SKU cap', () => {
    let session = selectAndAdd('prod-beef', 'sku-beef-150', 3);
    assert.equal(skuAvailability('sku-beef-150', session.cart).reason, 'at_cap');

    session = selectVariant(session, 'prod-beef', 'sku-beef-80');
    let row = beef150Row(session);
    assert.equal(row?.selected?.skuId, 'sku-beef-80');
    assert.equal(row?.add.canAdd, true);
    assert.equal(skuAvailability('sku-beef-80', session.cart).canAdd, true);

    session = addSelectedToCart(session, 'prod-beef');
    assert.equal(session.cart.find((line) => line.skuId === 'sku-beef-80')?.qty, 1);
    assert.equal(skuAvailability('sku-beef-150', session.cart).reason, 'at_cap');

    session = selectVariant(session, 'prod-beef', 'sku-beef-150');
    row = beef150Row(session);
    assert.equal(row?.selected?.skuId, 'sku-beef-150');
    assert.equal(row?.add.canAdd, false);
    assert.equal(row?.add.buttonLabel, AT_STOCK_CAP);
  });

  it('does not select or add a zero-stock variant', () => {
    let session = createSession();
    session = selectVariant(session, 'prod-beef', 'sku-beef-300');
    assert.equal(session.selectedSkuByProductId['prod-beef'], undefined);
    assert.equal(skuAvailability('sku-beef-300', session.cart).canSelect, false);
    assert.equal(skuAvailability('sku-beef-300', session.cart).canAdd, false);

    session = addSelectedToCart(session, 'prod-beef');
    assert.equal(session.cart.length, 0);

    session = selectVariant(session, 'prod-salmon', 'sku-slmn-1');
    const salmon = catalogRows(session).find((row) => row.product.productId === 'prod-salmon');
    assert.equal(salmon?.add.showRestock, true);
    assert.equal(salmon?.stockLevel, 'sold_out');
    session = addSelectedToCart(session, 'prod-salmon');
    assert.equal(session.cart.length, 0);
  });

  it('restores add after typing a lower qty, minus, or remove', () => {
    let session = selectAndAdd('prod-beef', 'sku-beef-150', 3);
    assert.equal(beef150Row(session)?.add.canAdd, false);

    session = setCartQtyInput(session, 'sku-beef-150', '2');
    assert.equal(session.cart[0]?.qty, 2);
    assert.equal(skuAvailability('sku-beef-150', session.cart).canAdd, true);
    assert.equal(beef150Row(session)?.add.canAdd, true);

    session = addSelectedToCart(session, 'prod-beef');
    assert.equal(session.cart[0]?.qty, 3);
    session = addCartQty(session, 'sku-beef-150', -1);
    assert.equal(session.cart[0]?.qty, 2);
    assert.equal(beef150Row(session)?.add.canAdd, true);

    session = addSelectedToCart(session, 'prod-beef');
    session = removeCartLine(session, 'sku-beef-150');
    assert.equal(session.cart.length, 0);
    assert.equal(skuAvailability('sku-beef-150', session.cart).canAdd, true);
    assert.equal(beef150Row(session)?.add.canAdd, true);
  });

  it('blocks the product card on an invalid qty draft and restores after a valid fix', () => {
    let session = selectAndAdd('prod-beef', 'sku-beef-150', 2);
    session = setCartQtyInput(session, 'sku-beef-150', '');
    assert.equal(session.cart[0]?.qty, 2);
    assert.equal(session.cart[0]?.qtyInput, '');
    let availability = skuAvailability('sku-beef-150', session.cart);
    assert.equal(availability.qtyInputValid, false);
    assert.equal(availability.canAdd, false);
    assert.equal(availability.reason, 'invalid_qty');
    assert.equal(availability.cartQty, 0);
    let row = beef150Row(session);
    assert.equal(row?.add.canAdd, false);
    assert.equal(row?.add.buttonLabel, FIX_CART_QTY);
    assert.equal(row?.add.hint, FIX_CART_QTY);

    session = setCartQtyInput(session, 'sku-beef-150', '99');
    availability = skuAvailability('sku-beef-150', session.cart);
    assert.equal(availability.reason, 'invalid_qty');
    assert.equal(availability.cartQty, 0);
    assert.equal(beef150Row(session)?.add.buttonLabel, FIX_CART_QTY);

    session = setCartQtyInput(session, 'sku-beef-150', '2');
    row = beef150Row(session);
    assert.equal(row?.add.canAdd, true);
    assert.equal(row?.add.buttonLabel !== FIX_CART_QTY, true);
    assert.equal(skuAvailability('sku-beef-150', session.cart).cartQty, 2);
  });

  it('keeps independent caps per SKU and does not use the cart item total', () => {
    let session = selectAndAdd('prod-beef', 'sku-beef-150', 3);
    session = selectVariant(session, 'prod-beef', 'sku-beef-80');
    session = addSelectedToCart(session, 'prod-beef');
    session = selectVariant(session, 'prod-chicken', 'sku-chkn-50');
    session = addSelectedToCart(session, 'prod-chicken');

    assert.equal(session.cart.reduce((sum, line) => sum + line.qty, 0), 5);
    assert.equal(skuAvailability('sku-beef-150', session.cart).reason, 'at_cap');
    assert.equal(skuAvailability('sku-beef-80', session.cart).canAdd, true);
    assert.equal(skuAvailability('sku-chkn-50', session.cart).canAdd, true);
    assert.equal(skuAvailability('sku-chkn-100', session.cart).canAdd, true);

    const chicken = catalogRows(session).find((row) => row.product.productId === 'prod-chicken');
    assert.equal(chicken?.add.canAdd, true);
  });

  it('does not reset or miscount stock after search, tab, or cart dialog changes', () => {
    let session = selectAndAdd('prod-beef', 'sku-beef-150', 3);
    session = setQuery(session, '150');
    session = setCartOpen(session, true);
    session = setTab(session, 'sales');
    session = setTab(session, 'checkout');
    session = setQuery(session, '');
    session = setCartOpen(session, false);

    assert.equal(session.cart[0]?.qty, 3);
    assert.equal(session.selectedSkuByProductId['prod-beef'], 'sku-beef-150');
    assert.equal(beef150Row(session)?.add.reason, 'at_cap');
    assert.equal(skuAvailability('sku-beef-150', session.cart).canAdd, false);
  });

  it('clears the cart after a demo sale and restores fixture availability', () => {
    let session = selectAndAdd('prod-beef', 'sku-beef-150', 3);
    session = completeDemoSale(session);
    assert.equal(session.cart.length, 0);
    assert.equal(session.demoReceipts[0]?.lines[0]?.qty, 3);
    assert.equal(skuAvailability('sku-beef-150', session.cart).canAdd, true);
    assert.equal(skuAvailability('sku-beef-150', session.cart).availableQty, 3);

    session = selectVariant(session, 'prod-beef', 'sku-beef-150');
    session = addSelectedToCart(session, 'prod-beef');
    assert.equal(session.cart[0]?.qty, 1);
    assert.equal(beef150Row(session)?.add.canAdd, true);
  });

  it('keeps a defensive overstock plus unchanged and shows a clear error', () => {
    let session = selectAndAdd('prod-beef', 'sku-beef-150', 3);
    const next = addCartQty(session, 'sku-beef-150', 1);
    assert.equal(next.cart[0]?.qty, 3);
    assert.equal(next.cart[0]?.qtyInput, '3');
    assert.equal(next.saleNotice, qtyOverStockError(3));
    assert.equal(skuAvailability('sku-beef-150', next.cart).reason, 'at_cap');
  });
});
