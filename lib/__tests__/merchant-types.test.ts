import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MERCHANT_COOPERATION_TYPES,
  MERCHANT_TAG_TYPES,
  merchantTypeLabel,
  parseMerchantTypesFromForm,
  primaryMerchantType,
} from '@/lib/merchant-types';

test('店家合作方式包含寄賣、販售與換罐', () => {
  assert.deepEqual(MERCHANT_COOPERATION_TYPES, [
    'consignment',
    'wholesale',
    'jar_exchange',
  ]);
  assert.equal(merchantTypeLabel.wholesale, '販售');
});

test('店家舊標籤仍保留，避免既有資料遺失', () => {
  assert.deepEqual(MERCHANT_TAG_TYPES, ['pop_up', 'flagship', 'partner']);
});

test('表單可複選合作方式並排除無效值', () => {
  const formData = new FormData();
  formData.append('types', 'wholesale');
  formData.append('types', 'jar_exchange');
  formData.append('types', 'wholesale');
  formData.append('types', 'unknown');

  const types = parseMerchantTypesFromForm(formData);
  assert.deepEqual(types, ['wholesale', 'jar_exchange']);
  assert.equal(primaryMerchantType(types), 'wholesale');
});
