import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../../../app/(main)/inventory/page.tsx', import.meta.url),
  'utf8',
);

test('inventory workspace uses compact navigation and metrics instead of stacked summary cards', () => {
  assert.match(source, /aria-label="庫存分類"/);
  assert.match(source, /<Metric label="品項"/);
  assert.match(source, /<Metric label="低庫存"/);
  assert.match(source, /<Metric label="待收貨"/);
  assert.doesNotMatch(source, /SummaryCard/);
});

test('inventory table prioritizes operational stock columns', () => {
  for (const label of ['商品', 'HQ 庫存', '其他倉', '成本 \/ g', '狀態']) {
    assert.match(source, new RegExp(label));
  }
  assert.equal((source.match(/<TableHead/g) ?? []).length >= 5, true);
  assert.doesNotMatch(source, />總倉<\/TableHead>/);
  assert.doesNotMatch(source, />南倉<\/TableHead>/);
  assert.doesNotMatch(source, />寄賣<\/TableHead>/);
});

test('inventory identity prefers product family SKU while retaining internal HQ SKU', () => {
  assert.match(source, /product\.sourceSku \?\? product\.sku/);
  assert.match(source, /HQ \{product\.sku\}/);
  assert.match(source, /調整庫存/);
});
