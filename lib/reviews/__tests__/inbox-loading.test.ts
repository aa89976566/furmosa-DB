import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import { after, test } from 'node:test';
import { snapshotHash, type Snapshot } from '@/lib/shopify/intake-policy';
import { adjustedSnapshot } from '@/lib/orders/hq-adjustment';

const source: Snapshot = { schemaVersion: 1, order: { name: '#PERF', currency: 'TWD', total_price: '100.00', subtotal_price: '100.00', financial_status: 'paid',
  line_items: [{ title: '原商品', quantity: 1, price: '100.00' }], shipping_address: { name: '原收件人', phone: '0900000000', address1: '原地址' } } };
const adjustment = { id: 'adjustment-2', entityId: 'oms', entityType: 'hq_order_adjustment', metadataJson: JSON.stringify({ version: 1, sourceHash: snapshotHash(source), reason: '人工調整', after: {
  lines: [{ title: '調整商品', quantity: 3, price: '80.00' }], subtotal: '240.00', shippingFee: '10.00', total: '250.00',
} }) };
const hash = snapshotHash(adjustedSnapshot(source, adjustment));
const review = { id: 'review-4', entityId: 'oms', entityType: 'oms_review', metadataJson: JSON.stringify({ schemaVersion: 1, sourceHash: hash, draft: { recipient: 'HQ收件人', phone: '0911111111', address: 'HQ地址', method: 'home' } }) };
const decision = { id: 'decision-3', entityId: 'oms', entityType: 'oms_review_decision', metadataJson: JSON.stringify({ action: 'reject', sourceHash: hash, reason: '缺貨' }) };
const base = { orderNumber: '訂單', externalOrderName: null, orderedAt: new Date('2026-11-17'), createdAt: new Date('2026-11-17'), customer: { name: '客戶' }, items: [], omsReviewedAt: null, _count: { shipments: 0 } };
const oms = { ...base, id: 'oms', omsStatus: 'REVIEW', source: 'shopify', shopifySnapshot: source };
const legacy = { ...base, id: 'legacy', omsStatus: null, source: 'manual', shopifySnapshot: null, items: [{ productName: '舊單商品' }] };
let orders: unknown[] = [oms, legacy];
let historyReads: unknown[] = [];
let history = [review, decision, adjustment];
let historyError = false;
const db = {
  order: { findMany: async () => orders, count: async () => orders.length },
  restockRequest: { findMany: async () => [], count: async () => 0 },
  campaignApplication: { findMany: async () => [], count: async () => 0 },
  partnerApplication: { findMany: async () => [], count: async () => 0 },
  statusAuditLog: { findMany: async (args: unknown) => { historyReads.push(args); if (historyError) throw new Error('history unavailable'); return history; } },
};
const internal = Module as typeof Module & { _load: (...args: unknown[]) => unknown };
const original = internal._load.bind(Module);
internal._load = (request: unknown, ...rest: unknown[]) => String(request) === '@/lib/prisma' ? { prisma: db } : original(request, ...rest);
const require = createRequire(import.meta.url);
const { loadReviewInbox } = require('../inbox') as typeof import('../inbox');
internal._load = original;
after(() => { internal._load = original; });

test('one bounded history read preserves all three independent revisions and legacy orders', async () => {
  const inbox = await loadReviewInbox();
  assert.equal(historyReads.length, 1);
  const args = historyReads[0] as { where: { entityId: { in: string[] }; entityType: { in: string[] } }; distinct: string[] };
  assert.deepEqual(args.where.entityId.in, ['oms']);
  assert.deepEqual(new Set(args.distinct), new Set(['entityId', 'entityType']));
  assert.equal(args.where.entityType.in.length, 3);
  const item = inbox.items.find(item => item.id === 'oms')!;
  assert.equal(item.preview?.amount, 'NT$250.00');
  assert.deepEqual(item.lines, ['調整商品 × 3']);
  assert.equal(item.preview?.customer, 'HQ收件人');
  assert.equal(item.preview?.address, 'HQ地址');
  assert.equal(item.rejectionReason, '缺貨');
  assert.equal(item.quickReview?.reviewRevision, 'review-4');
  const old = inbox.items.find(item => item.id === 'legacy')!;
  assert.equal(old.subtitle, '舊單商品');
  assert.equal(old.quickReview, undefined);
  assert.equal(inbox.counts.shopify_order, 2);
});

test('subsequent loads read current decisions rather than retaining earlier rejection data', async () => {
  history = [adjustment, review];
  const inbox = await loadReviewInbox();
  assert.equal(inbox.items.find(item => item.id === 'oms')?.rejectionReason, undefined);
});

test('empty and legacy-only inboxes do not read OMS history', async () => {
  for (const input of [[], [legacy]]) {
    orders = input;
    historyReads = [];
    const inbox = await loadReviewInbox();
    assert.equal(historyReads.length, 0);
    assert.equal(inbox.items.length, input.length);
  }
});

test('history failures remain visible instead of presenting unverified source data', async () => {
  orders = [oms]; historyError = true;
  await assert.rejects(loadReviewInbox(), /history unavailable/);
});
