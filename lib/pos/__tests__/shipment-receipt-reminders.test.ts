import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { receiptReminderStage } from '../shipment-receipt-reminders';

describe('receiptReminderStage', () => {
  const shippedAt = new Date('2026-09-01T08:00:00.000Z');
  it('does not remind before three full days', () => {
    assert.equal(receiptReminderStage(shippedAt, new Date('2026-09-04T07:59:59.999Z')), null);
  });
  it('reminds on day three', () => {
    assert.equal(receiptReminderStage(shippedAt, new Date('2026-09-04T08:00:00.000Z')), 3);
  });
  it('switches to the final reminder on day five', () => {
    assert.equal(receiptReminderStage(shippedAt, new Date('2026-09-06T08:00:00.000Z')), 5);
  });
});
