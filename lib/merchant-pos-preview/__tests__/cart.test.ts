import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CART_FIXTURE_TOTALS } from '../fixtures';
import { cartTotals } from '../selectors';
import {
  addCartQty,
  addSelectedToCart,
  completeDemoSale,
  createSession,
  openCompleteConfirm,
  removeCartLine,
  selectVariant,
  setActualUnitPrice,
} from '../session';
import { parsePositiveIntTwd } from '../validators';

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

    session = addCartQty(session, 'sku-beef-80', 20);
    assert.equal(session.cart[0]?.qty, 2);
    assert.match(session.saleNotice ?? '', /不能超過示意庫存/);

    session = addCartQty(session, 'sku-beef-80', -1);
    assert.equal(session.cart[0]?.qty, 1);
    session = removeCartLine(session, 'sku-beef-80');
    assert.equal(session.cart.length, 0);
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
    assert.equal(openCompleteConfirm(session).completeConfirmOpen, false);
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
