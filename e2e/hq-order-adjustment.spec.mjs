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
    omsIssueFlags: [{ code: 'PHONE_MISSING', severity: 'blocking', message: '請核對收件電話' }],
  } });
  await page.goto(`/login?next=${encodeURIComponent(`/orders/${order.id}`)}`);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('密碼', { exact: true }).fill(password);
  await page.getByRole('button', { name: '登入', exact: true }).click();
  await expect(page.locator('#oms-review')).toBeVisible();
  const attention = page.getByRole('region', { name: '待處理提示', exact: true });
  await expect(attention).toBeVisible();
  await attention.getByRole('button', { name: /請核對收件電話/ }).click();
  await expect(page.getByRole('textbox', { name: '收件電話', exact: true })).toBeFocused();
  expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).omsCheckedAt).toBeNull();
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
  await detail.getByRole('button', { name: '通過', exact: true }).click();
  await expect(detail.getByRole('alert')).toContainText('付款');
  expect(await db.shipment.count({ where: { orderId: order.id } })).toBe(0);
  await detail.getByRole('button', { name: '不通過', exact: true }).click();
  const rejection = page.getByRole('dialog', { name: '不通過原因', exact: true });
  await rejection.getByLabel('不通過原因', { exact: true }).selectOption('缺貨');
  await rejection.getByRole('button', { name: '確認不通過', exact: true }).click();
  await expect(rejection).toBeHidden();
  await expect(detail).toContainText('不通過原因：缺貨');
  expect(await db.statusAuditLog.count({ where: { entityType: 'oms_review_decision', entityId: order.id } })).toBe(1);
  await detail.getByRole('button', { name: '修改', exact: true }).click();
  await expect(page.getByRole('dialog', { name: new RegExp(source.order.name) })).toBeVisible();
  await expect(page).toHaveURL(/\/reviews$/);
  await page.getByRole('dialog').getByRole('button', { name: '關閉', exact: true }).click();
  await page.goto(`/orders/${order.id}`);
  await expect(page.locator('#oms-review')).toBeVisible();
  const editor = page.getByRole('dialog');
  await page.getByRole('button', { name: '修改商品', exact: true }).first().click();
  await expect(editor).toBeVisible();
  await expect(page.getByRole('link', { name: '新增 HQ 訂單', exact: true })).toHaveCount(0);
  await editor.getByLabel('數量', { exact: true }).fill('2');
  await editor.getByLabel('單價', { exact: true }).fill('80');
  await editor.getByRole('button', { name: '新增商品', exact: true }).click();
  await editor.getByRole('textbox', { name: '搜尋商品名稱或 SKU', exact: true }).fill(second.sku);
  await editor.getByRole('radio').check();
  await editor.getByRole('button', { name: '加入這張訂單', exact: true }).click();
  await editor.getByLabel('HQ 運費', { exact: true }).fill('10');
  await expect(page).toHaveURL(new RegExp(`/orders/${order.id}$`));
  expect(await db.statusAuditLog.count({ where: { entityType: 'hq_order_adjustment', entityId: order.id } })).toBe(0);
  await editor.getByRole('button', { name: '查看修改並送審', exact: true }).click();
  await expect(editor).toContainText('新總額');
  await expect(editor).toContainText('220.00');
  await editor.getByLabel('修改原因', { exact: true }).fill('CI新增商品與調整數量單價');
  await editor.getByRole('button', { name: '儲存並重新送審', exact: true }).click();
  const adjustmentAudit = () => db.statusAuditLog.findFirst({ where: { entityType: 'hq_order_adjustment', entityId: order.id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  await expect.poll(async () => JSON.parse((await adjustmentAudit())?.metadataJson ?? '{}').after?.total).toBe('220.00');
  await page.reload();
  await page.getByRole('button', { name: '修改商品', exact: true }).first().click();
  await expect(editor.getByLabel('數量', { exact: true }).first()).toHaveValue('2');
  await expect(editor.getByLabel('數量', { exact: true }).nth(1)).toHaveValue('1');
  const addedRow = editor.locator('div.space-y-2.rounded-lg.border').filter({ hasText: second.name });
  await addedRow.getByRole('button', { name: '移除商品', exact: true }).click();
  await editor.getByLabel('數量', { exact: true }).fill('3');
  await editor.getByRole('button', { name: '查看修改並送審', exact: true }).click();
  await editor.getByLabel('修改原因', { exact: true }).fill('CI移除新增商品並重新送審');
  await editor.getByRole('button', { name: '儲存並重新送審', exact: true }).click();
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
  await page.goto(`/orders/${order.id}`);
  await expect(page.locator('#oms-review')).toBeVisible();
  if (!(await page.getByRole('combobox', { name: '配送方式', exact: true }).isVisible())) {
    await page.locator('#oms-review summary').filter({ hasText: /^收件與配送/ }).click();
  }
  await expect(page.getByRole('combobox', { name: '配送方式', exact: true })).toHaveValue('home');
  await page.getByRole('button', { name: '儲存並檢查', exact: true }).click();
  await expect.poll(async () => Boolean((await db.order.findUniqueOrThrow({ where: { id: order.id } })).omsCheckedAt)).toBe(true);
  await expect(page.getByRole('button', { name: '儲存並檢查', exact: true })).toBeEnabled();
  if (!(await page.getByRole('combobox', { name: '配送方式', exact: true }).isVisible())) {
    await page.locator('#oms-review summary').filter({ hasText: /^收件與配送/ }).click();
  }
  await expect(page.getByRole('combobox', { name: '配送方式', exact: true })).toHaveValue('home');
  await page.getByRole('button', { name: '確認訂單', exact: true }).click();
  await expect.poll(async () => (await db.order.findUniqueOrThrow({ where: { id: order.id } })).omsStatus).toBe('READY');
  expect(await db.shipment.count({ where: { orderId: order.id } })).toBe(0);
  expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).shopifySnapshot).toEqual(source);
  await page.getByRole('button', { name: '新增商品', exact: true }).first().click();
  await expect(editor).toBeVisible();
  await expect(editor.getByRole('heading', { name: new RegExp('新增商品到') })).toBeVisible();
  await editor.getByRole('button', { name: '關閉', exact: true }).click();
  const history = page.locator('details').filter({ has: page.locator('summary').filter({ hasText: /^操作紀錄/ }) });
  await history.locator('summary').first().click();
  await expect(history.getByText('原因：CI移除新增商品並重新送審', { exact: true })).toBeVisible();
  await page.locator('#oms-review summary').filter({ hasText: /^更多訂單操作$/ }).click();
  const deletion = page.locator('#oms-review details').filter({ has: page.locator(':scope > summary').filter({ hasText: /^刪除訂單$/ }) });
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


for (const manualPayment of [false, true]) {
test(`${manualPayment ? 'manual payment' : 'paid'} inbox approval leaves READY and never creates a shipment`, async ({ page }, testInfo) => {
  const suffix = `quick-${testInfo.project.name}-${randomUUID()}`;
  const password = randomUUID();
  const email = `${suffix}@example.invalid`;
  await db.user.create({ data: { email, name: '一鍵審核驗收', role: 'admin', passwordHash: await bcrypt.hash(password, 10) } });
  const product = await db.product.create({ data: { productId: suffix, sku: suffix, name: suffix, category: 'toys', productCategory: 'STANDARD', status: 'active', price: 100, unit: '件', defaultTemperature: 'ambient', priceTiers: { create: { unit: '件', unitQty: 1, price: 100, sku: suffix, shopifySku: suffix, status: 'active' } } } });
  const timestamp = new Date();
  const order = await db.order.create({ data: { orderNumber: suffix, source: 'shopify', status: 'pending_review', paymentStatus: manualPayment ? 'unpaid' : 'paid', fulfillmentStatus: 'pending', subtotal: 100, total: 100, externalStore: `${suffix}.myshopify.com`, externalOrderId: suffix, omsStatus: 'NEW', shopifySourceUpdatedAt: timestamp,
    shopifySnapshot: { schemaVersion: 1, promotionCaptureVersion: 1, order: { id: suffix, name: suffix, currency: 'TWD', updated_at: timestamp.toISOString(), financial_status: manualPayment ? 'pending' : 'paid', subtotal_price: '100.00', total_price: '100.00', total_discounts: '0.00', total_shipping_price_set: { shop_money: { amount: '0.00' } }, shipping_address: { name: '測試', phone: '0900000000', address1: '隔離測試禁止寄送' }, shipping_lines: [{ title: '黑貓宅配' }], line_items: [{ title: product.name, sku: product.sku, quantity: 1, price: '100.00', requires_shipping: true }] } },
  } });
  await page.goto('/login?next=%2Freviews');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('密碼', { exact: true }).fill(password);
  await page.getByRole('button', { name: '登入', exact: true }).click();
  await page.getByRole('textbox', { name: '搜尋待審核項目', exact: true }).fill(suffix);
  await page.getByRole('complementary', { name: '待審核清單', exact: true }).getByRole('button').filter({ hasText: suffix }).click();
  if (manualPayment) {
    await page.getByRole('button', { name: '通過', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: '付款' })).toContainText('付款');
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: '已付清', exact: true }).click();
    await expect(page.getByRole('button', { name: '已付清', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: '通過', exact: true })).toBeEnabled();
    const updated = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.paymentStatus).toBe('paid');
    expect(updated.shopifySnapshot.order.financial_status).toBe('pending');
    const audit = await db.statusAuditLog.findFirst({ where: { entityType: 'hq_order_adjustment', entityId: order.id } });
    expect(JSON.parse(audit.metadataJson).after.financialStatus).toBe('paid');
    expect(audit.actorId).toBeTruthy();
  }
  await page.getByRole('button', { name: '通過', exact: true }).click();
  await expect.poll(async () => (await db.order.findUniqueOrThrow({ where: { id: order.id } })).omsStatus).toBe('READY');
  expect(await db.shipment.count({ where: { orderId: order.id } })).toBe(0);
  await page.reload();
  await page.getByRole('textbox', { name: '搜尋待審核項目', exact: true }).fill(suffix);
  await expect(page.getByText('沒有符合條件的待審核項目。', { exact: true })).toBeVisible();
  expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('confirmed');
});

}

