import type { PrismaClient } from '@prisma/client';
import { getMerchantTypesMap } from '@/lib/merchant-types-persist';
import type { MerchantType } from '@/lib/merchant-types';
import { prisma } from '@/lib/prisma';
import { ZHUWO_CONSIGNMENT_BRANCHES } from '@/lib/stores/zhuwo-branches';
import { getGroomingCouponDiscountForStore } from '@/lib/coupons/store-discount';

/** 寄賣店家編號 → 核銷 slug（MER-0001 → mer_0001） */
export function merchantToStoreSlug(merchantId: string): string {
  return merchantId.trim().toLowerCase().replace(/-/g, '_');
}

export function preferredRedeemSlugForMerchant(input: {
  merchantId: string;
  name: string;
}): string {
  const zhuwo = ZHUWO_CONSIGNMENT_BRANCHES.find(
    (b) => b.merchantId === input.merchantId || b.name === input.name,
  );
  if (zhuwo) return zhuwo.storeSlug;
  return merchantToStoreSlug(input.merchantId);
}

function generateSecretToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 6; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

type MerchantStoreSource = {
  id: string;
  merchantId: string;
  name: string;
  status: string;
};

async function ensureStoreRow(
  db: PrismaClient,
  merchant: MerchantStoreSource,
  slug: string,
): Promise<{ slug: string; secretToken: string }> {
  const zhuwo = ZHUWO_CONSIGNMENT_BRANCHES.find(
    (b) => b.merchantId === merchant.merchantId || b.name === merchant.name,
  );

  const existingBySlug = await db.store.findUnique({
    where: { slug },
    select: { id: true, name: true, secretToken: true, slug: true },
  });
  if (existingBySlug) {
    if (existingBySlug.name !== merchant.name) {
      await db.store.update({
        where: { id: existingBySlug.id },
        data: { name: merchant.name },
      });
    }
    return { slug: existingBySlug.slug, secretToken: existingBySlug.secretToken };
  }

  const existingByName = await db.store.findFirst({
    where: { name: { equals: merchant.name, mode: 'insensitive' } },
    select: { id: true, name: true, secretToken: true, slug: true },
  });
  if (existingByName) {
    if (existingByName.name !== merchant.name) {
      await db.store.update({
        where: { id: existingByName.id },
        data: { name: merchant.name },
      });
    }
    return { slug: existingByName.slug, secretToken: existingByName.secretToken };
  }

  const secretToken = zhuwo?.storeSecretToken ?? generateSecretToken();
  await db.store.create({
    data: {
      id: `store_${slug}`,
      name: merchant.name,
      slug,
      secretToken,
    },
  });
  return { slug, secretToken };
}

async function upsertRedeemProfile(
  db: PrismaClient,
  merchant: MerchantStoreSource,
  slug: string,
  secretToken: string,
): Promise<void> {
  const discount = getGroomingCouponDiscountForStore(slug, merchant.name);
  const existing = await db.merchantRedeemProfile.findUnique({
    where: { merchantId: merchant.id },
    select: { id: true, slug: true },
  });
  if (existing) {
    await db.merchantRedeemProfile.update({
      where: { id: existing.id },
      data: {
        slug,
        secretToken,
        groomingDiscountAmount: discount,
        active: true,
      },
    });
    return;
  }

  // slug 已被其他 profile 占用時，改用 merchant 預設 slug
  const slugTaken = await db.merchantRedeemProfile.findUnique({
    where: { slug },
    select: { id: true, merchantId: true },
  });
  const finalSlug =
    slugTaken && slugTaken.merchantId !== merchant.id
      ? merchantToStoreSlug(merchant.merchantId)
      : slug;

  await db.merchantRedeemProfile.create({
    data: {
      id: `mrp_${finalSlug}`,
      merchantId: merchant.id,
      slug: finalSlug,
      secretToken,
      groomingDiscountAmount: discount,
      active: true,
    },
  });
}

/** 標記換罐的寄賣店家 → stores（相容）+ MerchantRedeemProfile */
export async function syncPartnerStoreForJarExchangeMerchant(
  db: PrismaClient,
  merchant: MerchantStoreSource,
  types: MerchantType[],
): Promise<void> {
  if (merchant.status !== 'active' || !types.includes('jar_exchange')) return;

  const slug = preferredRedeemSlugForMerchant(merchant);
  const store = await ensureStoreRow(db, merchant, slug);
  await upsertRedeemProfile(db, merchant, store.slug, store.secretToken);
}

/** 將所有換罐寄賣店家同步至核銷店家主檔 */
export async function syncAllJarExchangePartnerStores(
  db: PrismaClient = prisma,
): Promise<number> {
  const merchants = await db.merchant.findMany({
    where: { status: 'active' },
    select: { id: true, merchantId: true, name: true, status: true, type: true },
    orderBy: { merchantId: 'asc' },
  });
  if (merchants.length === 0) return 0;

  const typesMap = await getMerchantTypesMap(
    db,
    merchants.map((m) => ({ id: m.id, type: m.type })),
  );

  let synced = 0;
  for (const merchant of merchants) {
    const types = typesMap.get(merchant.id) ?? ['consignment'];
    if (!types.includes('jar_exchange')) continue;
    await syncPartnerStoreForJarExchangeMerchant(db, merchant, types);
    synced++;
  }
  return synced;
}
