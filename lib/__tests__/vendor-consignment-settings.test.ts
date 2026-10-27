import assert from 'node:assert/strict';
import test from 'node:test';
import { basisPointsToPercent, parseVendorConsignmentSettings } from '../vendor-consignment-settings';

test('QIQI 的 25% 精確保存為 2500 basis points', () => {
  assert.deepEqual(parseVendorConsignmentSettings({
    enabled: true,
    furmosaSharePercent: '25',
  }), {
    supplierConsignmentEnabled: true,
    furmosaShareBps: 2_500,
    settlementCurrency: 'TWD',
  });
  assert.equal(basisPointsToPercent(2_500), '25');
});

test('支援最多兩位小數，停用後清除比例避免誤結算', () => {
  assert.equal(parseVendorConsignmentSettings({
    enabled: true,
    furmosaSharePercent: '25.55',
  }).furmosaShareBps, 2_555);
  assert.deepEqual(parseVendorConsignmentSettings({
    enabled: false,
    furmosaSharePercent: '25',
  }), {
    supplierConsignmentEnabled: false,
    furmosaShareBps: null,
    settlementCurrency: 'TWD',
  });
});

test('拒絕空白、超過範圍或超過兩位小數', () => {
  assert.throws(() => parseVendorConsignmentSettings({ enabled: true, furmosaSharePercent: '' }));
  assert.throws(() => parseVendorConsignmentSettings({ enabled: true, furmosaSharePercent: '101' }));
  assert.throws(() => parseVendorConsignmentSettings({ enabled: true, furmosaSharePercent: '25.555' }));
});