test('standalone scent displays the same stock pool as its chicken bundle', async ({ page }, testInfo) => {
  const suffix = `wax-${testInfo.project.name}-${randomUUID()}`;
  const password = randomUUID();
  const email = `${suffix}@example.invalid`;
  const actor = await db.user.create({ data: { email, name: '共用香氣庫存隔離驗收', role: 'admin', passwordHash: await bcrypt.hash(password, 10) } });
  const make = (kind, price, cost) => db.product.create({ data: {
    productId: `${suffix}-${kind}`, sku: `${suffix}-${kind}`, name: `${suffix}-${kind}`,
    category: 'other', productCategory: 'STANDARD', status: 'active', price, cost, unit: '顆',
  } });
  const combo = await make('combo',399,230);
  const solo = await make('solo',250,190);
  const source = await db.productPriceTier.create({ data: { productId: combo.id, unit: '組', unitQty: 1, price:399, cost:230,
    variantName:'牡丹', variantKey:'peony', inventoryPolicy:'variant', inventoryUnit:'顆', inventoryEnabledAt:new Date(), } });
  const alias = await db.productPriceTier.create({ data: { productId: solo.id, unit: '顆', unitQty: 1, price:250, cost:190,
    variantName:'牡丹', variantKey:'peony', inventoryPolicy:'variant', inventoryUnit:'顆', inventoryEnabledAt:new Date(), inventorySourceTierId:source.id, } });
  const warehouse = await db.warehouse.upsert({ where: { code:'WH-MAIN' }, update:{}, create:{code:'WH-MAIN',name:'隔離主倉'} });
  await db.productVariantInventoryBalance.create({ data: { tierId:source.id,warehouseId:warehouse.id,quantity:20,unit:'顆' } });
  await page.goto(`/login?next=${encodeURIComponent(`/products/${solo.id}`)}`);
  await page.getByLabel('Email', { exact:true }).fill(email);
  await page.getByLabel('密碼', { exact:true }).fill(password);
  await page.getByRole('button', {name:'登入',exact:true}).click();
  const stock = page.getByRole('row').filter({hasText:'牡丹'}).filter({hasText:'20 顆'});
  await expect(stock).toContainText(`共用 ${combo.name}`);
  await db.productVariantInventoryBalance.update({where:{tierId_warehouseId:{tierId:source.id,warehouseId:warehouse.id}},data:{quantity:19}});
  await page.reload();
  await expect(page.getByRole('row').filter({hasText:'牡丹'}).filter({hasText:'19 顆'})).toBeVisible();
  expect(await db.productVariantInventoryBalance.count({where:{tierId:alias.id}})).toBe(0);
  await page.goto(`/products/${combo.id}`);
  await expect(page.getByRole('row').filter({hasText:'牡丹'}).filter({hasText:'19 顆'})).toBeVisible();
  // Disposable CI fixtures only; the shared pool is intentionally not duplicated.
  expect(actor.role).toBe('admin');
});
