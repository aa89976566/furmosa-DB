import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { currentReviewDraft } from '../review-display';
import { snapshotHash, type Snapshot } from '../../shopify/intake-policy';

const snapshot: Snapshot = { schemaVersion: 1, order: { id: '123', updated_at: '2026-08-31T00:00:00Z' } };
const metadata = JSON.stringify({ schemaVersion: 1, sourceHash: snapshotHash(snapshot), draft: {
  recipient: '測試收件人', phone: '0000000000', address: '假地址', method: 'home', temperature: 'ambient',
} });
test('顯示同版本已儲存的審核收件資訊', () => {
  assert.equal(currentReviewDraft(snapshot, metadata)?.recipient, '測試收件人');
  assert.equal(currentReviewDraft(snapshot, metadata)?.method, 'home');
});
test('來源更新時不沿用舊版審核資料', () => {
  assert.equal(currentReviewDraft({ ...snapshot, order: { ...snapshot.order, updated_at: '2026-09-01T00:00:00Z' } }, metadata), null);
});
test('缺失、壞掉與不支援版本的紀錄安全退回待審核', () => {
  for (const value of [null, undefined, 'broken', 'null', '[]', '{}', JSON.stringify({ schemaVersion: 2, sourceHash: snapshotHash(snapshot), draft: {} })]) {
    assert.equal(currentReviewDraft(snapshot, value), null);
  }
  assert.equal(currentReviewDraft(null, metadata), null);
});
test('詳情以 OMS 狀態與真實審核時間呈現，舊流程仍保留', () => {
  const page = readFileSync(new URL('../../../app/(main)/orders/[id]/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /OMS_LABELS\[order.omsStatus\]/);
  assert.match(page, /time=\{order.omsReviewedAt\}/);
  assert.match(page, /!order.omsStatus && order.status !== 'draft'/);
  assert.match(page, /<StatusBadge kind="order" value=\{order.status\}/);
  assert.match(page, /savedReview.recipient/);
});
