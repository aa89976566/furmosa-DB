import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const pageSource = readFileSync(
  new URL('../../../app/(main)/products/[id]/page.tsx', import.meta.url),
  'utf8',
);

const formSource = readFileSync(
  new URL('../../../app/(main)/products/[id]/product-form.tsx', import.meta.url),
  'utf8',
);

test('product detail keeps the daily editing surface compact', () => {
  assert.match(pageSource, /<SummaryChip label="規格"/);
  assert.match(pageSource, /<SummaryChip label="售價"/);
  assert.match(pageSource, /<SummaryChip label="庫存"/);
  assert.doesNotMatch(pageSource, /label="毛利區間"/);
  assert.match(pageSource, /<summary[^>]*>[\s\S]*供應與庫存/);
  assert.match(pageSource, /<summary[^>]*>[\s\S]*庫存紀錄/);
});

test('low-frequency product settings use progressive disclosure', () => {
  assert.match(formSource, /<summary[^>]*>[\s\S]*進階設定/);
  assert.match(formSource, /<summary[^>]*>[\s\S]*店家合作設定/);
  assert.match(formSource, /label="商品名稱"/);
  assert.match(formSource, /label="商品類型"/);
  assert.match(formSource, /label="口味／主要原料"/);
  assert.doesNotMatch(formSource, /商品類型會提供分潤建議/);
  assert.doesNotMatch(formSource, /商務等級目前不影響佣金建議/);
});
