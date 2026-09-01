import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canAdjustMemberPoints,
  formatManualPointsNote,
  parseManualPointsInput,
} from '@/lib/jar-exchange/manual-points';

const valid = {
  customerId: 'customer-1',
  mode: 'add',
  amount: '10',
  reason: 'system_test',
  detail: 'LINE 綁定驗證',
  requestId: '123e4567-e89b-12d3-a456-426614174000',
};

test('manual points input produces a signed addition and audit note', () => {
  const result = parseManualPointsInput(valid);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.pointsChange, 10);
  assert.equal(formatManualPointsNote(result.value), '系統測試｜LINE 綁定驗證');
});

test('manual points deduction is signed and capped', () => {
  const deduction = parseManualPointsInput({ ...valid, mode: 'deduct', amount: '7' });
  assert.equal(deduction.ok, true);
  if (deduction.ok) assert.equal(deduction.value.pointsChange, -7);

  const tooLarge = parseManualPointsInput({ ...valid, amount: '1001' });
  assert.deepEqual(tooLarge, { ok: false, error: '點數必須是 1～1000 的整數' });
});

test('manual points requires a controlled reason and idempotency key', () => {
  assert.equal(parseManualPointsInput({ ...valid, reason: '' }).ok, false);
  assert.equal(parseManualPointsInput({ ...valid, requestId: 'bad-key' }).ok, false);
});

test('only HQ admin and staff can adjust points', () => {
  assert.equal(canAdjustMemberPoints('admin'), true);
  assert.equal(canAdjustMemberPoints('staff'), true);
  assert.equal(canAdjustMemberPoints('finance'), false);
  assert.equal(canAdjustMemberPoints('warehouse'), false);
});
