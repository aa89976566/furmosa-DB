import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prisma } from '../prisma';
import { getShipmentQueueCounts } from '../hot-path-reads';

test('a warmed queue count reflects a dispatch on the very next read', async () => {
  let dispatched = false;
  let reads = 0;
  const where = { type: 'customer_order' };
  const original = prisma.shipment.groupBy;
  const query = async (args: { where: unknown }) => {
    assert.deepEqual(args.where, where, 'preserve the current queue filter');
    reads += 1;
    return [
      { status: 'pending', _count: { _all: dispatched ? 1 : 2 } },
      { status: 'packed', _count: { _all: 1 } },
      { status: 'shipped', _count: { _all: dispatched ? 2 : 1 } },
    ];
  };
  prisma.shipment.groupBy = query as unknown as typeof original;
  try {
    const before = await getShipmentQueueCounts(where);
    assert.equal(before.pendingCount, 3);
    assert.equal(before.byStatus.shipped, 1);
    dispatched = true;
    const after = await getShipmentQueueCounts(where);
    assert.equal(after.pendingCount, 2);
    assert.equal(after.byStatus.shipped, 2);
    assert.equal(after.total, before.total, 'moving stages must not change total');
    assert.equal(reads, 2, 'do not reuse a stale process or remote count');
  } finally {
    prisma.shipment.groupBy = original;
  }
});
