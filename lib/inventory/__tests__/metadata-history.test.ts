import assert from 'node:assert/strict';
import { test } from 'node:test';
import { metadataHistoryLines } from '../metadata-history.ts';

test('shows only changed metadata and displays the actual Taiwan calendar date', () => {
  assert.deepEqual(metadataHistoryLines({ vendorId: null, receiptDate: null }, { vendorId: 'v1', receiptDate: '2026-10-25T18:00:00.000Z' }, new Map([['v1', '測試廠商']])), [
    { label: '廠商', before: '未填', after: '測試廠商' },
    { label: '實際進貨日期', before: '未填', after: '2026-10-26' },
  ]);
  assert.deepEqual(metadataHistoryLines({ vendorId: 'v1', receiptDate: null }, { vendorId: 'v1', receiptDate: null }, new Map()), []);
});
test('missing vendor records retain identity and malformed historical dates do not crash the page', () => {
  const lines = metadataHistoryLines(null, { vendorId: 'removed-vendor', receiptDate: 'invalid' }, new Map());
  assert.equal(lines[0].after, '廠商（removed-vendor）');
  assert.equal(lines[1].after, '日期資料無法辨識');
});
