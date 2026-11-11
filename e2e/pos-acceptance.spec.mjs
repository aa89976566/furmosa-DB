import { test, expect, chromium } from '@playwright/test';
import { runAuthenticatedMonitor, checkPosSearch } from '../scripts/authenticated-production-monitor.mjs';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

// This suite must never accept a production or preview database/origin.
const allowedDatabase = 'postgresql://ci:ci@127.0.0.1:5432/ci';
if (process.env.CI !== 'true' || process.env.DATABASE_URL !== allowedDatabase || process.env.DIRECT_URL !== allowedDatabase) {
  throw new Error('POS browser acceptance requires the disposable CI database.');
}
const db = new PrismaClient();
let merchantId;
let productId;
let username;
let password;
let hqEmail;
let hqPassword;
let merchantCode;
let merchantName;
let restockProductName;

test.beforeAll(async ({}, testInfo) => {
  const suffix = `${testInfo.project.name}-${randomUUID()}`;
  username = `ci-pos-${suffix}`;
  password = randomUUID(); // Synthetic, ephemeral credential; never a real account.
  hqEmail = `ci-hq-${suffix}@example.invalid`;
  hqPassword = randomUUID();
  await db.user.create({ data: {
    email: hqEmail, name: 'CI隔離HQ管理員', role: 'admin',
    passwordHash: await bcrypt.hash(hqPassword, 10),
  }});
  merchantCode = `CI-${suffix}`;
  merchantName = `CI隔離測試店-${suffix}`;
  const merchant = await db.merchant.create({ data: {
    merchantId: merchantCode, name: merchantName, commissionRate: 0.2,
  }});
  merchantId = merchant.id;
  await db.merchantUser.create({ data: {
    merchantId, username, passwordHash: await bcrypt.hash(password, 10), isActive: true,
  }});
  const product = await db.product.create({ data: {
    productId: `CI-${suffix}`, sku: `CI-${suffix}`, name: 'CI測試雞霸',
    category: 'treats', productCategory: 'STANDARD', price: 165, unit: '包',
  }});
  productId = product.id;
  await db.merchantProductRule.create({ data: {
    merchantId, productId, suggestedPrice: 165, commissionMode: 'amount', commissionValue: 33,
  }});
  await db.merchantStock.create({ data: { merchantId, productId, tierId: '', quantity: 7 } });
  restockProductName = `CI叫貨-${suffix}`;
  await db.product.create({ data: {
    productId: `CI-RESTOCK-${suffix}`, sku: `CI-RESTOCK-${suffix}`, name: restockProductName,
    category: 'treats', productCategory: 'STANDARD', status: 'active', price: 165,
    unit: '包', consignmentEnabled: true,
    priceTiers: { create: [
      { weightGrams: 30, unit: 'g', price: 165 },
      { weightGrams: 50, unit: 'g', price: 220 },
    ] },
  }});
});
test.afterAll(async () => { await db.$disconnect(); });

