import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../../../components/products/product-management-list.tsx', import.meta.url),
  'utf8',
);
const readinessSource = readFileSync(new URL('../readiness.ts', import.meta.url), 'utf8');

test('product management list exposes the three actionable setup areas', () => {
  for (const label of ['規格 / SKU', '寄賣', '買斷']) {
    assert.match(source, new RegExp(label));
  }
  for (const action of ['新增規格', '補 SKU', '設定佣金', '填買斷價']) {
    assert.match(readinessSource, new RegExp(action));
  }
  assert.match(source, />編輯<\/Link>/);
});

test('responsive list avoids nested setup cards and the old wide table layout', () => {
  assert.match(source, /minmax\(260px,1\.5fr\)/);
  assert.match(source, /SetupStatus/);
  assert.doesNotMatch(source, /SetupCard/);
  assert.match(source, /border-t border-border\/60 pt-3 xl:border-0 xl:pt-0/);
  assert.doesNotMatch(source, /<Table/);
});

test('status meaning is available as text and is not color-only', () => {
  assert.match(source, /item\.summary/);
  assert.match(readinessSource, /未啟用/);
  assert.match(source, /尚未完成必要設定/);
});
