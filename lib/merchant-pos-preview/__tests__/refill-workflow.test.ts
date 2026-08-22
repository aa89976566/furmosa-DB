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
    assert.equal(canConfirmRefillDelivery(exchange, [true], false, 1), true);
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
    assert.equal(refillPriceBreakdown(order, 1, 1).topUpAmountTwd, 0);
    assert.equal(refillPriceBreakdown(order, 0, 1).topUpAmountTwd, 30);
    assert.equal(canConfirmRefillDelivery(order, [true, false]), false);
    assert.equal(canConfirmRefillDelivery(order, [true, false], true), true);
  });

  it('renders multi-jar, final confirmation, forgot-jar, success, and LINE-only point rules', () => {
    const refill = readFileSync(path.join(process.cwd(), 'components/merchant-pos-preview/refill-panel.tsx'), 'utf8');
    assert.match(refill, /客人今天帶幾個空罐/);
    assert.match(refill, /這個序號已在本次交付中使用/);
    assert.match(refill, /確認交付/);
    assert.match(refill, /沒有其他空罐/);
    assert.match(refill, /稍後取貨/);
    assert.match(refill, /尚缺/);
    assert.match(refill, /收取/);
    assert.match(refill, /查看計價明細/);
    assert.match(refill, /客人今天要拿幾罐/);
    assert.match(refill, /還能領/);
    assert.match(refill, /不用再付錢/);
    assert.match(refill, /需要在線上補/);
    assert.match(refill, /請客人到官方 LINE 付款/);
    assert.match(refill, /等待官方 LINE 回傳付款成功/);
    assert.match(refill, /完成換罐/);
    assert.match(refill, /處理下一筆/);
    assert.match(refill, /不在此處增加點數/);
    assert.match(refill, /LINE 登記新罐時加入/);
    assert.match(refill, /includes\(parsed\.value\)/);
    assert.match(refill, /remainingQuantities/);
    assert.match(refill, /訂單會繼續留在待換罐清單/);
    assert.match(refill, /不能重複使用/);
    assert.doesNotMatch(refill, /新罐瓶底序號/);
    assert.doesNotMatch(refill, /fetch\s*\(/);
    assert.doesNotMatch(refill, /prisma/i);
  });
});
