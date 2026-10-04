import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../../../components/merchants/merchants-operations-dashboard.tsx', import.meta.url),
  'utf8',
);

test('merchant overview uses compact period metrics instead of four stat cards', () => {
  for (const label of ['銷售件數', '銷售額', '店家分潤', '公司實收']) {
    assert.match(source, new RegExp(label));
  }
  assert.match(source, /function Metric/);
  assert.doesNotMatch(source, /MerchantStatGrid/);
  assert.doesNotMatch(source, /MerchantStat label=/);
});

test('merchant desktop table groups identity metadata and keeps seven operational columns', () => {
  for (const label of ['店家', '在店庫存', '期間銷售', '銷售額', '分潤', '結算']) {
    assert.match(source, new RegExp(`<TableHead[^>]*>${label}</TableHead>`));
  }
  assert.doesNotMatch(source, /<TableHead>編號<\/TableHead>/);
  assert.doesNotMatch(source, /<TableHead>產業<\/TableHead>/);
  assert.doesNotMatch(source, /<TableHead>城市<\/TableHead>/);
  assert.match(source, /merchant\.merchantId/);
  assert.match(source, /merchantIndustryDisplay\(merchant\.industry\)/);
  assert.match(source, /merchant\.orderCount\} 筆訂單/);
});
