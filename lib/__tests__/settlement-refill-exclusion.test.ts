import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldIncludeInSettlementSale } from '@/lib/merchant-settlement-sales';
import {
  isRefillInventoryNote,
  refillAdminSyncNote,
  refillDeliveryNote,
  refillReservationNote,
} from '@/lib/jar-exchange/refill-inventory';

describe('settlement excludes refill inventory', () => {
  it('includes normal sale and unpaired negative adjust', () => {
    assert.equal(
      shouldIncludeInSettlementSale({ type: 'sale', quantity: -1, note: null }),
      true,
    );
    assert.equal(
      shouldIncludeInSettlementSale({ type: 'adjust', quantity: -2, note: '盤點' }),
      true,
    );
  });

  it('excludes refill_* types and note prefixes', () => {
    assert.equal(
      shouldIncludeInSettlementSale({
        type: 'refill_delivery',
        quantity: -1,
        note: refillDeliveryNote('o1'),
      }),
      false,
    );
    assert.equal(
      shouldIncludeInSettlementSale({
        type: 'refill_reservation',
        quantity: -1,
        note: refillReservationNote('o1'),
      }),
      false,
    );
    assert.equal(
      shouldIncludeInSettlementSale({
        type: 'adjust',
        quantity: -1,
        note: refillAdminSyncNote('store_x'),
      }),
      false,
    );
    assert.equal(
      shouldIncludeInSettlementSale({
        type: 'adjust',
        quantity: -1,
        note: `${refillDeliveryNote('o2')}（庫存不足：原 0）`,
      }),
      false,
    );
  });

  it('detects refill note prefixes', () => {
    assert.equal(isRefillInventoryNote(refillDeliveryNote('a')), true);
    assert.equal(isRefillInventoryNote('盤點少了'), false);
  });
});