test('historical receipt review closes without stock writes and a genuinely new receipt posts once', async ({ page, browser }) => {
  test.setTimeout(180_000);
  const key = randomUUID();
  const p = await db.product.create({ data: { productId: `CI-RV-${key}`, sku: `CI-RV-${key}`, name: 'CI舊單盤點商品', price: 99, unit: '包' } });
  const stock = await db.merchantStock.create({ data: { merchantId, productId: p.id, tierId: '', quantity: 2, lastCountAt: new Date('2026-06-01') } });
  const makeShipment = shippedAt => db.shipment.create({ data: {
    shipmentNumber: `CI-RV-${randomUUID()}`, merchantId, type: 'merchant_restock', status: 'shipped',
    createdAt: shippedAt, shippedAt,
    items: { create: { productId: p.id, productName: p.name, sku: p.sku, quantity: 2, unit: '包' } },
  } });
  const old = await makeShipment(new Date('2026-05-01'));
  await page.goto('/pos/login');
  await page.getByLabel('帳號', { exact: true }).fill(username);
  await page.getByLabel('密碼', { exact: true }).fill(password);
  await page.getByRole('button', { name: '登入', exact: true }).click();
  await expect(page.getByRole('heading', { name: '店內商品', exact: true })).toBeVisible();
  await page.goto(`/pos/shipments/${old.id}`);
  await expect(page.getByRole('alert').filter({ hasText: 'HQ 核對' })).toBeVisible();
  await expect(page.getByRole('button', { name: '收到這批貨，確認入庫' })).toHaveCount(0);
  await page.goto('/pos/notifications');
  await expect(page.getByText('舊單請由 HQ 核對', { exact: true })).toBeVisible();
  const hqContext = await browser.newContext({ viewport: page.viewportSize() });
  try {
    const hq = await hqContext.newPage();
    await hq.goto('http://localhost:3000/login');
    await hq.getByLabel('Email', { exact: true }).fill(hqEmail);
    await hq.getByLabel('密碼', { exact: true }).fill(hqPassword);
    await hq.getByRole('button', { name: '登入', exact: true }).click();
    await expect(hq.getByRole('heading', { name: '營運首頁', exact: true })).toBeVisible();
    await hq.goto(`http://localhost:3000/shipments/${old.id}`);
    await hq.getByRole('checkbox', { name: '已確認本批貨已包含於現有庫存或後續盤點，不再新增數量' }).check();
    await hq.getByLabel('核對說明', { exact: true }).fill('CI確認已納入現場盤點');
    await hq.getByRole('button', { name: '確認舊單已核對，結案不加庫存', exact: true }).click();
    await expect.poll(async () => (await db.shipment.findUniqueOrThrow({ where: { id: old.id } })).status).toBe('received');
    expect((await db.merchantStock.findUniqueOrThrow({ where: { id: stock.id } })).quantity).toBe(2);
    expect(await db.merchantStockTxn.count({ where: { merchantId, productId: p.id } })).toBe(0);
    const audit = await db.statusAuditLog.findFirstOrThrow({ where: { entityId: old.id, newStatus: 'received' } });
    expect(JSON.parse(audit.metadataJson).inventoryPosted).toBe(false);
  } finally { await hqContext.close(); }
  const fresh = await makeShipment(new Date('2026-07-01'));
  await page.goto(`/pos/shipments/${fresh.id}`);
  await page.locator('label').filter({ hasText: p.name }).click();
  await expect(page.getByRole('checkbox')).toBeChecked();
  await page.getByRole('button', { name: '收到這批貨，確認入庫', exact: true }).click();
  await expect.poll(async () => (await db.shipment.findUniqueOrThrow({ where: { id: fresh.id } })).status).toBe('received');
  await page.goto(`/pos/shipments/${fresh.id}?receipt=just_received`);
  await expect(page.getByRole('status')).toContainText('商品已加入店內庫存');
  expect((await db.merchantStock.findUniqueOrThrow({ where: { id: stock.id } })).quantity).toBe(4);
  await page.reload();
  await expect(page.getByRole('button', { name: '收到這批貨，確認入庫' })).toHaveCount(0);
  expect(await db.merchantStockTxn.count({ where: { merchantId, productId: p.id, type: 'restock' } })).toBe(1);
});

test('production monitor request boundary works against the isolated application', async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Runner already checks HQ desktop and POS mobile in separate contexts.');
  test.setTimeout(240_000);
  const beforeSales = await db.merchantStockTxn.count({ where: { merchantId, type: 'sale' } });
  const beforeRequests = await db.restockRequest.count({ where: { merchantId } });
  const report = await runAuthenticatedMonitor({ chromium, origin: 'http://localhost:3000', credentials: {
    hqUser: hqEmail, hqPassword, posUser: username, posPassword: password,
  }});
  expect(report.ok, JSON.stringify(report)).toBe(true);
  expect(await db.merchantStockTxn.count({ where: { merchantId, type: 'sale' } })).toBe(beforeSales);
  expect(await db.restockRequest.count({ where: { merchantId } })).toBe(beforeRequests);
});

