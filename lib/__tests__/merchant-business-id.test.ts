import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canRepairMerchantBusinessId,
  isReservedNonOfficialMerchantBusinessId,
  isValidMerchantBusinessId,
  merchantBusinessIdKind,
  nextMerchantBusinessId,
} from '../merchant-business-id';

test('店家編號忽略內部文字型編號並接續最大數字', () => {
  assert.equal(
    nextMerchantBusinessId(['MER-0019', 'MER-0020', 'MER-REFILL', 'MER-DEMO', 'MER-0NaN']),
    'MER-0021',
  );
});

test('正式店家編號必須是 MER 加至少四位數字', () => {
  assert.equal(isValidMerchantBusinessId('MER-0021'), true);
  assert.equal(isValidMerchantBusinessId('MER-REFILL'), false);
  assert.equal(isValidMerchantBusinessId('MER-0NaN'), false);
  assert.equal(isValidMerchantBusinessId('MER-DEMO'), false);
});

test('測試示範編號不得誤判為正式店家，也不可修復', () => {
  assert.equal(merchantBusinessIdKind('MER-0021'), 'official');
  assert.equal(merchantBusinessIdKind('MER-DEMO'), 'reserved');
  assert.equal(merchantBusinessIdKind('MER-REFILL'), 'reserved');
  assert.equal(merchantBusinessIdKind('MER-OTHER'), 'reserved');
  assert.equal(isReservedNonOfficialMerchantBusinessId('MER-DEMO'), true);
  assert.equal(canRepairMerchantBusinessId('MER-DEMO'), false);
  assert.equal(canRepairMerchantBusinessId('MER-0021'), false);
});

test('損壞的正式型編號才可手動修復', () => {
  assert.equal(merchantBusinessIdKind('MER-0NaN'), 'invalid');
  assert.equal(canRepairMerchantBusinessId('MER-0NaN'), true);
  assert.equal(canRepairMerchantBusinessId('MER-21'), true);
});
