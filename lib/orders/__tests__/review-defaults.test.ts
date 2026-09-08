import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultReviewDraft, deliveryDefaults, fillReviewDraftBlanks, reviewLineDisplays, skuMatchingProducts, sourceQuantityLabel } from '../review-defaults';
import { reviewDraft } from '../review-policy';
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

const frozen = { id: 'p1', name: '冷凍商品', sku: 'SKU-FROZEN', sourceSku: null, defaultTemperature: 'frozen' };

test('Shopify 配送 code 與商品主檔可自動填入正常宅配訂單', () => {
  const draft = defaultReviewDraft(snapshot(), [frozen]);
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
    { id: 'p1', name: '冷凍商品 A', sku: 'SKU-FROZEN', sourceSku: null, defaultTemperature: 'frozen' },
    { id: 'p2', name: '冷凍商品 B', sku: 'OTHER', sourceSku: 'SKU-FROZEN', defaultTemperature: 'ambient' },
  ]).lines[0]?.productId, '');
});

test('月餅即使 Shopify 沒有 SKU，也沿用共用商品識別自動對應 HQ 商品與溫層', () => {
  const source = snapshot({
    line_items: [{ title: '牠的月餅｜地瓜山藥雞肉月餅 50g', sku: '', quantity: 10, price: '79.00' }],
    total_price: '790.00',
  });
  const mooncake = {
    id: 'p-mooncake', name: '地瓜山藥雞肉月餅', sku: 'CK-08', sourceSku: 'CK-08',
    defaultTemperature: 'frozen',
  };
  const draft = defaultReviewDraft(source, [mooncake]);
  assert.deepEqual(draft.lines, [{ productId: 'p-mooncake', temperature: 'frozen' }]);
  assert.equal(reviewLineDisplays(source, [mooncake], draft, null)[0]?.mappingKind, 'auto');
  assert.equal(reviewLineDisplays(source, [mooncake], draft, null)[0]?.quantityLabel, '×10');
});

test('未知配送方式不自行默認', () => {
  const result = deliveryDefaults(snapshot({ shipping_lines: [{ code: 'UNKNOWN', title: '自訂配送' }] }));
  assert.equal(result.method, '');
  assert.equal(result.temperature, '');
});

test('舊審核只補空白欄位，不覆蓋人工內容', () => {
  const saved = reviewDraft({
    lines: [{ productId: '', temperature: '' }], method: '', temperature: '',
    recipient: '人工收件人', phone: '', address: '', storeId: '', storeName: '',
    giftsConfirmed: true,
  });
  const suggested = reviewDraft({
    lines: [{ productId: 'product-1', temperature: 'ambient' }], method: 'home', temperature: 'ambient',
    recipient: 'Shopify 收件人', phone: '0912345678', address: '測試地址',
  });
  const result = fillReviewDraftBlanks(saved, suggested);
  assert.equal(result.applied, true);
  assert.deepEqual(result.draft.lines, [{ productId: 'product-1', temperature: 'ambient' }]);
  assert.equal(result.draft.recipient, '人工收件人');
  assert.equal(result.draft.phone, '0912345678');
  assert.equal(result.draft.method, 'home');
  assert.equal(result.draft.giftsConfirmed, true);
});

test('完整人工審核不套用新建議', () => {
  const saved = reviewDraft({ lines: [{ productId: 'manual', temperature: 'frozen' }], method: 'home',
    temperature: 'frozen', recipient: '人工', phone: '0900000000', address: '人工地址',
    storeId: '654321', storeName: '人工門市' });
  const suggested = reviewDraft({ lines: [{ productId: 'suggested', temperature: 'ambient' }], method: 'convenience',
    temperature: 'ambient', recipient: 'Shopify', phone: '0911111111', address: '來源地址',
    storeId: '123456', storeName: '測試門市' });
  const result = fillReviewDraftBlanks(saved, suggested);
  assert.equal(result.applied, false);
  assert.deepEqual(result.draft, saved);
});

test('只有空白字元的舊電話會補值並顯示已套用提示', () => {
  const saved = reviewDraft({ lines: [{ productId: 'manual', temperature: 'ambient' }], method: 'home',
    temperature: 'ambient', recipient: '人工', phone: '   ', address: '人工地址' });
  const suggested = reviewDraft({ lines: [{ productId: 'suggested', temperature: 'frozen' }], method: 'convenience',
    temperature: 'frozen', recipient: 'Shopify', phone: '0912345678', address: '來源地址' });
  const result = fillReviewDraftBlanks(saved, suggested);
  assert.equal(result.applied, true);
  assert.equal(result.draft.phone, '0912345678');
  assert.equal(result.draft.lines[0]?.productId, 'manual');
});

