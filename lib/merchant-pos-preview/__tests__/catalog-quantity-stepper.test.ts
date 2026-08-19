import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  catalogStepperControls,
  nextCatalogStepperCommand,
} from '../../../components/merchant-pos-preview/catalog-quantity-stepper-command';
import {
  AT_STOCK_CAP,
  FIX_CART_QTY,
  STOCK_ALL_IN_CART,
  cartHasQtyLabel,
} from '../copy';
import { catalogRows, skuAvailability } from '../selectors';
import {
  addCartQty,
  addSelectedToCart,
  completeDemoSale,
  createSession,
  removeCartLine,
  selectVariant,
  setCartQtyInput,
  setQuery,
} from '../session';
import type { MerchantPosSession } from '../types';

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), rel), 'utf8');
}

function applyCatalogStepper(
  session: MerchantPosSession,
  productId: string,
  skuId: string,
  action: 'increase' | 'decrease',
): MerchantPosSession {
  const command = nextCatalogStepperCommand(skuAvailability(skuId, session.cart), action);
  if (command.type === 'add-selected') return addSelectedToCart(session, productId);
  if (command.type === 'add-cart-qty') return addCartQty(session, skuId, command.delta);
  return session;
}

function selectSku(productId: string, skuId: string): MerchantPosSession {
  return selectVariant(createSession(), productId, skuId);
}

