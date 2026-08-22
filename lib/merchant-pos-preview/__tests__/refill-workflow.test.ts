import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  actionableRefillOrders,
  blockedRefillOrders,
  canConfirmRefillDelivery,
  initialRefillStage,
  nextActionableRefillOrder,
  refillPriceBreakdown,
  REFILL_PREVIEW_ORDERS,
} from '../../../components/merchant-pos-preview/refill-preview-state';

describe('merchant POS preview refill workflow', () => {
  it('keeps unpaid or unreserved orders outside the actionable delivery queue', () => {
    const actionable = actionableRefillOrders(REFILL_PREVIEW_ORDERS);
    const blocked = blockedRefillOrders(REFILL_PREVIEW_ORDERS);
    assert.equal(actionable.length, 3);
    assert.equal(blocked.length, 1);
    assert.ok(actionable.every((order) => order.paid && order.reserved));
    assert.ok(blocked.every((order) => !order.paid || !order.reserved));
    assert.equal(actionable[0]?.arrived, true);
  });

  it('requires every exchange jar but lets a paid first-jar order skip old-jar verification', () => {
    const exchange = REFILL_PREVIEW_ORDERS.find((order) => order.orderId === 'REFILL-DEMO-003');
    const first = REFILL_PREVIEW_ORDERS.find((order) => order.orderId === 'REFILL-DEMO-004');
    assert.ok(exchange && first);
    assert.equal(initialRefillStage(exchange), 'verify');
    assert.equal(canConfirmRefillDelivery(exchange, [true, false]), false);
    assert.equal(canConfirmRefillDelivery(exchange, [true, true]), true);
    assert.equal(initialRefillStage(first), 'confirm');
    assert.equal(canConfirmRefillDelivery(first, []), true);
  });

  it('finds the next actionable order without reopening the completed order', () => {
    const next = nextActionableRefillOrder(REFILL_PREVIEW_ORDERS, 'REFILL-DEMO-001', new Set(['REFILL-DEMO-001']));
    assert.equal(next?.orderId, 'REFILL-DEMO-003');
  });

  it('prices each returned jar at 99 and each missing jar at the 129 original price', () => {
    const order = REFILL_PREVIEW_ORDERS.find((item) => item.orderId === 'REFILL-DEMO-003');
    assert.ok(order);
    assert.deepEqual(refillPriceBreakdown(order, 2), {
      exchangeQuantity: 2,
      originalPriceQuantity: 0,
      finalAmountTwd: 198,
      prepaidAmountTwd: 198,
      topUpAmountTwd: 0,
    });
    assert.equal(refillPriceBreakdown(order, 1).topUpAmountTwd, 30);
    assert.equal(refillPriceBreakdown(order, 0).topUpAmountTwd, 60);
    assert.equal(canConfirmRefillDelivery(order, [true, false]), false);
    assert.equal(canConfirmRefillDelivery(order, [true, false], true), true);
  });

  it('renders multi-jar, final confirmation, forgot-jar, success, and LINE-only point rules', () => {
    const refill = readFileSync(path.join(process.cwd(), 'components/merchant-pos-preview/refill-panel.tsx'), 'utf8');
    assert.match(refill, /逐罐驗證空罐/);
    assert.match(refill, /這個序號已在本次交付中使用/);
    assert.match(refill, /前往確認交付/);
    assert.match(refill, /確認完成交付（預覽）/);
    assert.match(refill, /依目前空罐數量計算差額/);
    assert.match(refill, /改天再領取/);
    assert.match(refill, /原價/);
    assert.match(refill, /顯示補款成功結果/);
    assert.match(refill, /處理下一筆/);
    assert.match(refill, /不在此處增加點數/);
    assert.match(refill, /LINE 登錄，屆時才增加點數/);
    assert.doesNotMatch(refill, /新罐瓶底序號/);
    assert.doesNotMatch(refill, /fetch\s*\(/);
    assert.doesNotMatch(refill, /prisma/i);
  });
});