test('唯一 sku 或 sourceSku 可自動帶入，同商品兩欄命中仍只算一筆', () => {
  assert.equal(defaultReviewDraft(snapshot(), [frozen]).lines[0]?.productId, 'p1');
  assert.equal(defaultReviewDraft(snapshot(), [
    { id: 'p1', name: '冷凍商品', sku: 'HQ-1', sourceSku: 'SKU-FROZEN', defaultTemperature: 'frozen' },
  ]).lines[0]?.productId, 'p1');
  assert.equal(defaultReviewDraft(snapshot(), [
    { id: 'p1', name: '冷凍商品', sku: 'SKU-FROZEN', sourceSku: 'SKU-FROZEN', defaultTemperature: 'frozen' },
  ]).lines[0]?.productId, 'p1');
  assert.equal(skuMatchingProducts('SKU-FROZEN', [
    { id: 'p1', sku: 'SKU-FROZEN', sourceSku: 'SKU-FROZEN' },
  ]).length, 1);
});

test('空 SKU 無可靠標題、無匹配與大小寫不同都不自動帶入', () => {
  assert.equal(defaultReviewDraft(snapshot({ line_items: [{ title: '無法辨識商品', sku: '', quantity: 1, price: '100.00' }] }), [frozen]).lines[0]?.productId, '');
  assert.equal(defaultReviewDraft(snapshot({ line_items: [{ title: '其他', sku: 'NO-MATCH', quantity: 1, price: '100.00' }] }), [frozen]).lines[0]?.productId, '');
  assert.equal(defaultReviewDraft(snapshot(), [
    { id: 'p1', name: '不同名稱', sku: 'sku-frozen', sourceSku: 'sku-frozen', defaultTemperature: 'frozen' },
  ]).lines[0]?.productId, '');
  assert.deepEqual(skuMatchingProducts('', [frozen]), []);
});

test('來源數量僅接受正整數，其餘顯示待確認', () => {
  assert.equal(sourceQuantityLabel(10), '×10');
  assert.equal(sourceQuantityLabel(2147483647), '×2147483647');
  for (const quantity of [0, -1, 0.5, 1.5, '10', null, undefined, 2147483648, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(sourceQuantityLabel(quantity), '數量待確認');
  }
});

test('新 draft 唯一匹配為 auto；已保存相同不是 auto；衝突保留原值', () => {
  const source = snapshot({ line_items: [{ title: '冷凍商品', sku: 'SKU-FROZEN', quantity: 10, price: '100.00' }] });
  const draft = defaultReviewDraft(source, [frozen]);
  const auto = reviewLineDisplays(source, [frozen], draft, null);
  assert.deepEqual(auto, [{ title: '冷凍商品', quantityLabel: '×10', mappingKind: 'auto', conflictMessage: '' }]);

  const savedSame = reviewDraft({ ...draft, lines: [{ productId: 'p1', temperature: 'frozen' }] });
  assert.equal(reviewLineDisplays(source, [frozen], savedSame, savedSame)[0]?.mappingKind, 'saved');
  assert.equal(reviewLineDisplays(source, [frozen], savedSame, savedSame)[0]?.conflictMessage, '');

  const savedOther = reviewDraft({ ...draft, lines: [{ productId: 'old', temperature: 'frozen' }] });
  const conflict = reviewLineDisplays(source, [frozen], savedOther, savedOther)[0];
  assert.equal(conflict?.mappingKind, 'conflict');
  assert.match(conflict?.conflictMessage ?? '', /不同/);
  assert.equal(savedOther.lines[0]?.productId, 'old');

  const emptySku = snapshot({ line_items: [{ title: '無法辨識商品', sku: '', quantity: 2, price: '100.00' }] });
  const emptyDraft = defaultReviewDraft(emptySku, [frozen]);
  assert.equal(reviewLineDisplays(emptySku, [frozen], emptyDraft, null)[0]?.mappingKind, 'select');

  const savedOnEmpty = reviewDraft({ ...emptyDraft, lines: [{ productId: 'p1', temperature: 'frozen' }] });
  assert.equal(reviewLineDisplays(emptySku, [frozen], savedOnEmpty, savedOnEmpty)[0]?.mappingKind, 'conflict');

  const blankSaved = reviewDraft({ ...draft, lines: [{ productId: '', temperature: '' }] });
  const filled = fillReviewDraftBlanks(blankSaved, draft).draft;
  assert.equal(filled.lines[0]?.productId, 'p1');
  assert.equal(reviewLineDisplays(source, [frozen], filled, blankSaved)[0]?.mappingKind, 'auto');
});
