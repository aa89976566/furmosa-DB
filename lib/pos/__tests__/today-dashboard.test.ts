import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildHomeTaskCards, isInventoryReliable } from '@/lib/pos/home-tasks';

describe('buildHomeTaskCards', () => {
  it('omits empty cards', () => {
    const cards = buildHomeTaskCards({
      pendingRefillCount: 0,
      awaitingRestockReceiptCount: 0,
      firstAwaitingRestockReceiptId: null,
      lowStock: null,
      openRestockCount: 0,
      firstOpenRestockId: null,
    });
    assert.equal(cards.length, 0);
  });

  it('orders 待換罐 → 庫存不足 → 補貨中', () => {
    const cards = buildHomeTaskCards({
      pendingRefillCount: 3,
      awaitingRestockReceiptCount: 0,
      firstAwaitingRestockReceiptId: null,
      lowStock: [
        { productName: '柳葉魚凍乾', quantity: 0 },
        { productName: '水晶魚', quantity: 2 },
      ],
      openRestockCount: 2,
      firstOpenRestockId: 'r1',
    });
    assert.deepEqual(
      cards.map((c) => c.kind),
      ['pending_refill', 'low_stock', 'restock_progress'],
    );
    assert.equal(cards[0]?.title, '待換罐');
    assert.equal(cards[0]?.subtitle, '3 筆客人尚未領取');
    assert.equal(cards[0]?.badgeUnit, '筆');
    assert.match(cards[1]?.subtitle ?? '', /柳葉魚凍乾 已售完/);
    assert.equal(cards[1]?.href, '/pos/stock?filter=low');
    assert.equal(cards[1]?.badgeUnit, '項');
    assert.equal(cards[2]?.title, '補貨中');
    assert.equal(cards[2]?.subtitle, '2 筆等待出貨');
    assert.equal(cards[2]?.href, '/pos/restock/r1');
  });

  it('hides low stock when inventory is unreliable', () => {
    const cards = buildHomeTaskCards({
      pendingRefillCount: 0,
      awaitingRestockReceiptCount: 0,
      firstAwaitingRestockReceiptId: null,
      lowStock: null,
      openRestockCount: 1,
      firstOpenRestockId: 'r1',
    });
    assert.equal(cards.length, 1);
    assert.equal(cards[0]?.kind, 'restock_progress');
  });

  it('shows delivered restocks before other operational tasks', () => {
    const cards = buildHomeTaskCards({
      pendingRefillCount: 1,
      awaitingRestockReceiptCount: 2,
      firstAwaitingRestockReceiptId: 'r2',
      lowStock: null,
      openRestockCount: 0,
      firstOpenRestockId: null,
    });
    assert.equal(cards[0]?.kind, 'awaiting_restock_receipt');
    assert.equal(cards[0]?.href, '/pos/restock/r2');
    assert.match(cards[0]?.title ?? '', /請確認收到貨/);
  });
});

describe('isInventoryReliable', () => {
  it('requires at least one stock row', () => {
    assert.equal(isInventoryReliable(0), false);
    assert.equal(isInventoryReliable(3), true);
  });
});
