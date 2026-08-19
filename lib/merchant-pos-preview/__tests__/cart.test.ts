import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CART_FIXTURE_TOTALS } from '../fixtures';
import { qtyOverStockError, qtyRangeHint } from '../copy';
import { cartTotals } from '../selectors';
import {
  addCartQty,
  addSelectedToCart,
  commitCartQty,
  completeDemoSale,
  createSession,
  openCompleteConfirm,
  removeCartLine,
  selectVariant,
  setActualUnitPrice,
  setCartQtyInput,
} from '../session';
import { parseCartQtyInput, parsePositiveIntTwd } from '../validators';

function beef80Cart() {
  let session = createSession();
  session = selectVariant(session, 'prod-beef', 'sku-beef-80');
  session = addSelectedToCart(session, 'prod-beef');
  session = addCartQty(session, 'sku-beef-80', 1);
  return session;
}

describe('merchant POS preview cart', () => {
  it('adds, updates, removes and respects stock caps', () => {
    let session = beef80Cart();
    assert.equal(session.cart[0]?.qty, 2);
    assert.equal(session.cart[0]?.qtyInput, '2');

    session = addCartQty(session, 'sku-beef-80', 20);
    assert.equal(session.cart[0]?.qty, 2);
    assert.equal(session.saleNotice, qtyOverStockError(12));

    session = addCartQty(session, 'sku-beef-80', -1);
    assert.equal(session.cart[0]?.qty, 1);
    session = removeCartLine(session, 'sku-beef-80');
    assert.equal(session.cart.length, 0);
  });

  it('accepts a valid direct quantity and keeps the same number stable', () => {
    let session = beef80Cart();
    session = setCartQtyInput(session, 'sku-beef-80', '5');
    assert.equal(session.cart[0]?.qty, 5);
    assert.equal(session.cart[0]?.qtyInput, '5');
    assert.equal(cartTotals(session.cart).blocked, false);

    session = setCartQtyInput(session, 'sku-beef-80', '5');
    session = commitCartQty(session, 'sku-beef-80');
    assert.equal(session.cart[0]?.qty, 5);
    assert.equal(session.cart[0]?.qtyInput, '5');
    assert.equal(session.saleNotice, null);
  });

  it('fails closed on blank, zero, negative, decimal, scientific, text and over-stock qty', () => {
    const max = 12;
    const illegal = ['', '0', '-1', '1.5', '1e2', 'NaN', 'abc', '01'];
    for (const raw of illegal) {
      assert.equal(parseCartQtyInput(raw, max).ok, false, raw);
      assert.equal(parseCartQtyInput(raw, max).error, qtyRangeHint(max), raw);
    }
    assert.deepEqual(parseCartQtyInput('13', max), { ok: false, error: qtyOverStockError(max) });
    assert.deepEqual(parseCartQtyInput('3', max), { ok: true, value: 3 });

    let session = beef80Cart();
    session = setCartQtyInput(session, 'sku-beef-80', '');
    assert.equal(session.cart[0]?.qty, 2);
    assert.equal(session.cart[0]?.qtyInput, '');
    assert.equal(cartTotals(session.cart).blocked, true);
    assert.equal(cartTotals(session.cart).firstError, qtyRangeHint(max));
    assert.equal(openCompleteConfirm(session).cartDialogStep, 'lines');
    assert.equal(completeDemoSale(session).demoReceipts.length, 0);

    session = setCartQtyInput(session, 'sku-beef-80', '99');
    assert.equal(session.cart[0]?.qty, 2);
    assert.equal(session.cart[0]?.qtyInput, '99');
    assert.equal(cartTotals(session.cart).firstError, qtyOverStockError(max));
  });

  it('uses the same validator for plus-minus and direct input', () => {
    let plus = beef80Cart();
    plus = addCartQty(plus, 'sku-beef-80', 1);
    let typed = beef80Cart();
    typed = setCartQtyInput(typed, 'sku-beef-80', '3');
    assert.equal(plus.cart[0]?.qty, typed.cart[0]?.qty);
    assert.equal(plus.cart[0]?.qtyInput, typed.cart[0]?.qtyInput);

    plus = addCartQty(plus, 'sku-beef-80', 20);
    typed = setCartQtyInput(typed, 'sku-beef-80', '23');
    typed = commitCartQty(typed, 'sku-beef-80');
    assert.equal(plus.cart[0]?.qty, 3);
    assert.equal(typed.cart[0]?.qty, 3);
    assert.equal(plus.saleNotice, qtyOverStockError(12));
    assert.equal(typed.saleNotice, qtyOverStockError(12));
  });

  it('fails closed on illegal actual prices', () => {
    const illegal = ['', '0', '-1', '1.5', 'NaN', 'Infinity', 'abc', '01', '1e2'];
    for (const raw of illegal) {
      assert.equal(parsePositiveIntTwd(raw).ok, false, raw);
    }
    assert.deepEqual(parsePositiveIntTwd('170'), { ok: true, value: 170 });

    let session = beef80Cart();
    session = setActualUnitPrice(session, 'sku-beef-80', '');
    assert.equal(cartTotals(session.cart).blocked, true);
    assert.equal(openCompleteConfirm(session).cartDialogStep, 'lines');
    assert.equal(completeDemoSale(session).demoReceipts.length, 0);
  });

  it('uses fixed fixture totals for unit price times quantity', () => {
    let session = beef80Cart();
    let totals = cartTotals(session.cart);
    assert.equal(totals.listSubtotalTwd, CART_FIXTURE_TOTALS.beef80x2List);
    assert.equal(totals.actualSubtotalTwd, CART_FIXTURE_TOTALS.beef80x2ActualDefault);
    assert.equal(totals.itemCount, 2);

    session = setActualUnitPrice(session, 'sku-beef-80', '170');
    totals = cartTotals(session.cart);
    assert.equal(totals.actualSubtotalTwd, CART_FIXTURE_TOTALS.beef80x2Actual170);
    assert.equal(totals.allowanceTwd, CART_FIXTURE_TOTALS.beef80x2Allowance170);
  });
});
