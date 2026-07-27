/**
 * Idempotent demo admin bootstrap for HQ + POS.
 *
 * Creates (if missing):
 *   - HQ User:  admin@furmosa.com / furmosa2026
 *   - Merchant: MER-DEMO（Furmosa Preview 店）
 *   - POS User: admin / furmosa2026  （綁 MER-DEMO）
 *
 * Runs automatically on Vercel Preview builds, or when ENABLE_DEMO_ADMIN=1.
 * Never prints the password. Safe to re-run.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const DEMO_PASSWORD = 'furmosa2026';
const HQ_ADMIN_EMAIL = 'admin@furmosa.com';
const POS_USERNAME = 'admin';
const DEMO_MERCHANT_BUSINESS_ID = 'MER-DEMO';
const DEMO_MERCHANT_NAME = 'Furmosa Preview 店';

function shouldRun(): boolean {
  if (process.env.ENABLE_DEMO_ADMIN === '1') return true;
  if (process.env.ENABLE_DEMO_ADMIN === '0') return false;
  // Vercel Preview 自動建立，方便驗收 POS 登入
  if (process.env.VERCEL_ENV === 'preview') return true;
  return false;
}

function createPrisma() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error('缺少 DATABASE_URL / DIRECT_URL');
  }
  return new PrismaClient({
    datasources: { db: { url } },
  });
}

async function ensureHqAdmin(prisma: PrismaClient, passwordHash: string) {
  const existing = await prisma.user.findUnique({
    where: { email: HQ_ADMIN_EMAIL },
    select: { id: true, email: true, role: true },
  });
  if (existing) {
    return { status: 'exists' as const, email: existing.email, role: existing.role };
  }
  const created = await prisma.user.create({
    data: {
      email: HQ_ADMIN_EMAIL,
      name: '陳管理員',
      role: 'admin',
      passwordHash,
    },
    select: { email: true, role: true },
  });
  return { status: 'created' as const, email: created.email, role: created.role };
}

async function ensureDemoMerchant(prisma: PrismaClient) {
  const existing = await prisma.merchant.findUnique({
    where: { merchantId: DEMO_MERCHANT_BUSINESS_ID },
    select: { id: true, merchantId: true, name: true },
  });
  if (existing) return existing;

  return prisma.merchant.create({
    data: {
      merchantId: DEMO_MERCHANT_BUSINESS_ID,
      name: DEMO_MERCHANT_NAME,
      type: 'flagship',
      types: ['flagship'],
      contactName: 'Preview Admin',
      city: '台北',
      status: 'active',
      notes: '自動建立的 Preview／Demo 店家（ensure-demo-admin）',
    },
    select: { id: true, merchantId: true, name: true },
  });
}

async function ensurePosAdmin(
  prisma: PrismaClient,
  merchant: { id: string; merchantId: string; name: string },
  passwordHash: string,
) {
  const existing = await prisma.merchantUser.findUnique({
    where: { username: POS_USERNAME },
    select: {
      id: true,
      username: true,
      isActive: true,
      merchantId: true,
      merchant: { select: { merchantId: true, name: true } },
    },
  });

  if (existing) {
    // Preview／demo：同步密碼與啟用狀態，避免舊帳密對不上文件
    await prisma.merchantUser.update({
      where: { id: existing.id },
      data: { passwordHash, isActive: true },
    });
    return {
      status: 'updated' as const,
      username: existing.username,
      isActive: true,
      merchantId: existing.merchant.merchantId,
      merchantName: existing.merchant.name,
    };
  }

  const created = await prisma.merchantUser.create({
    data: {
      merchantId: merchant.id,
      username: POS_USERNAME,
      passwordHash,
      displayName: '店家 Admin',
      isActive: true,
    },
    select: { username: true, isActive: true },
  });

  return {
    status: 'created' as const,
    username: created.username,
    isActive: created.isActive,
    merchantId: merchant.merchantId,
    merchantName: merchant.name,
  };
}

async function main() {
  if (!shouldRun()) {
    console.log(
      JSON.stringify({
        status: 'skipped',
        reason:
          'Not preview and ENABLE_DEMO_ADMIN!=1（正式環境請手動 npm run merchant:create-user）',
      }),
    );
    return;
  }

  const prisma = createPrisma();
  try {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    const hq = await ensureHqAdmin(prisma, passwordHash);
    const merchant = await ensureDemoMerchant(prisma);
    const pos = await ensurePosAdmin(prisma, merchant, passwordHash);

    console.log(
      JSON.stringify({
        status: 'ok',
        hq,
        pos: {
          status: pos.status,
          username: pos.username,
          merchantId: pos.merchantId,
          merchantName: pos.merchantName,
          isActive: pos.isActive,
        },
        hint: {
          hqLogin: '/login',
          posLogin: '/pos/login',
          password: '(same as seed default — see README / DEPLOY.md)',
        },
      }),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('失敗：', e instanceof Error ? e.message : e);
  process.exit(1);
});
