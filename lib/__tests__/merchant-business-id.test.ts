import assert from 'node:assert/strict';
import test from 'node:test';
import { isValidMerchantBusinessId, nextMerchantBusinessId } from '../merchant-business-id';

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
});
