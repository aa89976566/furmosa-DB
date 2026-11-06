import { test, expect } from '@playwright/test';
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
  await db.product.create({ data: {
    productId: `CI-RESTOCK-${suffix}`, sku: `CI-RESTOCK-${suffix}`, name: `CI叫貨-${suffix}`,
    category: 'treats', productCategory: 'STANDARD', status: 'active', price: 165,
    unit: '包', consignmentEnabled: true,
    priceTiers: { create: [
      { weightGrams: 30, unit: 'g', price: 165 },
      { weightGrams: 50, unit: 'g', price: 220 },
    ] },
  }});
});
test.afterAll(async () => { await db.$disconnect(); });

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
  const variant = page.getByRole('combobox', { name: new RegExp(`^CI叫貨-${test.info().project.name}-.* 規格$`) });
  await variant.selectOption({ label: '30g' });
  await page.getByRole('button', { name: new RegExp(`^CI叫貨-${test.info().project.name}-.* 增加$`) }).click();
  await page.getByRole('button', { name: '確認寄賣叫貨', exact: true }).click();
  await expect(page.getByRole('button', { name: '送出寄賣叫貨單', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '← 返回修改數量', exact: true }).click();
  await expect(variant).toHaveValue(/.+/);
  await page.getByRole('button', { name: new RegExp(`^CI叫貨-${test.info().project.name}-.* 減少$`) }).click();
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
