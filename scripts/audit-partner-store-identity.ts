/**
 * 只讀統計：店家身分分類對帳。
 * 不新增、不合併、不刪除、不修正，不觸發 LINE／付款／同步。
 *
 * 執行：npx tsx scripts/audit-partner-store-identity.ts
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import {
  formatAuditReportMarkdown,
  summarizePartnerStoreIdentityAudit,
} from '@/lib/jar-exchange/partner-store-identity-audit';

const FORBIDDEN = /(?:^|\b)(?:write|fix|merge|delete|sync|update|insert|seed)(?:\b|$)/i;

function anonymize(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function normalizePhone(raw: string): string {
  return raw.replace(/[\s\-()]/g, '');
}

function loadLocalEnvIfPresent() {
  const path = join(process.cwd(), '.env');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const eq = trimmed.indexOf('=');
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === '') {
      process.env[key] = value;
    }
  }
}

function isPostgresUrl(raw: string | undefined): boolean {
  return /^postgres(?:ql)?:\/\//i.test(raw?.trim() ?? '');
}

function assertReadOnlyArgs(argv: string[]) {
  const bad = argv.find((arg) => FORBIDDEN.test(arg));
  if (bad) {
    throw new Error(`這支程式只能只讀統計，拒絕參數：${bad}`);
  }
}

async function main() {
  assertReadOnlyArgs(process.argv.slice(2));
  loadLocalEnvIfPresent();

  const databaseConfigured = isPostgresUrl(process.env.DATABASE_URL);
  const environmentName = `cursor-cloud:${hostname()}`;

  if (!databaseConfigured) {
    const empty = summarizePartnerStoreIdentityAudit(
      {
        stores: [],
        merchants: [],
        merchantUsers: [],
        refillOrders: [],
        coupons: [],
        customers: [],
      },
      {
        environmentName,
        databaseConfigured: false,
        queriedLiveData: false,
      },
    );
    process.stdout.write(formatAuditReportMarkdown(empty));
    process.stderr.write(
      '未查正式資料：這個環境沒有可用的 PostgreSQL 連線。判定與對帳程式已就緒，但七項數字仍是空的。\n',
    );
    process.exitCode = 2;
    return;
  }

  const prisma = new PrismaClient();
  try {
    const [stores, merchants, merchantUsers, refillOrders, coupons, customers] = await Promise.all([
      prisma.store.findMany({
        select: { id: true, slug: true, name: true },
        orderBy: { slug: 'asc' },
      }),
      prisma.merchant.findMany({
        select: {
          id: true,
          merchantId: true,
          name: true,
          city: true,
          address: true,
          status: true,
          type: true,
        },
        orderBy: { merchantId: 'asc' },
      }),
      prisma.merchantUser.findMany({
        select: { id: true, merchantId: true },
      }),
      prisma.refillOrder.findMany({
        select: { id: true, merchantId: true },
      }),
      prisma.groomingCoupon.findMany({
        select: { id: true, storeId: true },
      }),
      prisma.customer.findMany({
        select: {
          customerId: true,
          signupStore: true,
          storeId: true,
          phone: true,
          lineUserId: true,
          _count: {
            select: {
              jarCodesRedeemed: true,
              pointsLedger: true,
              refillOrders: true,
              groomingCoupons: true,
              rewardRedemptions: true,
            },
          },
        },
      }),
    ]);

    const report = summarizePartnerStoreIdentityAudit(
      {
        stores,
        merchants: merchants.map((row) => ({
          id: row.id,
          merchantId: row.merchantId,
          name: row.name,
          city: row.city,
          address: row.address,
          status: row.status,
          types: [row.type],
        })),
        merchantUsers: merchantUsers.map((row) => ({
          id: row.id,
          merchantRecordId: row.merchantId,
        })),
        refillOrders: refillOrders.map((row) => ({
          id: row.id,
          merchantRecordId: row.merchantId,
        })),
        coupons: coupons.map((row) => ({
          id: row.id,
          storeKey: row.storeId,
        })),
        customers: customers.map((row) => {
          const counts = row._count;
          return {
            customerId: row.customerId,
            signupStore: row.signupStore,
            storeId: row.storeId,
            phoneKey: row.phone ? anonymize(normalizePhone(row.phone)) : null,
            lineKey: row.lineUserId ? anonymize(row.lineUserId) : null,
            hasJarActivity:
              counts.jarCodesRedeemed +
                counts.pointsLedger +
                counts.refillOrders +
                counts.groomingCoupons +
                counts.rewardRedemptions >
              0,
          };
        }),
      },
      {
        environmentName,
        databaseConfigured: true,
        queriedLiveData: true,
      },
    );

    if (process.argv.includes('--json')) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return;
    }
    process.stdout.write(formatAuditReportMarkdown(report));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
