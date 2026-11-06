import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LEGACY_MERCHANT_SERIAL_FLOW_ERROR,
  legacyMerchantSerialFlowResult,
} from '@/lib/refill/legacy-merchant-flow';

test('舊的店員序號流程明確停用並引導回到店交付', () => {
  const result = legacyMerchantSerialFlowResult();

  assert.equal(result.status, 410);
  assert.deepEqual(result.body, LEGACY_MERCHANT_SERIAL_FLOW_ERROR);
});
