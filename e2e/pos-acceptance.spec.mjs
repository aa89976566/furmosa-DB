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

test.beforeAll(async ({}, testInfo) => {
  const suffix = `${testInfo.project.name}-${randomUUID()}`;
  username = `ci-pos-${suffix}`;
  password = randomUUID(); // Synthetic, ephemeral credential; never a real account.
  const merchant = await db.merchant.create({ data: {
    merchantId: `CI-${suffix}`, name: 'CI隔離測試店', commissionRate: 0.2,
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
});
test.afterAll(async () => { await db.$disconnect(); });

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
