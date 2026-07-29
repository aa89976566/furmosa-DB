import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildTodayTaskRows,
  formatGuestSubtitle,
  isInventoryReliable,
} from '@/lib/pos/today-dashboard';

describe('buildTodayTaskRows (F-03)', () => {
  it('omits empty sections and never invents refill rows', () => {
    const rows = buildTodayTaskRows({
      pendingConfirmCount: 0,
      nextGuest: null,
      pendingRefillCount: 0,
      lowStock: null,
      openRestockCount: 0,
      firstOpenRestockId: null,
    });
    assert.equal(rows.length, 0);
    assert.ok(!rows.some((r) => r.kind === 'pending_refill'));
  });

  it('orders pending → next → refill → low stock → restock', () => {
    const rows = buildTodayTaskRows({
      pendingConfirmCount: 2,
      nextGuest: {
        id: 'a1',
        petName: '豆豆',
        customerName: '王小明',
        startsAt: new Date(2026, 6, 27, 13, 30),
        status: 'confirmed',
      },
      pendingRefillCount: 3,
      lowStock: [{ productName: '雞肉', quantity: 2 }],
      openRestockCount: 1,
      firstOpenRestockId: 'r1',
    });
    assert.deepEqual(
      rows.map((r) => r.kind),
      [
        'pending_confirm',
        'next_guest',
        'pending_refill',
        'low_stock',
        'restock_progress',
      ],
    );
    assert.equal(rows[2]?.href, '/pos/refill');
    assert.equal(rows[4]?.href, '/pos/restock/r1');
  });

  it('hides low stock when inventory is unreliable (null)', () => {
    const rows = buildTodayTaskRows({
      pendingConfirmCount: 0,
      nextGuest: null,
      pendingRefillCount: 0,
      lowStock: null,
      openRestockCount: 1,
      firstOpenRestockId: 'r1',
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.kind, 'restock_progress');
  });

  it('hides low stock when reliable but empty list', () => {
    const rows = buildTodayTaskRows({
      pendingConfirmCount: 0,
      nextGuest: null,
      pendingRefillCount: 0,
      lowStock: [],
      openRestockCount: 0,
      firstOpenRestockId: null,
    });
    assert.equal(rows.length, 0);
  });
});

describe('formatGuestSubtitle', () => {
  it('prefers pet name and marks requested', () => {
    const s = formatGuestSubtitle({
      petName: '豆豆',
      customerName: '王小明',
      startsAt: new Date(2026, 6, 27, 9, 5),
      status: 'requested',
    });
    assert.equal(s, '豆豆 · 09:05 · 待確認');
  });
});

describe('isInventoryReliable', () => {
  it('requires at least one stock row', () => {
    assert.equal(isInventoryReliable(0), false);
    assert.equal(isInventoryReliable(3), true);
  });
});
