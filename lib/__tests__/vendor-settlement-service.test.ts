import assert from 'node:assert/strict';
import test from 'node:test';
import { vendorSettlementIdentity } from '../vendor-settlement-service';

test('相同供應商、期間與規則產生相同冪等鍵及對帳編號', () => {
  const input = {
    vendorId: 'qiqi',
    periodStart: new Date('2026-10-01T00:00:00.000Z'),
    periodEnd: new Date('2026-11-01T00:00:00.000Z'),
  };
  assert.deepEqual(vendorSettlementIdentity(input), vendorSettlementIdentity(input));
  assert.match(vendorSettlementIdentity(input).settlementNumber, /^VSET-202610-[A-F0-9]{10}$/);
});

test('不同期間或供應商不會共用同一張對帳草稿', () => {
  const base = {
    vendorId: 'qiqi',
    periodStart: new Date('2026-10-01T00:00:00.000Z'),
    periodEnd: new Date('2026-11-01T00:00:00.000Z'),
  };
  const first = vendorSettlementIdentity(base);
  assert.notEqual(first.idempotencyKey, vendorSettlementIdentity({ ...base, vendorId: 'other' }).idempotencyKey);
  assert.notEqual(first.idempotencyKey, vendorSettlementIdentity({
    ...base,
    periodStart: new Date('2026-11-01T00:00:00.000Z'),
    periodEnd: new Date('2026-12-01T00:00:00.000Z'),
  }).idempotencyKey);
});