test('HQ login reaches data workspaces without a rendered error or unavailable counts', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(hqEmail);
  await page.getByLabel('密碼', { exact: true }).fill(hqPassword);
  await page.getByRole('button', { name: '登入', exact: true }).click();
  await expect(page.getByRole('heading', { name: '營運首頁', exact: true })).toBeVisible();
  // A successful HTTP response alone does not prove streamed page content loaded.
  for (const [path, heading] of [
    ['/orders', '訂單'], ['/reviews', '待審核'], ['/products', '產品管理'],
    ['/inventory', '庫存總覽'], ['/restock-requests', '補貨申請'],
  ]) {
    await test.step(path, async () => {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
      if (path === '/orders') {
        const stages = page.getByRole('navigation', { name: '訂單工作階段' });
        await expect(stages.getByRole('link', { name: /^全部訂單\s*\d+/ })).toBeVisible();
        await expect(stages.getByText('訂單統計暫時無法取得', { exact: false })).toHaveCount(0);
      }
      if (path === '/products') await expect(page.getByRole('link', { name: 'CI測試雞霸', exact: true }).first()).toBeVisible();
      if (path === '/restock-requests') await expect(page.getByText('目前沒有符合條件的申請', { exact: true })).toBeVisible();
      await expect(page.getByText('Application error', { exact: false })).toHaveCount(0);
    });
  }
});