describe('merchant POS preview catalog quantity stepper (session-backed; not a live DOM proof)', () => {
  it('merges 0 to 1 to 2 into a single cart line', () => {
    let session = selectSku('prod-beef', 'sku-beef-150');
    assert.equal(skuAvailability('sku-beef-150', session.cart).committedCartQty, 0);
    assert.deepEqual(nextCatalogStepperCommand(skuAvailability('sku-beef-150', session.cart), 'increase'), {
      type: 'add-selected',
    });
    session = applyCatalogStepper(session, 'prod-beef', 'sku-beef-150', 'increase');
    assert.equal(session.cart.length, 1);
    assert.equal(session.cart[0]?.skuId, 'sku-beef-150');
    assert.equal(session.cart[0]?.qty, 1);
    assert.equal(skuAvailability('sku-beef-150', session.cart).committedCartQty, 1);
    assert.deepEqual(nextCatalogStepperCommand(skuAvailability('sku-beef-150', session.cart), 'increase'), {
      type: 'add-cart-qty',
      delta: 1,
    });
    session = applyCatalogStepper(session, 'prod-beef', 'sku-beef-150', 'increase');
    assert.equal(session.cart.length, 1);
    assert.equal(session.cart[0]?.qty, 2);
    assert.equal(skuAvailability('sku-beef-150', session.cart).committedCartQty, 2);
    assert.equal(cartHasQtyLabel(2), '購物車內 2 件');
  });

  it('does not add a fourth unit when stock is 3, and still allows minus', () => {
    let session = selectSku('prod-beef', 'sku-beef-150');
    session = applyCatalogStepper(session, 'prod-beef', 'sku-beef-150', 'increase');
    session = applyCatalogStepper(session, 'prod-beef', 'sku-beef-150', 'increase');
    session = applyCatalogStepper(session, 'prod-beef', 'sku-beef-150', 'increase');
    assert.equal(session.cart[0]?.qty, 3);
    const atCap = skuAvailability('sku-beef-150', session.cart);
    assert.equal(atCap.reason, 'at_cap');
    assert.equal(atCap.canAdd, false);
    assert.deepEqual(catalogStepperControls(atCap), {
      committedCartQty: 3,
      canIncrease: false,
      canDecrease: true,
    });
    const blocked = applyCatalogStepper(session, 'prod-beef', 'sku-beef-150', 'increase');
    assert.equal(blocked, session);
    assert.equal(blocked.cart[0]?.qty, 3);
    assert.equal(blocked.saleNotice, null);
    session = applyCatalogStepper(session, 'prod-beef', 'sku-beef-150', 'decrease');
    assert.equal(session.cart[0]?.qty, 2);
    assert.equal(AT_STOCK_CAP, '已達庫存上限');
    assert.equal(STOCK_ALL_IN_CART, '庫存已全放入購物車');
  });

  it('removes the line when minus reaches 0', () => {
    let session = selectSku('prod-beef', 'sku-beef-150');
    session = applyCatalogStepper(session, 'prod-beef', 'sku-beef-150', 'increase');
    assert.deepEqual(nextCatalogStepperCommand(skuAvailability('sku-beef-150', session.cart), 'decrease'), {
      type: 'add-cart-qty',
      delta: -1,
    });
    session = applyCatalogStepper(session, 'prod-beef', 'sku-beef-150', 'decrease');
    assert.equal(session.cart.length, 0);
    const empty = skuAvailability('sku-beef-150', session.cart);
    assert.equal(empty.committedCartQty, 0);
    assert.equal(catalogStepperControls(empty).canDecrease, false);
    assert.deepEqual(nextCatalogStepperCommand(empty, 'decrease'), { type: 'none' });
  });

  it('keeps quantities isolated across variants', () => {
    let session = selectSku('prod-beef', 'sku-beef-150');
    session = applyCatalogStepper(session, 'prod-beef', 'sku-beef-150', 'increase');
    session = applyCatalogStepper(session, 'prod-beef', 'sku-beef-150', 'increase');
    session = selectVariant(session, 'prod-beef', 'sku-beef-80');
    session = applyCatalogStepper(session, 'prod-beef', 'sku-beef-80', 'increase');
    assert.equal(skuAvailability('sku-beef-150', session.cart).committedCartQty, 2);
    assert.equal(skuAvailability('sku-beef-80', session.cart).committedCartQty, 1);
    assert.equal(session.cart.length, 2);
    session = applyCatalogStepper(session, 'prod-beef', 'sku-beef-80', 'increase');
    assert.equal(skuAvailability('sku-beef-150', session.cart).committedCartQty, 2);
    assert.equal(skuAvailability('sku-beef-80', session.cart).committedCartQty, 2);
  });

  it('does not let card controls overwrite invalid empty, over-stock, negative, decimal, or scientific drafts', () => {
    const drafts = ['', '4', '-1', '1.5', '1e2'];
    for (const draft of drafts) {
      let session = selectSku('prod-beef', 'sku-beef-150');
      session = applyCatalogStepper(session, 'prod-beef', 'sku-beef-150', 'increase');
      session = applyCatalogStepper(session, 'prod-beef', 'sku-beef-150', 'increase');
      session = setCartQtyInput(session, 'sku-beef-150', draft);
      const availability = skuAvailability('sku-beef-150', session.cart);
      assert.equal(availability.committedCartQty, 2, draft);
      assert.equal(availability.qtyDraftValid, false, draft);
      assert.deepEqual(catalogStepperControls(availability), {
        committedCartQty: 2,
        canIncrease: false,
        canDecrease: false,
      });
      assert.deepEqual(nextCatalogStepperCommand(availability, 'increase'), { type: 'none' });
      assert.deepEqual(nextCatalogStepperCommand(availability, 'decrease'), { type: 'none' });
      const afterPlus = applyCatalogStepper(session, 'prod-beef', 'sku-beef-150', 'increase');
      const afterMinus = applyCatalogStepper(session, 'prod-beef', 'sku-beef-150', 'decrease');
      assert.equal(afterPlus, session);
      assert.equal(afterMinus, session);
      assert.equal(afterPlus.cart[0]?.qty, 2);
      assert.equal(afterPlus.cart[0]?.qtyInput, draft);
      assert.equal(FIX_CART_QTY, '請先到購物車修正數量');
    }
  });

  it('blocks sold-out and hidden selections from adding', () => {
    let soldOut = selectSku('prod-beef', 'sku-beef-300');
    const soldAvail = skuAvailability('sku-beef-300', soldOut.cart);
    assert.equal(soldAvail.reason, 'sold_out');
    assert.equal(soldAvail.canAdd, false);
    assert.deepEqual(nextCatalogStepperCommand(soldAvail, 'increase'), { type: 'none' });
    soldOut = applyCatalogStepper(soldOut, 'prod-beef', 'sku-beef-300', 'increase');
    assert.equal(soldOut.cart.length, 0);
    const soldRow = catalogRows(soldOut).find((row) => row.product.productId === 'prod-beef');
    assert.equal(soldRow?.add.showRestock, true);

    let hidden = selectSku('prod-beef', 'sku-beef-80');
    hidden = setQuery(hidden, '150');
    const hiddenRow = catalogRows(hidden).find((row) => row.product.productId === 'prod-beef');
    assert.equal(hiddenRow?.selected, null);
    hidden = addSelectedToCart(hidden, 'prod-beef');
    assert.equal(hidden.cart.length, 0);
  });

  it('restores the stepper after remove and after a demo sale', () => {
    let session = selectSku('prod-beef', 'sku-beef-150');
    session = applyCatalogStepper(session, 'prod-beef', 'sku-beef-150', 'increase');
    session = applyCatalogStepper(session, 'prod-beef', 'sku-beef-150', 'increase');
    session = removeCartLine(session, 'sku-beef-150');
    assert.equal(skuAvailability('sku-beef-150', session.cart).committedCartQty, 0);
    assert.equal(catalogStepperControls(skuAvailability('sku-beef-150', session.cart)).canIncrease, true);
    session = applyCatalogStepper(session, 'prod-beef', 'sku-beef-150', 'increase');
    assert.equal(session.cart[0]?.qty, 1);

    session = applyCatalogStepper(session, 'prod-beef', 'sku-beef-150', 'increase');
    session = completeDemoSale(session);
    assert.equal(session.cart.length, 0);
    assert.equal(skuAvailability('sku-beef-150', session.cart).committedCartQty, 0);
    session = applyCatalogStepper(session, 'prod-beef', 'sku-beef-150', 'increase');
    assert.equal(session.cart[0]?.qty, 1);
  });

  it('announces the selected SKU qty through one status live region', () => {
    const stepper = read('components/merchant-pos-preview/catalog-quantity-stepper.tsx');
    assert.equal((stepper.match(/role="status"/g) ?? []).length, 1);
    assert.equal((stepper.match(/aria-live="polite"/g) ?? []).length, 1);
    assert.equal((stepper.match(/aria-atomic="true"/g) ?? []).length, 1);
    assert.match(
      stepper,
      /role="status"[\s\S]*aria-live="polite"[\s\S]*aria-atomic="true"[\s\S]*\{cartHasQtyLabel\(controls\.committedCartQty\)\}/,
    );
    assert.match(stepper, /<p className=\{styles\.catalogQtyValue\} aria-hidden="true">/);
    assert.match(stepper, /<p id=\{capHintId\} className=\{styles\.hint\}>/);
    assert.match(stepper, /<p id=\{invalidHintId\} className=\{styles\.hint\}>/);
    assert.equal((stepper.match(/aria-live=/g) ?? []).length, 1);
    assert.equal((stepper.match(/role="status"/g) ?? []).length, 1);

    const statusFor = (session: MerchantPosSession, skuId: string) =>
      cartHasQtyLabel(skuAvailability(skuId, session.cart).committedCartQty);

    let session = selectSku('prod-beef', 'sku-beef-150');
    assert.equal(statusFor(session, 'sku-beef-150'), '購物車內 0 件');
    session = applyCatalogStepper(session, 'prod-beef', 'sku-beef-150', 'increase');
    assert.equal(statusFor(session, 'sku-beef-150'), '購物車內 1 件');
    session = applyCatalogStepper(session, 'prod-beef', 'sku-beef-150', 'increase');
    assert.equal(statusFor(session, 'sku-beef-150'), '購物車內 2 件');
    session = applyCatalogStepper(session, 'prod-beef', 'sku-beef-150', 'decrease');
    assert.equal(statusFor(session, 'sku-beef-150'), '購物車內 1 件');
    session = applyCatalogStepper(session, 'prod-beef', 'sku-beef-150', 'decrease');
    assert.equal(statusFor(session, 'sku-beef-150'), '購物車內 0 件');
    assert.equal(session.cart.length, 0);

    session = applyCatalogStepper(session, 'prod-beef', 'sku-beef-150', 'increase');
    session = applyCatalogStepper(session, 'prod-beef', 'sku-beef-150', 'increase');
    session = selectVariant(session, 'prod-beef', 'sku-beef-80');
    assert.equal(statusFor(session, 'sku-beef-150'), '購物車內 2 件');
    assert.equal(statusFor(session, 'sku-beef-80'), '購物車內 0 件');
    session = applyCatalogStepper(session, 'prod-beef', 'sku-beef-80', 'increase');
    assert.equal(statusFor(session, 'sku-beef-80'), '購物車內 1 件');
    assert.equal(statusFor(session, 'sku-beef-150'), '購物車內 2 件');

    session = setCartQtyInput(session, 'sku-beef-150', '');
    const invalid = skuAvailability('sku-beef-150', session.cart);
    assert.equal(invalid.committedCartQty, 2);
    assert.equal(statusFor(session, 'sku-beef-150'), '購物車內 2 件');
    assert.deepEqual(catalogStepperControls(invalid), {
      committedCartQty: 2,
      canIncrease: false,
      canDecrease: false,
    });
    assert.deepEqual(nextCatalogStepperCommand(invalid, 'increase'), { type: 'none' });
    assert.deepEqual(nextCatalogStepperCommand(invalid, 'decrease'), { type: 'none' });
    const unchanged = applyCatalogStepper(session, 'prod-beef', 'sku-beef-150', 'increase');
    assert.equal(unchanged, session);
    assert.equal(statusFor(unchanged, 'sku-beef-150'), '購物車內 2 件');
  });

  it('keeps one session-backed stepper and no second catalog qty input or duplicate ids', () => {
    const app = read('components/merchant-pos-preview/preview-app.tsx');
    const checkout = read('components/merchant-pos-preview/checkout-panel.tsx');
    const stepper = read('components/merchant-pos-preview/catalog-quantity-stepper.tsx');
    const helper = read('components/merchant-pos-preview/catalog-quantity-stepper-command.ts');
    const cart = read('components/merchant-pos-preview/cart-workspace.tsx');
    assert.match(app, /onStepQty=\{\(skuId, delta\) => setSession\(\(current\) => addCartQty\(current, skuId, delta\)\)\}/);
    assert.match(app, /onAdd=\{\(productId\) => setSession\(\(current\) => addSelectedToCart\(current, productId\)\)\}/);
    assert.match(app, /const catalog = \(/);
    assert.match(app, /isDesktopCheckout \?/);
    assert.equal((app.match(/<CheckoutPanel/g) ?? []).length, 1);
    assert.match(checkout, /availability=\{skuAvailability\(selected\.skuId, session\.cart\)\}/);
    assert.match(stepper, /controls\.committedCartQty/);
    assert.match(helper, /committedCartQty/);
    assert.equal(helper.includes('availableQty -'), false);
    assert.equal(helper.includes("from '@/lib/merchant-pos-preview/session'"), false);
    assert.equal(stepper.includes('availableQty -'), false);
    assert.equal(stepper.includes('useState'), false);
    assert.equal(stepper.includes('useRef'), false);
    assert.equal(stepper.includes('<input'), false);
    assert.equal(stepper.includes('type="number"'), false);
    assert.equal(checkout.includes('cart-qty-'), false);
    assert.equal(checkout.includes('type="number"'), false);
    assert.match(cart, /id=\{qtyId\}/);
    assert.match(cart, /const qtyId = `cart-qty-\$\{line\.skuId\}`/);
    assert.equal(stepper.includes('cart-qty-'), false);
    assert.equal(checkout.includes('PREVIEW_ACTION_TONES.addToCart'), false);
  });
});
