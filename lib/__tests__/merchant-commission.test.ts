import assert from 'node:assert/strict';
import test from 'node:test';
import { suggestMerchantCommissionPercent } from '@/lib/merchant-commission';

test('凍乾 → 30%', () => {
  assert.equal(suggestMerchantCommissionPercent({ name: '雞肉丁凍乾' }), 30);
  assert.equal(suggestMerchantCommissionPercent({ name: '柳葉魚凍乾' }), 30);
  assert.equal(
    suggestMerchantCommissionPercent({ name: '鮮魚零食', category: 'freeze_dried' }),
    30,
  );
});

test('肉乾／一般零食 → 20%', () => {
  assert.equal(suggestMerchantCommissionPercent({ name: '牛肉地瓜乾' }), 20);
  assert.equal(suggestMerchantCommissionPercent({ name: '原味雞霸' }), 20);
  assert.equal(suggestMerchantCommissionPercent({ name: '鴨喉嚨' }), 20);
  assert.equal(suggestMerchantCommissionPercent({ name: '豬耳朵條' }), 20);
});
