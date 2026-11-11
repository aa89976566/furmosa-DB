import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

const ciDatabase = 'postgresql://ci:ci@127.0.0.1:5432/ci';
if (process.env.CI !== 'true' || process.env.DATABASE_URL !== ciDatabase || process.env.DIRECT_URL !== ciDatabase) {
  throw new Error('HQ browser acceptance requires the disposable CI database.');
}
const db = new PrismaClient();
test.afterAll(async () => { await db.$disconnect(); });

test('HQ-only adjustment, re-review, audit history, deletion and restoration', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const suffix = `${testInfo.project.name}-${randomUUID()}`;
  const password = randomUUID();
  const email = `hq640-${suffix}@example.invalid`;
  const actor = await db.user.create({ data: { email, name: 'HQ640隔離驗收人員', role: 'admin', passwordHash: await bcrypt.hash(password, 10) } });
  const createProduct = (letter, price) => db.product.create({ data: {
    productId: `HQ640-${letter}-${suffix}`, sku: `HQ640-${letter}-${suffix}`, name: `HQ640測試商品${letter}-${suffix}`,
    category: 'toys', productCategory: 'STANDARD', status: 'active', price, unit: '件', defaultTemperature: 'ambient',
    priceTiers: { create: { weightGrams: null, unit: '件', unitQty: 1, price, sku: `HQ640-${letter}-${suffix}`, shopifySku: `HQ640-${letter}-${suffix}`, status: 'active' } },
  }, include: { priceTiers: true } });
  const first = await createProduct('A', 100);
  const second = await createProduct('B', 50);
  const timestamp = new Date().toISOString();
  const source = { schemaVersion: 1, promotionCaptureVersion: 1, order: {
    id: '64020261111', name: `OMS-TEST-HQ640-${suffix}`, currency: 'TWD', created_at: timestamp, updated_at: timestamp,
    financial_status: 'pending', fulfillment_status: null, subtotal_price: '100.00', total_price: '100.00', total_discounts: '0.00',
    total_shipping_price_set: { shop_money: { amount: '0.00', currency_code: 'TWD' } },
    shipping_address: { name: 'HQ640測試收件人', phone: '0900000000', address1: '隔離測試地址 禁止寄送' },
    shipping_lines: [{ title: '黑貓宅配', code: 'HOME', price: '0.00' }], note_attributes: [],
    line_items: [{ title: first.name, sku: first.sku, quantity: 1, price: '100.00', total_discount: '0.00', requires_shipping: true, properties: [] }],
  } };
  const order = await db.order.create({ data: {
    id: `oms-fixture-hq640-${suffix}`, orderNumber: source.order.name, source: 'shopify', status: 'pending_review',
    paymentStatus: 'unpaid', fulfillmentStatus: 'pending', subtotal: 100, total: 100,
    externalStore: `hq640-${suffix}.myshopify.com`, externalOrderId: suffix, externalOrderName: source.order.name,
    omsStatus: 'NEW', shopifySnapshot: source, shopifySourceUpdatedAt: new Date(timestamp),
  } });
  await page.goto(`/login?next=${encodeURIComponent(`/orders/${order.id}`)}`);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('密碼', { exact: true }).fill(password);
  await page.getByRole('button', { name: '登入', exact: true }).click();
  await expect(page.locator('#oms-review')).toBeVisible();
  // The mobile inbox opens one item at a time and can return to its filtered list.
  await page.goto('/reviews');
  await page.getByRole('textbox', { name: '搜尋待審核項目', exact: true }).fill(source.order.name);
  const queue = page.getByRole('complementary', { name: '待審核清單', exact: true });
  const detail = page.getByRole('region', { name: new RegExp(source.order.name) });
  const mobileLayout = page.viewportSize().width <= 1100;
  await expect(queue).toBeVisible();
  if (mobileLayout) await expect(detail).toBeHidden();
  await queue.getByRole('button').filter({ hasText: source.order.name }).click();
  await expect(detail).toBeVisible();
  if (mobileLayout) {
    await expect(queue).toBeHidden();
    await page.getByRole('button', { name: '返回待審核清單', exact: true }).click();
    await expect(queue).toBeVisible();
    await expect(detail).toBeHidden();
    await expect(page.getByRole('textbox', { name: '搜尋待審核項目', exact: true })).toHaveValue(source.order.name);
    await queue.getByRole('button').filter({ hasText: source.order.name }).click();
  }
  await detail.getByRole('link', { name: '審核訂單', exact: true }).click();
  await expect(page.locator('#oms-review')).toBeVisible();
  const editor = page.locator('details').filter({ has: page.locator('summary').filter({ hasText: /^修改 HQ 訂單$/ }) });
  await editor.locator('summary').click();
  await editor.getByLabel('數量', { exact: true }).fill('2');
  await editor.getByLabel('單價', { exact: true }).fill('80');
  await editor.getByLabel('新增商品規格', { exact: true }).selectOption(second.priceTiers[0].id);
  await editor.getByRole('button', { name: '新增商品', exact: true }).click();
  await editor.getByLabel('HQ 運費', { exact: true }).fill('10');
  await editor.getByLabel('修改原因', { exact: true }).fill('CI新增商品與調整數量單價');
  await editor.getByRole('button', { name: '儲存修改並重新送審', exact: true }).click();
  const adjustmentAudit = () => db.statusAuditLog.findFirst({ where: { entityType: 'hq_order_adjustment', entityId: order.id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  await expect.poll(async () => JSON.parse((await adjustmentAudit())?.metadataJson ?? '{}').after?.total).toBe('220.00');
  await page.reload();
  await editor.locator('summary').click();
  await expect(editor.getByLabel('數量', { exact: true }).first()).toHaveValue('2');
  const addedRow = editor.locator('div.space-y-2.rounded-lg.border').filter({ hasText: second.name });
  await addedRow.getByRole('button', { name: '移除商品', exact: true }).click();
  await editor.getByLabel('數量', { exact: true }).fill('3');
  await editor.getByLabel('修改原因', { exact: true }).fill('CI移除新增商品並重新送審');
  await editor.getByRole('button', { name: '儲存修改並重新送審', exact: true }).click();
  await expect.poll(async () => JSON.parse((await adjustmentAudit())?.metadataJson ?? '{}').after?.total).toBe('250.00');
  const audit = await adjustmentAudit();
  const change = JSON.parse(audit.metadataJson);
  expect(audit.actorId).toBe(actor.id);
  expect(change.before.lines).toHaveLength(2);
  expect(change.after.lines).toHaveLength(1);
  expect(change.after.lines[0].quantity).toBe(3);
  await page.goto('/reviews');
  await page.getByRole('textbox', { name: '搜尋待審核項目', exact: true }).fill(source.order.name);
  await expect(queue).toContainText('NT$250');
  await queue.getByRole('button').filter({ hasText: source.order.name }).click();
  await expect(detail).toContainText('HQ 調整後');
  await expect(detail).toContainText('NT$250');
  await expect(detail.getByText('× 3', { exact: true })).toBeVisible();
  await expect(detail).not.toContainText(second.name);
  await detail.getByRole('link', { name: '審核訂單', exact: true }).click();
  await expect(page.locator('#oms-review')).toBeVisible();
  await expect(page.getByLabel('配送方式', { exact: true })).toHaveValue('home');
  await page.getByRole('button', { name: '儲存修改', exact: true }).click();
  await expect.poll(async () => Boolean((await db.order.findUniqueOrThrow({ where: { id: order.id } })).omsCheckedAt)).toBe(true);
  await expect(page.getByRole('button', { name: '儲存修改', exact: true })).toBeEnabled();
  await expect(page.getByLabel('配送方式', { exact: true })).toHaveValue('home');
  await page.getByRole('button', { name: '確認訂單', exact: true }).click();
  await expect.poll(async () => (await db.order.findUniqueOrThrow({ where: { id: order.id } })).omsStatus).toBe('READY');
  expect(await db.shipment.count({ where: { orderId: order.id } })).toBe(0);
  expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).shopifySnapshot).toEqual(source);
  const history = page.locator('details').filter({ has: page.locator('summary').filter({ hasText: /^操作紀錄/ }) });
  await history.locator('summary').first().click();
  await expect(history.getByText('原因：CI移除新增商品並重新送審', { exact: true })).toBeVisible();
  const deletion = page.locator('#oms-review details').filter({ has: page.locator('summary').filter({ hasText: /^刪除訂單$/ }) });
  await deletion.locator('summary').click();
  await deletion.locator('select[name="reason"]').selectOption('測試訂單');
  await deletion.getByRole('button', { name: '刪除訂單', exact: true }).click();
  await expect.poll(async () => Boolean((await db.order.findUniqueOrThrow({ where: { id: order.id } })).deletedAt)).toBe(true);
  await page.reload();
  await page.locator('summary').filter({ hasText: /^還原訂單$/ }).click();
  await page.getByRole('button', { name: '確認還原', exact: true }).click();
  await expect.poll(async () => (await db.order.findUniqueOrThrow({ where: { id: order.id } })).deletedAt).toBeNull();
  const restored = await db.order.findUniqueOrThrow({ where: { id: order.id } });
  expect(restored.omsStatus).toBe('NEW');
  expect(restored.shopifySnapshot).toEqual(source);
  expect(await db.statusAuditLog.count({ where: { entityType: 'order_deletion', entityId: order.id, actorId: actor.id } })).toBe(2);
  expect(await db.shipment.count({ where: { orderId: order.id } })).toBe(0);
});
