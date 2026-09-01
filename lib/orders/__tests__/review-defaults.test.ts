import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultReviewDraft, deliveryDefaults } from '../review-defaults';
import type { Snapshot } from '../../shopify/intake-policy';

function snapshot(overrides: Record<string, unknown> = {}): Snapshot {
  return { schemaVersion: 1, order: {
    id: '1', name: '#1', currency: 'TWD', total_price: '100.00',
    shipping_address: { name: '王小明', phone: '0912345678', city: '台北市', address1: '測試路 1 號' },
    line_items: [{ title: '冷凍商品', sku: 'SKU-FROZEN', quantity: 1, price: '100.00' }],
    shipping_lines: [{ code: 'BLACKCAT_FROZEN', title: '黑貓冷凍宅配' }],
    note_attributes: [], ...overrides,
  } as never };
}

test('Shopify 配送 code 與商品主檔可自動填入正常宅配訂單', () => {
  const draft = defaultReviewDraft(snapshot(), [{ id: 'p1', sku: 'SKU-FROZEN', sourceSku: null, defaultTemperature: 'frozen' }]);
  assert.deepEqual(draft.lines, [{ productId: 'p1', temperature: 'frozen' }]);
  assert.equal(draft.method, 'home');
  assert.equal(draft.temperature, 'frozen');
  assert.equal(draft.recipient, '王小明');
  assert.equal(draft.phone, '0912345678');
});

test('7-11 門市資料由允許的 note attributes 帶入', () => {
  const source = snapshot({
    shipping_lines: [{ code: '711_PICKUP', title: '7-11 取貨常溫' }],
    note_attributes: [{ name: '門市店號', value: '123456' }, { name: '門市名稱', value: '測試門市' }],
  });
  assert.deepEqual(deliveryDefaults(source), {
    method: 'convenience', temperature: 'ambient', storeId: '123456', storeName: '測試門市',
  });
});

test('SKU 無符合或多筆符合時不猜商品', () => {
  const source = snapshot();
  assert.equal(defaultReviewDraft(source, []).lines[0]?.productId, '');
  assert.equal(defaultReviewDraft(source, [
    { id: 'p1', sku: 'SKU-FROZEN', sourceSku: null, defaultTemperature: 'frozen' },
    { id: 'p2', sku: 'OTHER', sourceSku: 'SKU-FROZEN', defaultTemperature: 'ambient' },
  ]).lines[0]?.productId, '');
});

test('未知配送方式不自行默認', () => {
  const result = deliveryDefaults(snapshot({ shipping_lines: [{ code: 'UNKNOWN', title: '自訂配送' }] }));
  assert.equal(result.method, '');
  assert.equal(result.temperature, '');
});