test('merchant service pages expose usable controls without creating business records', async ({ page }) => {
  test.setTimeout(180_000);
  const beforeSales = await db.merchantStockTxn.count({ where: { merchantId, type: 'sale' } });
  const beforeRequests = await db.restockRequest.count({ where: { merchantId } });
  await page.goto('/pos/login');
  await page.getByLabel('帳號', { exact: true }).fill(username);
  await page.getByLabel('密碼', { exact: true }).fill(password);
  await page.getByRole('button', { name: '登入', exact: true }).click();
  await expect(page.getByRole('heading', { name: '店內商品', exact: true })).toBeVisible();
  for (const [path, heading] of [
    ['/pos/stock', '庫存'], ['/pos/refill', '換罐計畫'],
    ['/pos/coupons', '美容券核銷'], ['/pos/settle', '對帳'],
  ]) {
    await test.step(path, async () => {
      await page.goto(path);
      if (path === '/pos/coupons') {
        await expect(page.getByRole('heading', { name: '尚未開通美容券核銷', exact: true })).toBeVisible();
        // Bind only this synthetic CI merchant; never bypass store resolution.
        await db.store.create({ data: {
          slug: merchantCode.trim().toLowerCase().replace(/-/g, '_'),
          name: merchantName, secretToken: randomUUID(),
        }});
        await page.reload();
      }
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
      if (path === '/pos/stock') await expect(page.getByRole('button', { name: /CI測試雞霸/ })).toBeVisible();
      if (path === '/pos/coupons') await expect(page.getByRole('button', { name: '核對折價券', exact: true })).toBeDisabled();
      if (path === '/pos/settle') {
        await page.getByRole('button', { name: '交易流水', exact: true }).click();
        await expect(page.getByText('查看流水、換罐收款與優惠券補貼明細', { exact: true })).toBeVisible();
      }
    });
  }
  await page.goto('/pos/restock');
  await expect(page.getByRole('heading', { name: '寄賣叫貨', exact: true })).toBeVisible();
  // RestockPicker uses a plain list layout; target its uniquely named controls.
  const variant = page.getByRole('combobox', { name: `${restockProductName} 規格`, exact: true });
  await variant.selectOption({ label: '30g' });
  await page.getByRole('button', { name: `${restockProductName} 增加`, exact: true }).click();
  await page.getByRole('button', { name: '確認寄賣叫貨', exact: true }).click();
  await expect(page.getByRole('button', { name: '送出寄賣叫貨單', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '← 返回修改數量', exact: true }).click();
  await expect(variant).toHaveValue(/.+/);
  await page.getByRole('button', { name: `${restockProductName} 減少`, exact: true }).click();
  await expect(page.getByRole('button', { name: '確認寄賣叫貨', exact: true })).toBeDisabled();
  expect(await db.merchantStockTxn.count({ where: { merchantId, type: 'sale' } })).toBe(beforeSales);
  expect(await db.restockRequest.count({ where: { merchantId } })).toBe(beforeRequests);
});

test('merchant can review, return, complete one sale and find/export its record', async ({ page }) => {
  await page.goto('/pos/login');
  await page.getByLabel('帳號', { exact: true }).fill(username);
  await page.getByLabel('密碼', { exact: true }).fill(password);
  await page.getByRole('button', { name: '登入', exact: true }).click();
  await expect(page.getByRole('heading', { name: '店內商品', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^加入 CI測試雞霸/ }).click();
  // Mobile uses a bottom-sheet ticket; desktop displays the ticket directly.
  const mobileTicket = page.getByRole('button', { name: /合計 1 件/ });
  if (await mobileTicket.isVisible()) await mobileTicket.click();
  await page.getByRole('button', { name: '結帳', exact: true }).click();
  await expect(page.getByRole('button', { name: '確認完成', exact: true })).toBeVisible();
  expect(await db.merchantStockTxn.count({ where: { merchantId, type: 'sale' } })).toBe(0);
  await page.getByRole('button', { name: '返回本單', exact: true }).click();
  await expect(page.getByRole('button', { name: '結帳', exact: true })).toBeEnabled();
  await expect(page.getByText('CI測試雞霸', { exact: true }).last()).toBeVisible();
  await page.getByRole('button', { name: '結帳', exact: true }).click();
  await page.getByRole('button', { name: '確認完成', exact: true }).click();
  await expect(page.getByText('已收款', { exact: true }).filter({ visible: true })).toBeVisible();
  const sales = await db.merchantStockTxn.findMany({ where: { merchantId, type: 'sale' } });
  expect(sales).toHaveLength(1);
  expect(sales[0]).toMatchObject({ productId, quantity: -1, unitPrice: 165, commissionAmount: 33, companyRevenue: 132 });
  const stock = await db.merchantStock.findUnique({ where: { merchantId_productId_tierId: { merchantId, productId, tierId: '' } } });
  expect(stock.quantity).toBe(6);
  await page.goto('/pos/records');
  await expect(page.getByRole('heading', { name: '紀錄', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '篩選紀錄', exact: true }).click();
  await page.getByRole('combobox', { name: '紀錄分類', exact: true }).selectOption('sale');
  await expect(page.getByRole('region', { name: '紀錄清單' })).toContainText('CI測試雞霸');
  await page.getByRole('textbox', { name: '搜尋紀錄', exact: true }).fill('不存在的測試品項');
  await expect(page.getByText('沒有符合的資料。', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '清除篩選', exact: true }).click();
  await expect(page.getByRole('region', { name: '紀錄清單' })).toContainText('CI測試雞霸');
  const downloadWait = page.waitForEvent('download');
  await page.getByRole('button', { name: '匯出', exact: true }).click();
  const download = await downloadWait;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const csv = Buffer.concat(chunks).toString('utf8');
  expect(csv).toContain('CI測試雞霸');
  expect(csv).toContain('銷售');
  expect(csv.trim().split('\n')).toHaveLength(2);
});


test('empty merchant catalog remains a failure with a precise code', async ({ page }) => {
  const suffix = randomUUID();
  const emptyMerchant = await db.merchant.create({ data: { merchantId: `CI-EMPTY-${suffix}`, name: 'CI空商品店', commissionRate: 0.2 } });
  const emptyUser = `ci-empty-${suffix}`;
  const emptyPassword = randomUUID();
  await db.merchantUser.create({ data: { merchantId: emptyMerchant.id, username: emptyUser, passwordHash: await bcrypt.hash(emptyPassword, 10), isActive: true } });
  await page.goto('/pos/login');
  await page.getByLabel('帳號', { exact: true }).fill(emptyUser);
  await page.getByLabel('密碼', { exact: true }).fill(emptyPassword);
  await page.getByRole('button', { name: '登入', exact: true }).click();
  await expect(page.getByRole('heading', { name: '店內商品', exact: true })).toBeVisible();
  await expect(page.getByText('這間店還沒有可結帳的寄賣商品。', { exact: true })).toBeVisible();
  await expect(checkPosSearch(page)).rejects.toThrow('POS_CATALOG_EMPTY');
});


for (const orderMode of ['legacy', 'shopify-oms']) {
test(`HQ ${orderMode} dispatch updates its row and stage counts without a manual reload`, async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const suffix = randomUUID();
  const wh = await db.warehouse.upsert({ where: { code: 'WH-MAIN' }, update: {}, create: { code: 'WH-MAIN', name: 'CI HQ' } });
  const product = await db.product.create({ data: {
    productId: suffix, sku: suffix, name: 'CI dispatch count fixture', category: 'freeze_dried', unit: 'g', price: 100, defaultTemperature: 'ambient',
    priceTiers: { create: { weightGrams: 30, unit: 'g', unitQty: 1, price: 100, status: 'active', sku: suffix, shopifySku: suffix } },
    inventoryBalances: { create: { warehouseId: wh.id, quantity: 100, unit: 'g', lastCountedAt: new Date() } },
  }, include: { priceTiers: true } });
  const orderNumber = `CI-DISPATCH-${suffix}`;
  const actor = await db.user.findUniqueOrThrow({ where: { email: hqEmail } });
  const sourceDate = new Date();
  const omsEvidence = orderMode === 'shopify-oms' ? {
    source: 'shopify', externalStore: `${suffix}.myshopify.com`, externalOrderId: BigInt(`0x${suffix.replace(/-/g, '')}`).toString(),
    externalOrderName: orderNumber, omsStatus: 'FULFILLMENT_PENDING', omsIssueFlags: [],
    omsCheckedAt: sourceDate, omsCheckedSourceUpdatedAt: sourceDate, shopifySourceUpdatedAt: sourceDate,
    omsReviewedAt: sourceDate, omsReviewedById: actor.id, shippingMethod: 'home',
    shopifySnapshot: { schemaVersion: 1, order: {
      id: BigInt(`0x${suffix.replace(/-/g, '')}`).toString(), name: orderNumber, currency: 'TWD',
      created_at: sourceDate.toISOString(), updated_at: sourceDate.toISOString(), financial_status: 'paid',
      subtotal_price: '100.00', total_discounts: '0.00', total_price: '100.00',
      total_shipping_price_set: { shop_money: { amount: '0.00' } },
      line_items: [{ sku: suffix, title: product.name, quantity: 1, price: '100.00', requires_shipping: true }],
      shipping_address: { name: 'CI dispatch recipient', phone: '0900000000', address1: 'CI isolated address' },
      shipping_lines: [{ title: '宅配', code: 'HOME' }], note_attributes: [],
    } },
  } : { source: 'manual' };
  const order = await db.order.create({ data: { orderNumber, ...omsEvidence, status: 'confirmed', paymentStatus: 'paid', subtotal: 100, total: 100 } });
  const shipment = await db.shipment.create({ data: {
    shipmentNumber: `CI-SHIP-${suffix}`, type: 'customer_order', status: 'pending', orderId: order.id,
    recipientName: 'CI dispatch recipient', recipientPhone: '0900000000', recipientAddress: 'CI isolated address', carrier: '黑貓',
    items: { create: { productId: product.id, productName: product.name, sku: product.sku, quantity: 1, weightGrams: 30, unit: 'g', variantKey: product.priceTiers[0].id } },
  }});
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(hqEmail);
  await page.getByLabel('密碼', { exact: true }).fill(hqPassword);
  await page.getByRole('button', { name: '登入', exact: true }).click();
  await expect(page.getByRole('heading', { name: '營運首頁', exact: true })).toBeVisible();
  await page.goto('/shipments?status=pending&type=customer_order');
  const stages = page.getByRole('navigation', { name: '出貨階段', exact: true });
  const pending = stages.getByRole('link', { name: /^待出貨/ }).locator('span').last();
  const shippedLink = stages.getByRole('link', { name: /^已寄出／待確認到貨/ });
  const shipped = shippedLink.locator('span').last();
  await expect(pending).toHaveText(/^\d+$/);
  const pendingBefore = Number(await pending.innerText());
  const shippedBefore = Number(await shipped.innerText());
  const row = testInfo.project.name === 'mobile'
    ? page.locator('.md\\:hidden').locator('div.cursor-pointer').filter({ hasText: orderNumber })
    : page.getByRole('row').filter({ hasText: orderNumber });
  await expect(row).toBeVisible();
  const statusApi = `**/api/shipments/${shipment.id}/status`;
  if (orderMode === 'shopify-oms') {
    // Real deferred database gate: an actionable status alone cannot prove review.
    await db.order.update({ where: { id: order.id }, data: { omsReviewedAt: null } });
  } else {
    await page.route(statusApi, route => route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'CI 審核阻擋測試' }) }));
  }
  await row.getByRole('button', { name: '已寄出', exact: true }).click();
  await expect(row.getByRole('alert')).toContainText(orderMode === 'shopify-oms' ? 'OMS 人工審核' : 'CI 審核阻擋測試');
  await expect(pending).toHaveText(String(pendingBefore));
  expect((await db.shipment.findUniqueOrThrow({ where: { id: shipment.id } })).status).toBe('pending');
  expect(await db.inventoryTransaction.count({ where: { reference: `shipment:${shipment.id}`, type: 'sales_out' } })).toBe(0);
  if (orderMode === 'shopify-oms') {
    await page.goto(`/orders/${order.id}`);
    await page.getByRole('button', { name: '重新檢查出貨內容', exact: true }).click();
    await expect(page.getByText('檢查通過，可以確認訂單', { exact: true }).filter({ visible: true }).last()).toBeVisible();
    await page.getByRole('button', { name: '確認既有出貨單', exact: true }).click();
    await expect.poll(async () => Boolean((await db.order.findUniqueOrThrow({ where: { id: order.id } })).omsReviewedAt)).toBe(true);
    const reviewed = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(reviewed.omsReviewedAt).not.toBeNull();
    expect(reviewed.omsReviewedById).toBe(actor.id);
    expect(reviewed.omsStatus).toBe('FULFILLMENT_PENDING');
    expect(await db.shipment.count({ where: { orderId: order.id } })).toBe(1);
    expect(await db.inventoryTransaction.count({ where: { reference: `shipment:${shipment.id}`, type: 'sales_out' } })).toBe(0);
    await page.goto('/shipments?status=pending&type=customer_order');
  } else {
    await page.unroute(statusApi);
  }
  const savedResponse = page.waitForResponse(response => response.url().endsWith(`/api/shipments/${shipment.id}/status`) && response.request().method() === 'POST');
  await row.getByRole('button', { name: '已寄出', exact: true }).click();
  expect((await savedResponse).status()).toBe(200);
  // These assertions retry across the server refresh; never reload to hide a stale-count bug.
  await expect(pending).toHaveText(String(pendingBefore - 1));
  await expect(shipped).toHaveText(String(shippedBefore + 1));
  await expect(row).toHaveCount(0);
  expect((await db.shipment.findUniqueOrThrow({ where: { id: shipment.id } })).status).toBe('shipped');
  expect(await db.inventoryTransaction.count({ where: { reference: `shipment:${shipment.id}`, type: 'sales_out' } })).toBe(1);
  await shippedLink.click();
  await expect(page.getByText(orderNumber, { exact: true }).filter({ visible: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(orderNumber, { exact: true }).filter({ visible: true })).toBeVisible();
  expect(await db.inventoryTransaction.count({ where: { reference: `shipment:${shipment.id}`, type: 'sales_out' } })).toBe(1);
});
}


