import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

const ciDatabase = 'postgresql://ci:ci@127.0.0.1:5432/ci';
if (process.env.CI !== 'true' || process.env.DATABASE_URL !== ciDatabase || process.env.DIRECT_URL !== ciDatabase) {
  throw new Error('Booking acceptance requires the disposable CI database.');
}
const db = new PrismaClient();
test.afterAll(async () => { await db.$disconnect(); });

test('Cynthia calendar submits both Taiwan times and shows the request in HQ', async ({ page, isMobile }) => {
  const suffix = randomUUID();
  const email = 'booking-' + suffix + '@example.invalid';
  const lineId = 'booking-' + suffix;
  const password = randomUUID();
  await db.user.create({ data: { email, name: '隔離驗收人員', role: 'admin', passwordHash: await bcrypt.hash(password, 10) } });

  if (isMobile) await page.setViewportSize({ width: 390, height: 500 });
  await page.goto('/book/cynthia');
  const currentStep = page.getByRole('list', { name: '預約進度' }).locator('[aria-current=step]');
  await expect(currentStep).toHaveText('選服務');
  await page.getByRole('radio', { name: '非即時圖文' }).check();
  await expect(page.getByText('第 1 步／共 4 步 · 選服務')).toBeVisible();
  await page.getByRole('radio', { name: '即時線上' }).check();
  await expect(page.getByText('第 1 步／共 5 步 · 選服務')).toBeVisible();
  await page.getByRole('button', { name: '選擇時段', exact: true }).click();
  await page.getByRole('button', { name: '下個月', exact: true }).click();
  await expect(page.getByLabel('開始時間（台灣時間）')).toHaveCount(0);
  const day = page.getByRole('button', { name: /^\d{4}-\d{2}-01$/ });
  const date = await day.getAttribute('aria-label');
  if (isMobile) await expect(page.getByRole('button', { name: /^\d{4}-\d{2}-(28|29|30|31)$/ }).last()).toBeInViewport();
  await day.click();
  await expect(day).toHaveCount(0);
  await expect(page.getByRole('option', { name: '14:15', exact: true })).toHaveCount(0);
  await page.getByLabel('開始時間（台灣時間）').selectOption('14:00');
  await page.getByRole('button', { name: '記下首選', exact: true }).click();
  await expect(currentStep).toHaveText('選備用');
  await expect(page.getByRole('status', { name: '已記下 1 組，共 2 組' })).toBeVisible();
  await expect(page.getByText('首選排不開時', { exact: false })).toBeInViewport();
  await page.getByRole('button', { name: date, exact: true }).click();
  await page.getByLabel('開始時間（台灣時間）').selectOption('14:00');
  await page.getByRole('button', { name: '記下備用', exact: true }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('兩組不同');
  await page.getByLabel('開始時間（台灣時間）').selectOption('16:30');
  await page.getByRole('button', { name: '記下備用', exact: true }).click();
  await expect(page.getByRole('status', { name: '已記下 2 組，共 2 組' })).toBeVisible();
  await expect(page.getByText('如需改期', { exact: false })).toContainText('14 天');
  await page.getByLabel('聯絡人姓名').fill('隔離送單');
  await page.getByLabel('LINE ID').fill(lineId);
  await page.getByRole('button', { name: '確認預約資料' }).click();
  await expect(page.getByText('第 5 步／共 5 步 · 加入購物袋')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: '已收到預約申請' })).toBeVisible();
  const tasks = await db.task.findMany({ where: { taskId: { startsWith: 'BOOK-CYN-' }, description: { contains: lineId } } });
  expect(tasks).toHaveLength(1);
  expect(tasks[0].status).toBe('todo');
  expect(tasks[0].title).toContain('待付款');
  const cartUrl = 'https://furmosa.com/cart/add';
  // Capture the real form submission without navigating to the live storefront in CI.
  await page.route(cartUrl, route => route.abort('aborted'));
  const cartRequest = page.waitForRequest(request => request.url() === cartUrl && request.method() === 'POST');
  await page.getByRole('button', { name: '加入購物袋', exact: true }).click();
  const fields = new URLSearchParams((await cartRequest).postData());
  expect(fields.get('id')).toBe('65121055637881');
  expect(fields.get('quantity')).toBe('1');
  expect(fields.get('return_to')).toBe('/cart');
  expect(fields.get('properties[預約編號]')).toBe(tasks[0].taskId);
  expect(fields.get('properties[首選時段]')).toBe(date + ' 14:00');
  expect(fields.get('properties[備用時段]')).toBe(date + ' 16:30');
  expect(fields.get('properties[預約狀態]')).toBe('待付款，時段待確認');
  expect(fields.has('lineId')).toBe(false);
  expect(fields.has('name')).toBe(false);
  expect(tasks[0].description).toContain(date + 'T14:00');
  expect(tasks[0].description).toContain(date + 'T16:30');

  await page.goto('/login?next=%2Ftasks');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('密碼', { exact: true }).fill(password);
  await page.getByRole('button', { name: '登入', exact: true }).click();
  await expect(page.getByRole('article').filter({ hasText: tasks[0].taskId })).toContainText(lineId);
});
