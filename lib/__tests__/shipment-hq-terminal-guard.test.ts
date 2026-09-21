import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = readFileSync(
  new URL('../../app/(main)/shipments/actions.ts', import.meta.url),
  'utf8',
);

describe('HQ merchant restock terminal-state guard', () => {
  it('reads the persisted shipment type and status before applying transitions', () => {
    const guard = source.indexOf("shipment.type === 'merchant_restock'");
    const received = source.indexOf("shipment.status === 'received'", guard);
    const transitionLookup = source.indexOf('TRANSITIONS[shipment.status]');

    assert.ok(guard >= 0, 'merchant_restock guard is missing');
    assert.ok(received > guard, 'received must be terminal for HQ restock actions');
    assert.doesNotMatch(
      source.slice(guard, received),
      /shipment\.status === 'delivered'/,
      'delivered must remain correctable to shipped before store receipt',
    );
    assert.ok(
      transitionLookup > received,
      'terminal guard must run before the shared transition lookup',
    );
  });

  it('keeps the guard scoped to merchant restocks and leaves customer orders on shared transitions', () => {
    assert.match(
      source,
      /shipment\.type === 'merchant_restock'[\s\S]*shipment\.status === 'received'[\s\S]*throw new Error\('店家補貨已完成收貨，不可由 HQ 退回或變更狀態'\)/,
    );
    assert.doesNotMatch(source, /shipment\.type === 'customer_order'[\s\S]*不可由 HQ/);
  });
});