test('HQ scent inventory renders separate balances and immutable reversals on desktop and mobile', async ({ page }) => {
  test.setTimeout(180_000);
  const key=randomUUID();
  const wh=await db.warehouse.upsert({ where:{code:'WH-MAIN'}, update:{}, create:{code:'WH-MAIN',name:'CI主倉'} });
  const product=await db.product.create({data:{
    productId:'CI-WAX-'+key,sku:'CI-WAX-'+key,name:'CI四款香氣 '+key,
    category:'other',productCategory:'STANDARD',status:'draft',unit:'組',price:399,cost:230,
    priceTiers:{create:['牡丹','杜桑','經典迪奧','琥珀與薰衣草'].map((variantName,i)=>({
      variantName,unit:'組',unitQty:1,price:399,cost:230,status:'active',
      inventoryPolicy:'variant',inventoryUnit:'顆',inventoryEnabledAt:new Date(Date.now()-60000),
      variantBalances:{create:{warehouseId:wh.id,quantity:20,unit:'顆'}},
      variantTransactions:{create:{id:randomUUID(),eventKey:'CI-WAX-'+key+'-'+i,
        warehouseId:wh.id,quantity:20,unit:'顆',type:'opening',reference:'CI opening '+key,sourceSnapshot:{quantity:20}}},
    }))},
  },include:{priceTiers:true}});
  await page.goto('/login');
  await page.getByLabel('Email',{exact:true}).fill(hqEmail);
  await page.getByLabel('密碼',{exact:true}).fill(hqPassword);
  await page.getByRole('button',{name:'登入',exact:true}).click();
  await expect(page.getByRole('heading',{name:'營運首頁',exact:true})).toBeVisible();
  await page.goto('/products/'+product.id);
  await expect(page.getByRole('heading',{name:product.name,exact:true})).toBeVisible();
  const balanceRow=name=>page.getByRole('row').filter({has:page.getByRole('cell',{name,exact:true})}).filter({has:page.getByRole('cell',{name:'20 顆',exact:true})});
  for(const name of ['牡丹','杜桑','經典迪奧','琥珀與薰衣草']) await expect(balanceRow(name)).toHaveCount(1);
  const peony=product.priceTiers.find(t=>t.variantName==='牡丹');
  const shipment=await db.shipment.create({data:{
    shipmentNumber:'CI-WAX-S-'+key,type:'customer_order',status:'shipped',hqInventoryEligible:true,
    items:{create:{productId:product.id,productName:product.name,sku:product.sku,quantity:1,unit:'組',variantKey:peony.id}},
  }});
  await page.reload();
  await expect(page.getByRole('row').filter({has:page.getByRole('cell',{name:'牡丹',exact:true})}).filter({has:page.getByRole('cell',{name:'19 顆',exact:true})})).toHaveCount(1);
  for(const name of ['杜桑','經典迪奧','琥珀與薰衣草']) await expect(balanceRow(name)).toHaveCount(1);
  await db.shipment.update({where:{id:shipment.id},data:{status:'cancelled'}});
  await page.reload();
  await expect(balanceRow('牡丹')).toHaveCount(1);
  await page.getByText('規格庫存異動紀錄',{exact:true}).click();
  await expect(page.getByRole('cell',{name:'出貨扣帳',exact:true})).toBeVisible();
  await expect(page.getByRole('cell',{name:'取消／退貨回補',exact:true})).toBeVisible();
  expect(await db.productVariantInventoryTransaction.count({where:{tierId:peony.id,type:'return_in'}})).toBe(1);
  expect(await db.inventoryBalance.count({where:{productId:product.id}})).toBe(0);
  await page.goto('/inventory?q='+encodeURIComponent(product.name));
  const overview=page.getByRole('table',{name:'香氣庫存總覽',exact:true});
  await expect(overview).toBeVisible();
  for(const name of ['牡丹','杜桑','經典迪奧','琥珀與薰衣草']) await expect(overview.getByRole('row').filter({has:page.getByRole('cell',{name,exact:true})}).getByRole('cell',{name:'20 顆',exact:true})).toBeVisible();
  await expect(overview.getByRole('button')).toHaveCount(0);
  await page.goto('/products?q='+encodeURIComponent(product.name));
  await expect(page.getByText(/牡丹 20 顆/)).toBeVisible();
});
