/**
 * 人工、明確啟用的 demo／驗收帳號 bootstrap（HQ + POS）。
 *
 * Fail closed（任何 Prisma query／寫入前）：
 * - VERCEL_ENV === "production" → 立即拒絕
 * - ENABLE_DEMO_ADMIN 必須為 "1"（Preview 不會自動啟用）
 * - DEMO_ADMIN_PASSWORD 必須存在且長度 >= 16
 *
 * 允許時（僅非 production）：
 * - HQ：admin@furmosa.com（不存在才建立；既有帳號不改密碼）
 * - Merchant MER-DEMO + POS admin（不存在才建立；既有帳號不改密碼、不 rebind）
 *
 * Never prints the password.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const HQ_ADMIN_EMAIL = 'admin@furmosa.com';
const POS_DEMO_USERNAME = 'admin';
const DEMO_MERCHANT_BUSINESS_ID = 'MER-DEMO';
const DEMO_MERCHANT_NAME = 'Furmosa Preview 店';
const MIN_PASSWORD_LENGTH = 16;

function failClosed(message: string): never {
  console.error(message);
  process.exit(1);
}

/** 所有 DB 操作前的安全閘門；通過後才回傳密碼（不記錄、不輸出）。 */
function assertSafeToRun(): string {
  if (process.env.VERCEL_ENV === 'production') {
    failClosed('拒絕：production 環境禁止執行 ensure-demo-admin');
  }

  if (process.env.ENABLE_DEMO_ADMIN !== '1') {
    failClosed(
      '拒絕：未明確啟用。請設定 ENABLE_DEMO_ADMIN=1（Preview／其他環境皆不會自動啟用）',
    );
  }

  const password = process.env.DEMO_ADMIN_PASSWORD;
  if (!password) {
    failClosed('拒絕：缺少 DEMO_ADMIN_PASSWORD 環境變數');
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    failClosed(
      `拒絕：DEMO_ADMIN_PASSWORD 長度不足（至少 ${MIN_PASSWORD_LENGTH} 字元）`,
    );
  }

  return password;
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
    // 既有帳號：不重設密碼
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
      notes: '明確啟用時建立的 Preview／Demo 店家（ensure-demo-admin）',
    },
    select: { id: true, merchantId: true, name: true },
  });
}

/** 僅建立；既有帳號略過（不改密碼、不 rebind）。 */
async function ensurePosDemoUser(
  prisma: PrismaClient,
  opts: {
    username: string;
    displayName: string;
    merchant: { id: string; merchantId: string; name: string };
    passwordHash: string;
  },
) {
  const existing = await prisma.merchantUser.findUnique({
    where: { username: opts.username },
    select: {
      id: true,
      username: true,
      isActive: true,
      merchant: { select: { merchantId: true, name: true } },
    },
  });

  if (existing) {
    return {
      status: 'exists' as const,
      username: existing.username,
      isActive: existing.isActive,
      merchantId: existing.merchant.merchantId,
      merchantName: existing.merchant.name,
      note: '既有帳號略過（不重設密碼、不改綁店家）',
    };
  }

  const created = await prisma.merchantUser.create({
    data: {
      merchantId: opts.merchant.id,
      username: opts.username,
      passwordHash: opts.passwordHash,
      displayName: opts.displayName,
      isActive: true,
    },
    select: { username: true, isActive: true },
  });

  return {
    status: 'created' as const,
    username: created.username,
    isActive: created.isActive,
    merchantId: opts.merchant.merchantId,
    merchantName: opts.merchant.name,
  };
}

async function main() {
  const password = assertSafeToRun();
  const prisma = createPrisma();
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const report: Record<string, unknown> = { status: 'ok' };

    report.hq = await ensureHqAdmin(prisma, passwordHash);
    const demoMerchant = await ensureDemoMerchant(prisma);
    report.posDemo = await ensurePosDemoUser(prisma, {
      username: POS_DEMO_USERNAME,
      displayName: '店家 Admin',
      merchant: demoMerchant,
      passwordHash,
    });
    report.hint = {
      posLogin: '/pos/login',
      demoUsername: POS_DEMO_USERNAME,
      hqEmail: HQ_ADMIN_EMAIL,
      password: '(from DEMO_ADMIN_PASSWORD — never logged)',
    };

    console.log(JSON.stringify(report));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('失敗：', e instanceof Error ? e.message : e);
  process.exit(1);
});
