/**
 * Idempotent demo／驗收帳號 bootstrap（HQ + POS）。
 *
 * 1) 驗收主帳（Vercel Preview／Production 都會跑）：
 *    - 綁真實店家「妞妞／淡水妞妞」
 *    - POS：niuniu / furmosa2026
 *    - 找不到妞妞店家 → 略過（不造假店，避免對錯帳）
 *
 * 2) Preview 額外（或 ENABLE_DEMO_ADMIN=1）：
 *    - HQ：admin@furmosa.com / furmosa2026
 *    - Merchant MER-DEMO + POS admin（空店沙盒）
 *
 * Never prints the password. Safe to re-run.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { pickNiuniuMerchant } from '../lib/pos/niuniu-merchant';

const DEMO_PASSWORD = 'furmosa2026';
const HQ_ADMIN_EMAIL = 'admin@furmosa.com';
const POS_DEMO_USERNAME = 'admin';
const POS_NIUNIU_USERNAME = 'niuniu';
const DEMO_MERCHANT_BUSINESS_ID = 'MER-DEMO';
const DEMO_MERCHANT_NAME = 'Furmosa Preview 店';

function isVercelDeploy(): boolean {
  return (
    process.env.VERCEL_ENV === 'preview' ||
    process.env.VERCEL_ENV === 'production'
  );
}

function shouldRunFullDemo(): boolean {
  if (process.env.ENABLE_DEMO_ADMIN === '1') return true;
  if (process.env.ENABLE_DEMO_ADMIN === '0') return false;
  return process.env.VERCEL_ENV === 'preview';
}

function shouldEnsureNiuniu(): boolean {
  if (process.env.ENSURE_NIUNIU_POS === '0') return false;
  if (process.env.ENSURE_NIUNIU_POS === '1') return true;
  return isVercelDeploy() || process.env.ENABLE_DEMO_ADMIN === '1';
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

/** 優先用真實「妞妞」店，方便對帳；找不到則回 null */
async function findNiuniuMerchant(prisma: PrismaClient) {
  const candidates = await prisma.merchant.findMany({
    where: {
      OR: [
        { name: { contains: '淡水妞妞' } },
        { name: { contains: '妞妞' } },
      ],
      status: 'active',
    },
    select: { id: true, merchantId: true, name: true },
    take: 20,
  });
  return pickNiuniuMerchant(candidates);
}

async function ensurePosUserForMerchant(
  prisma: PrismaClient,
  opts: {
    username: string;
    displayName: string;
    merchant: { id: string; merchantId: string; name: string };
    passwordHash: string;
    /** 若帳號已存在但綁錯店，是否改綁到目標店（驗收用） */
    rebindIfWrongMerchant?: boolean;
  },
) {
  const existing = await prisma.merchantUser.findUnique({
    where: { username: opts.username },
    select: {
      id: true,
      username: true,
      isActive: true,
      merchantId: true,
      merchant: { select: { merchantId: true, name: true } },
    },
  });

  if (existing) {
    const wrongMerchant = existing.merchantId !== opts.merchant.id;
    if (wrongMerchant && !opts.rebindIfWrongMerchant) {
      return {
        status: 'conflict' as const,
        username: existing.username,
        isActive: existing.isActive,
        merchantId: existing.merchant.merchantId,
        merchantName: existing.merchant.name,
        note: '帳號已綁其他店，略過改綁',
      };
    }
    await prisma.merchantUser.update({
      where: { id: existing.id },
      data: {
        passwordHash: opts.passwordHash,
        isActive: true,
        displayName: opts.displayName,
        ...(wrongMerchant ? { merchantId: opts.merchant.id } : {}),
      },
    });
    return {
      status: (wrongMerchant ? 'rebound' : 'updated') as 'rebound' | 'updated',
      username: existing.username,
      isActive: true,
      merchantId: opts.merchant.merchantId,
      merchantName: opts.merchant.name,
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
  const prisma = createPrisma();
  try {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    const report: Record<string, unknown> = { status: 'ok' };

    if (shouldEnsureNiuniu()) {
      const niuniuMerchant = await findNiuniuMerchant(prisma);
      if (!niuniuMerchant) {
        report.niuniu = {
          status: 'skipped',
          reason: 'DB 找不到名稱含「妞妞」的 active Merchant（不造假店）',
        };
      } else {
        report.niuniu = await ensurePosUserForMerchant(prisma, {
          username: POS_NIUNIU_USERNAME,
          displayName: niuniuMerchant.name,
          merchant: niuniuMerchant,
          passwordHash,
          rebindIfWrongMerchant: true,
        });
      }
    } else {
      report.niuniu = { status: 'skipped', reason: 'ENSURE_NIUNIU_POS disabled' };
    }

    if (shouldRunFullDemo()) {
      report.hq = await ensureHqAdmin(prisma, passwordHash);
      const demoMerchant = await ensureDemoMerchant(prisma);
      report.posDemo = await ensurePosUserForMerchant(prisma, {
        username: POS_DEMO_USERNAME,
        displayName: '店家 Admin',
        merchant: demoMerchant,
        passwordHash,
        rebindIfWrongMerchant: false,
      });
    } else {
      report.demo = {
        status: 'skipped',
        reason: 'Not preview and ENABLE_DEMO_ADMIN!=1',
      };
    }

    report.hint = {
      posLogin: '/pos/login',
      niuniuUsername: POS_NIUNIU_USERNAME,
      password: '(same as seed default — see docs/POS-TODAY-DASHBOARD.md)',
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
