import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const pagePath = new URL('../../../app/(main)/refill/audit/page.tsx', import.meta.url);
const auditPath = new URL('../history-audit.ts', import.meta.url);

test('換罐歷史盤點頁只允許 HQ 管理員查看', async () => {
  const source = await readFile(pagePath, 'utf8');

  assert.match(source, /getCurrentUser\(\)/);
  assert.match(source, /session\.role !== 'admin'/);
  assert.match(source, /notFound\(\)/);
  assert.match(source, /redirect\('\/login\?next=\/refill\/audit'\)/);
});

test('換罐歷史盤點頁沒有資料修復操作', async () => {
  const source = await readFile(pagePath, 'utf8');

  assert.match(source, /loadRefillHistoryAudit\(prisma\)/);
  assert.doesNotMatch(source, /updateMany|update\(|create\(|deleteMany|delete\(|\$executeRaw|\$queryRawUnsafe/);
  assert.match(source, /本頁沒有修復按鈕/);
});

test('歷史盤點資料來源維持 findMany 唯讀契約', async () => {
  const source = await readFile(auditPath, 'utf8');

  assert.match(source, /只使用 findMany/);
  assert.doesNotMatch(source, /\.update\(|\.updateMany\(|\.create\(|\.delete\(|\.deleteMany\(|\$executeRaw/);
});
