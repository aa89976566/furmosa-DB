import assert from 'node:assert/strict';
import test from 'node:test';
import { analyticsDistinctId, sanitizeAnalyticsProperties } from '@/lib/analytics/posthog-server';

test('LINE user IDs are irreversibly replaced before analytics capture', () => {
  const raw = 'U0123456789abcdef';
  const hashed = analyticsDistinctId(raw);
  assert.equal(hashed.length, 64);
  assert.notEqual(hashed, raw);
  assert.equal(hashed, analyticsDistinctId(raw));
});

test('sensitive customer and payment fields are rejected', () => {
  assert.deepEqual(sanitizeAnalyticsProperties({
    category: 'treats', item_count: 2, recipient_name: '王小明',
    phone: '0912345678', shipping_address: '台北市', transfer_last5: '12345',
    error_message: 'customer details',
  }), { category: 'treats', item_count: 2 });
});
