import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LEGACY_MERCHANT_SERIAL_FLOW_ERROR,
  LEGACY_MERCHANT_SERIAL_FLOW_HEADERS,
  LEGACY_MERCHANT_SERIAL_FLOW_MESSAGE,
  legacyMerchantSerialFlowResult,
} from '@/lib/refill/legacy-merchant-flow';

test('舊的店員序號流程固定回 410、相容錯誤欄位且禁止快取', () => {
  const result = legacyMerchantSerialFlowResult();

  assert.equal(result.status, 410);
  assert.deepEqual(result.body, LEGACY_MERCHANT_SERIAL_FLOW_ERROR);
  assert.equal(result.body.error, LEGACY_MERCHANT_SERIAL_FLOW_MESSAGE);
  assert.equal(result.body.message, LEGACY_MERCHANT_SERIAL_FLOW_MESSAGE);
  assert.equal(result.body.code, 'LEGACY_REFILL_FLOW_REMOVED');
  assert.deepEqual(result.headers, LEGACY_MERCHANT_SERIAL_FLOW_HEADERS);
  assert.equal(result.headers['Cache-Control'], 'no-store');
  assert.deepEqual(legacyMerchantSerialFlowResult(), result);
});
