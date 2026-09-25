import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync('app/(main)/orders/[id]/page.tsx', 'utf8');

test('店家訂單詳情顯示保存的商務快照與覆寫稽核', () => {
  for (const evidence of [
    'businessTierSnapshot',
    'commercialRuleSource',
    'defaultCommercialMode',
    'defaultCommercialValue',
    'appliedCommercialMode',
    'appliedCommercialValue',
    'commercialOverrideReason',
    'commercialOverrideBy',
    'commercialOverrideAt',
    '套用條件',
    '調整原因',
  ]) {
    assert.match(page, new RegExp(evidence));
  }
});

test('商務快照只顯示保存值，不重新讀取商品目前預設', () => {
  const commercialBlock = page.slice(
    page.indexOf("{order.merchant && !it.isGift"),
    page.indexOf('</TableCell>', page.indexOf("{order.merchant && !it.isGift")),
  );
  assert.doesNotMatch(commercialBlock, /it\.product\.businessTier/);
  assert.doesNotMatch(commercialBlock, /defaultConsignmentCommission/);
  assert.doesNotMatch(commercialBlock, /defaultWholesaleUnitPrice/);
});
