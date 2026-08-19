import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AT_STOCK_CAP,
  COMPLETE_SALE_CONFIRM_BODY,
  FIX_CART_QTY,
  SALE_SUCCESS,
  VIEW_RESTOCK,
  cartHasQtyLabel,
  qtyOverStockError,
} from '../copy';
import {
  cartDockState,
  catalogRows,
  skuAvailability,
  visibleVariantsForProduct,
} from '../selectors';
import { PRODUCTS } from '../fixtures';
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

  it('lets a known sold-out SKU be selected for restock but never enter the cart', () => {
    let session = createSession();
    session = selectVariant(session, 'prod-beef', 'sku-beef-300');
    assert.equal(session.selectedSkuByProductId['prod-beef'], 'sku-beef-300');
    assert.equal(skuAvailability('sku-beef-300', session.cart).canSelect, true);
    assert.equal(skuAvailability('sku-beef-300', session.cart).canAdd, false);
    assert.equal(skuAvailability('sku-beef-300', session.cart).reason, 'sold_out');

    let row = beef150Row(session);
    assert.equal(row?.selected?.skuId, 'sku-beef-300');
    assert.equal(row?.add.canAdd, false);
    assert.equal(row?.add.showRestock, true);
    assert.equal(row?.add.buttonLabel, VIEW_RESTOCK);
    assert.equal(row?.stockLevel, 'sold_out');
    session = addSelectedToCart(session, 'prod-beef');
    assert.equal(session.cart.length, 0);

    session = selectVariant(session, 'prod-beef', 'sku-beef-80');
    session = addSelectedToCart(session, 'prod-beef');
    session = selectVariant(session, 'prod-beef', 'sku-beef-150');
    session = addSelectedToCart(session, 'prod-beef');
    assert.equal(session.cart.find((line) => line.skuId === 'sku-beef-80')?.qty, 1);
    assert.equal(session.cart.find((line) => line.skuId === 'sku-beef-150')?.qty, 1);
    assert.equal(session.cart.some((line) => line.skuId === 'sku-beef-300'), false);

    session = selectVariant(session, 'prod-beef', 'unknown-sku');
    assert.equal(session.selectedSkuByProductId['prod-beef'], 'sku-beef-150');
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

  it('keeps committed reservation on an invalid qty draft and restores add after a valid fix', () => {
    let session = selectAndAdd('prod-beef', 'sku-beef-150', 2);
    session = setCartQtyInput(session, 'sku-beef-150', '');
    assert.equal(session.cart[0]?.qty, 2);
    assert.equal(session.cart[0]?.qtyInput, '');
    let availability = skuAvailability('sku-beef-150', session.cart);
    assert.equal(availability.committedCartQty, 2);
    assert.equal(availability.availableToAdd, 1);
    assert.equal(availability.qtyDraftValid, false);
    assert.equal(availability.canAdd, false);
    assert.equal(availability.reason, 'invalid_qty');
    assert.equal(availability.cartQty, 2);

    const dock = cartDockState(session.cart);
    assert.equal(dock.itemCount, 2);
    assert.equal(dock.blocked, true);
    assert.equal(dock.dealTwd, null);
    assert.equal(dock.notice, FIX_CART_QTY);

    let row = beef150Row(session);
    assert.equal(row?.add.canAdd, false);
    assert.equal(row?.add.buttonLabel, FIX_CART_QTY);
    assert.equal(row?.add.hint, FIX_CART_QTY);
    assert.equal(row?.add.cartQty, 2);

    session = setCartQtyInput(session, 'sku-beef-150', '99');
    availability = skuAvailability('sku-beef-150', session.cart);
    assert.equal(availability.committedCartQty, 2);
    assert.equal(availability.availableToAdd, 1);
    assert.equal(availability.canAdd, false);
    assert.equal(beef150Row(session)?.add.buttonLabel, FIX_CART_QTY);

    session = setCartQtyInput(session, 'sku-beef-150', '2');
    availability = skuAvailability('sku-beef-150', session.cart);
    assert.equal(availability.qtyDraftValid, true);
    assert.equal(availability.canAdd, true);
    assert.equal(availability.committedCartQty, 2);
    assert.equal(availability.availableToAdd, 1);
    row = beef150Row(session);
    assert.equal(row?.add.canAdd, true);
    session = addSelectedToCart(session, 'prod-beef');
    assert.equal(session.cart[0]?.qty, 3);
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

  it('clears the cart after a demo sale without deducting fixture stock', () => {
    assert.match(COMPLETE_SALE_CONFIRM_BODY, /操作預覽，不建立訂單、不扣除庫存/);
    assert.match(SALE_SUCCESS, /這是操作預覽，完成後不會扣減示意庫存；重新整理會重置/);

    let session = selectAndAdd('prod-beef', 'sku-beef-150', 3);
    session = completeDemoSale(session);
    assert.equal(session.cart.length, 0);
    assert.equal(session.demoReceipts[0]?.lines[0]?.qty, 3);
    assert.match(session.demoReceipts[0]?.notice ?? '', /不會扣減示意庫存/);
    assert.equal(skuAvailability('sku-beef-150', session.cart).canAdd, true);
    assert.equal(skuAvailability('sku-beef-150', session.cart).availableQty, 3);

    session = selectVariant(session, 'prod-beef', 'sku-beef-150');
    session = addSelectedToCart(session, 'prod-beef');
    assert.equal(session.cart[0]?.qty, 1);
    assert.equal(beef150Row(session)?.add.canAdd, true);
  });

  it('hides unmatched specs during SKU or spec search and does not add from a hidden selection', () => {
    const beef = PRODUCTS.find((product) => product.productId === 'prod-beef');
    assert.ok(beef);
    assert.equal(visibleVariantsForProduct(beef, '牛肉').length, 3);
    assert.deepEqual(
      visibleVariantsForProduct(beef, '150').map((variant) => variant.skuId),
      ['sku-beef-150'],
    );
    assert.deepEqual(
      visibleVariantsForProduct(beef, 'FMT-BEEF-80').map((variant) => variant.skuId),
      ['sku-beef-80'],
    );

    let session = createSession();
    session = selectVariant(session, 'prod-beef', 'sku-beef-80');
    session = setQuery(session, '150');
    assert.equal(session.selectedSkuByProductId['prod-beef'], 'sku-beef-80');

    let row = beef150Row(session);
    assert.deepEqual(row?.visibleVariants.map((variant) => variant.skuId), ['sku-beef-150']);
    assert.equal(row?.visibleVariants.some((variant) => variant.skuId === 'sku-beef-80'), false);
    assert.equal(row?.selected, null);
    assert.equal(row?.add.canAdd, false);
    assert.equal(row?.add.reason, 'select_spec');

    session = addSelectedToCart(session, 'prod-beef');
    assert.equal(session.cart.length, 0);
    assert.equal(session.selectedSkuByProductId['prod-beef'], 'sku-beef-80');

    session = selectVariant(session, 'prod-beef', 'sku-beef-150');
    session = addSelectedToCart(session, 'prod-beef');
    assert.equal(session.cart.length, 1);
    assert.equal(session.cart[0]?.skuId, 'sku-beef-150');
    assert.equal(session.cart[0]?.qty, 1);

    const beforeClear = session;
    session = setQuery(session, '');
    assert.equal(session.selectedSkuByProductId['prod-beef'], 'sku-beef-150');
    assert.equal(session.cart[0]?.skuId, 'sku-beef-150');
    assert.equal(session.cart[0]?.qty, 1);
    row = beef150Row(session);
    assert.equal(row?.visibleVariants.length, 3);
    assert.equal(row?.selected?.skuId, 'sku-beef-150');
    assert.equal(beforeClear.cart, session.cart);
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
