/**
 * Idempotent MerchantUser creator for Phase 1.
 *
 * Usage:
 *   MERCHANT_ID=MER-0001 USERNAME=store01 PASSWORD='***' npx tsx scripts/create-merchant-user.ts
 *
 * Optional:
 *   DISPLAY_NAME="豬窩中和"
 *   ALLOW_ADDITIONAL_ACTIVE=1  # allow second active user on same merchant (default: no)
 *
 * Never prints the password. Safe to re-run.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } },
});

function usage() {
  console.error(
    '用法：MERCHANT_ID=MER-0001 USERNAME=store01 PASSWORD=*** npx tsx scripts/create-merchant-user.ts',
  );
}

async function main() {
  const merchantBusinessId = process.env.MERCHANT_ID?.trim();
  const username = process.env.USERNAME?.trim();
  const password = process.env.PASSWORD;
  const displayName = process.env.DISPLAY_NAME?.trim() || null;
  const allowAdditional = process.env.ALLOW_ADDITIONAL_ACTIVE === '1';

  if (!merchantBusinessId || !username || !password) {
    usage();
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('失敗：密碼至少 8 字元');
    process.exit(1);
  }

  const merchant = await prisma.merchant.findFirst({
    where: {
      OR: [{ merchantId: merchantBusinessId }, { id: merchantBusinessId }],
    },
    select: { id: true, merchantId: true, name: true },
  });

  if (!merchant) {
    console.error(`失敗：找不到店家 ${merchantBusinessId}`);
    process.exit(1);
  }

  const existingByUsername = await prisma.merchantUser.findUnique({
    where: { username },
    select: {
      id: true,
      merchantId: true,
      username: true,
      isActive: true,
    },
  });

  if (existingByUsername) {
    if (existingByUsername.merchantId !== merchant.id) {
      console.error(
        `失敗：帳號「${username}」已屬於其他店家，無法重複建立`,
      );
      process.exit(1);
    }
    console.log(
      JSON.stringify({
        status: 'exists',
        username: existingByUsername.username,
        merchantId: merchant.merchantId,
        merchantName: merchant.name,
        isActive: existingByUsername.isActive,
      }),
    );
    return;
  }

  const activeOnMerchant = await prisma.merchantUser.count({
    where: { merchantId: merchant.id, isActive: true },
  });

  if (activeOnMerchant > 0 && !allowAdditional) {
    console.error(
      `失敗：店家 ${merchant.merchantId} 已有 active 帳號。Phase 1 預設一店一號；若需加開請設 ALLOW_ADDITIONAL_ACTIVE=1`,
    );
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const created = await prisma.merchantUser.create({
    data: {
      merchantId: merchant.id,
      username,
      passwordHash,
      displayName,
      isActive: true,
    },
    select: { id: true, username: true, isActive: true },
  });

  console.log(
    JSON.stringify({
      status: 'created',
      username: created.username,
      merchantId: merchant.merchantId,
      merchantName: merchant.name,
      isActive: created.isActive,
    }),
  );
}

main()
  .catch((e) => {
    console.error('失敗：', e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
