import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('換罐紀錄可進入店家限定明細，不再導回首頁', () => {
  const page = readFileSync(
    new URL('../../../app/pos/refill/[id]/page.tsx', import.meta.url),
    'utf8',
  );

  assert.match(page, /requireMerchantSession/);
  assert.match(page, /loadMerchantRefillOrderDetail\(session\.merchantId, id\)/);
  assert.match(page, /返回紀錄/);
  assert.match(page, /交付品項/);
  assert.doesNotMatch(page, /redirect\(['"]\/pos\/refill/);
});
