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
  await page.getByRole('button', { name: '選擇時段', exact: true }).click();
  await page.getByRole('button', { name: '下個月', exact: true }).click();
  await expect(page.getByLabel('開始時間（台灣時間）')).toHaveCount(0);
  const day = page.getByRole('button', { name: /^\d{4}-\d{2}-01$/ });
  const date = await day.getAttribute('aria-label');
  if (isMobile) await expect(page.getByRole('button', { name: /^\d{4}-\d{2}-(28|29|30|31)$/ }).last()).toBeInViewport();
  await day.click();
  await expect(day).toHaveCount(0);
  await page.getByLabel('開始時間（台灣時間）').fill('14:00');
  await page.getByRole('button', { name: '記下首選', exact: true }).click();
  await expect(page.getByRole('status', { name: '已記下 1 組，共 2 組' })).toBeVisible();
  await expect(page.getByText('首選排不開時', { exact: false })).toBeInViewport();
  await page.getByRole('button', { name: '下個月', exact: true }).click();
  await page.getByRole('button', { name: date, exact: true }).click();
  await page.getByLabel('開始時間（台灣時間）').fill('14:00');
  await page.getByRole('button', { name: '記下備用', exact: true }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('兩組不同');
  await page.getByLabel('開始時間（台灣時間）').fill('16:30');
  await page.getByRole('button', { name: '記下備用', exact: true }).click();
  await expect(page.getByRole('status', { name: '已記下 2 組，共 2 組' })).toBeVisible();
  await expect(page.getByText('如需改期', { exact: false })).toContainText('14 天');
  await page.getByLabel('聯絡人姓名').fill('隔離送單');
  await page.getByLabel('LINE ID').fill(lineId);
  await page.getByRole('button', { name: '前往付款' }).click();
  await expect(page.getByRole('status').filter({ hasText: '已收到預約申請' })).toBeVisible();
  const tasks = await db.task.findMany({ where: { taskId: { startsWith: 'BOOK-CYN-' }, description: { contains: lineId } } });
  expect(tasks).toHaveLength(1);
  expect(tasks[0].status).toBe('todo');
  expect(tasks[0].title).toContain('待付款');
  const checkout = new URL(await page.getByRole('link', { name: '前往 Shopify 結帳' }).getAttribute('href'));
  expect(checkout.origin).toBe('https://furmosa.com');
  expect(checkout.pathname).toBe('/cart/65121055637881:1');
  expect(JSON.parse(Buffer.from(checkout.searchParams.get('properties'), 'base64url').toString())).toEqual({ '預約編號': tasks[0].taskId });
  expect(tasks[0].description).toContain(date + 'T14:00');
  expect(tasks[0].description).toContain(date + 'T16:30');

  await page.goto('/login?next=%2Ftasks');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('密碼', { exact: true }).fill(password);
  await page.getByRole('button', { name: '登入', exact: true }).click();
  await expect(page.getByRole('article').filter({ hasText: tasks[0].taskId })).toContainText(lineId);
});
