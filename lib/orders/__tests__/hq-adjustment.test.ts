import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shopifySnapshot, snapshotHash } from '../../shopify/intake-policy';
import { adjustedSnapshot, adjustmentTotals } from '../hq-adjustment';
import { saveHqAdjustment } from '../hq-adjustment-service';

const snapshot = shopifySnapshot({ id: '123', financial_status: 'paid', currency: 'TWD', subtotal_price: '100.00', total_price: '100.00', line_items: [{ title: '原商品', sku: 'A', quantity: 1, price: '100.00' }], total_shipping_price_set: { shop_money: { amount: '0.00' } } });
function fixture() {
  const audits: any[] = [];
  const order: any = { id: 'o1', externalStore: 'test.myshopify.com', externalOrderId: '123', omsStatus: 'REVIEW', status: 'pending_review', shopifySnapshot: structuredClone(snapshot), shipments: [], omsReviewedAt: new Date(), omsReviewedById: 'old' };
  let role = 'staff';
  const tx: any = {
    user: { findUnique: async () => ({ role }) }, $executeRaw: async () => 1,
    order: { findUniqueOrThrow: async () => order, update: async ({ data }: any) => Object.assign(order, data) },
    statusAuditLog: { findFirst: async () => audits.at(-1) ?? null, create: async ({ data }: any) => { const row = { ...data, id: `a${audits.length}` }; audits.push(row); return row; } },
    productPriceTier: { findUnique: async () => ({ id: 't1', status: 'active', price: 20, sku: 'B', variantName: '杜桑', unit: '組', product: { status: 'active', name: '新商品', sku: 'B' } }) },
  };
  const db: any = { $transaction: async (fn: any) => fn(tx) };
  const command = { actorId: 'staff1', orderId: 'o1', sourceHash: snapshotHash(snapshot), revision: '', reason: '客人要求調整', lines: [{ sourceIndex: 0, quantity: 2, price: '99.95' }], shippingFee: '0' };
  return { audits, order, db, command, tx, setRole: (value: string) => { role = value; } };
}
test('HQ 調整保留 Shopify 原單，記錄前後、原因及操作人，並清除審核', async () => {
  const f = fixture();
  await saveHqAdjustment(f.db, f.command);
  assert.deepEqual(f.order.shopifySnapshot, snapshot);
  const audit = f.audits[0]; const data = JSON.parse(audit.metadataJson);
  assert.equal(audit.actorId, 'staff1'); assert.equal(data.reason, '客人要求調整');
  assert.equal(data.before.lines[0].quantity, 1); assert.equal(data.after.lines[0].quantity, 2);
  assert.equal(data.after.total, '199.90'); assert.equal(f.order.omsStatus, 'REVIEW');
  assert.equal(f.order.omsReviewedAt, null); assert.equal(f.order.omsCheckedAt, null);
  const effective = adjustedSnapshot(snapshot, audit);
  assert.equal((effective.order.line_items as any[])[0].quantity, 2);
  assert.notEqual(snapshotHash(effective), snapshotHash(snapshot));
  assert.throws(() => adjustedSnapshot({ ...snapshot, order: { ...snapshot.order, total_price: '101.00' } }, audit), /原單已有更新/);
  await assert.rejects(saveHqAdjustment(f.db, f.command), /其他人已修改/);
});
test('新增及移除商品使用 HQ 規格，運費以分計算', async () => {
  const f = fixture(); await saveHqAdjustment(f.db, { ...f.command, lines: [{ tierId: 't1', quantity: 3, price: '20.10' }], shippingFee: '129' });
  const data = JSON.parse(f.audits[0].metadataJson);
  assert.equal(data.after.lines[0].variant_title, '杜桑'); assert.equal(data.after.lines[0].sku, 'B'); assert.equal(data.after.lines.length, 1); assert.equal(data.after.lines[0].title, '新商品'); assert.equal(data.after.total, '189.30');
});
test('拒絕無原因、越權、過期、已出貨與無效數量金額', async () => {
  let f = fixture(); await assert.rejects(saveHqAdjustment(f.db, { ...f.command, reason: '' }), /原因/);
  f = fixture(); f.setRole('merchant'); await assert.rejects(saveHqAdjustment(f.db, f.command), /權限/);
  f = fixture(); await assert.rejects(saveHqAdjustment(f.db, { ...f.command, sourceHash: 'stale' }), /已更新/);
  f = fixture(); f.order.shipments = [{ status: 'pending' }]; await assert.rejects(saveHqAdjustment(f.db, f.command), /出貨單/);
  for (const quantity of [0, -1, 1.5, 10000]) assert.throws(() => adjustmentTotals([{ price: '10', quantity }], '0'));
  for (const price of ['-1', 'NaN', '1.001']) assert.throws(() => adjustmentTotals([{ price, quantity: 1 }], '0'));
  assert.throws(() => adjustmentTotals([], '0'));
});

test('四款香氣以規格 ID 加入同一待審訂單並保留名稱與 Shopify 對應', async () => {
  for (const [index, name] of ['牡丹', '杜桑', '經典迪奧', '琥珀與薰衣草'].entries()) {
    const f = fixture();
    f.tx.productPriceTier.findUnique = async () => ({ id: `wax-${index}`, variantName: name, status: 'active', sku: `WAX-${index}`, shopifyVariantId: `variant-${index}`, unit: '組', product: { status: 'active', name: '雞排加蠟', sku: 'WAX' } });
    await saveHqAdjustment(f.db, { ...f.command, lines: [{ tierId: `wax-${index}`, quantity: 1, price: '399' }], shippingFee: '0' });
    const line = JSON.parse(f.audits[0].metadataJson).after.lines[0];
    assert.equal(line.variant_title, name);
    assert.equal(line.variant_id, `variant-${index}`);
    assert.equal(line.sku, `WAX-${index}`);
    assert.equal(f.order.id, 'o1');
    assert.deepEqual(f.order.shopifySnapshot, snapshot);
  }
});
