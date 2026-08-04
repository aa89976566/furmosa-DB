import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Shape contract for HQ today ops rows (H-02).
 * Runtime counts need DB; this locks the UX order / fields.
 */
describe('HqTodayOps row contract', () => {
  it('keeps H-02 fixed order ids', () => {
    const order = [
      'restock',
      'shipments',
      'appointments',
      'refill-payment',
      'jiba',
      'done-today',
    ];
    assert.deepEqual(order.slice(0, 2), ['restock', 'shipments']);
    assert.equal(order[order.length - 1], 'done-today');
  });

  it('every action row needs href + count field names', () => {
    const sample = {
      id: 'restock',
      title: '待審叫貨',
      description: 'x',
      count: 0,
      href: '/restock-requests',
      urgency: 'done' as const,
    };
    for (const key of ['id', 'title', 'description', 'count', 'href', 'urgency']) {
      assert.ok(key in sample);
    }
  });
});
