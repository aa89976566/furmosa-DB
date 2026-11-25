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

test('Cynthia calendar submits both Taiwan times and shows the request in HQ', async ({ page }) => {
  const suffix = randomUUID();
  const email = 'booking-' + suffix + '@example.invalid';
  const password = randomUUID();
  await db.user.create({ data: { email, name: '隔離驗收人員', role: 'admin', passwordHash: await bcrypt.hash(password, 10) } });

  await page.goto('/book/cynthia');
  await page.getByRole('button', { name: '下個月', exact: true }).click();
  const day = page.getByRole('button', { name: /^\d{4}-\d{2}-01$/ });
  const date = await day.getAttribute('aria-label');
  await day.click();
  await page.getByLabel('開始時間（台灣時間）').fill('14:00');
  await page.getByRole('button', { name: '選擇第二候選時段' }).click();
  await page.getByRole('button', { name: '下個月', exact: true }).click();
  await page.getByRole('button', { name: date, exact: true }).click();
  await page.getByLabel('開始時間（台灣時間）').fill('16:30');
  await page.getByLabel('聯絡人姓名').fill('隔離送單');
  await page.getByLabel('電子郵件').fill(email);
  await page.getByRole('button', { name: '送出預約申請' }).click();
  await expect(page.getByRole('status').filter({ hasText: '已收到預約申請' })).toBeVisible();
  const tasks = await db.task.findMany({ where: { taskId: { startsWith: 'BOOK-CYN-' }, description: { contains: email } } });
  expect(tasks).toHaveLength(1);
  expect(tasks[0].status).toBe('todo');
  expect(tasks[0].description).toContain(date + 'T14:00');
  expect(tasks[0].description).toContain(date + 'T16:30');

  await page.goto('/login?next=%2Ftasks');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('密碼', { exact: true }).fill(password);
  await page.getByRole('button', { name: '登入', exact: true }).click();
  await expect(page.getByRole('article').filter({ hasText: tasks[0].taskId })).toContainText(email);
});
