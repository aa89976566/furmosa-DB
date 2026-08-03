/**
 * Store（LINE 核銷／口味庫存）↔ Merchant（POS／寄賣庫存）對應。
 * 慣例：MER-0001 → slug mer_0001；豬窩等特例走 ZHUWO_CONSIGNMENT_BRANCHES。
 */

import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  ZHUWO_CONSIGNMENT_BRANCHES,
  ZHUWO_LEGACY_STORE_SLUG,
} from '@/lib/stores/zhuwo-branches';
import { merchantToStoreSlug } from '@/lib/stores/sync-merchant-stores';

type StoreMerchantDb = {
  store: PrismaClient['store'];
  merchant: PrismaClient['merchant'];
};

export type StoreMerchantLink = {
  storeId: string;
  storeSlug: string;
  storeName: string;
  merchantId: string; // Merchant.id (cuid)
  merchantCode: string; // Merchant.merchantId e.g. MER-0001
  merchantName: string;
};

/** slug → 可能的 merchantId 代碼（MER-xxxx） */
export function storeSlugToMerchantCode(slug: string): string | null {
  const s = slug.trim().toLowerCase();
  if (!s) return null;

  const zhuwo = ZHUWO_CONSIGNMENT_BRANCHES.find((b) => b.storeSlug === s);
  if (zhuwo) return zhuwo.merchantId;

  if (s === ZHUWO_LEGACY_STORE_SLUG) {
    return ZHUWO_CONSIGNMENT_BRANCHES[0]?.merchantId ?? 'MER-0016';
  }

  // mer_0001 → MER-0001
  if (/^mer_\d+$/i.test(s)) {
    const digits = s.slice(4);
    return `MER-${digits}`;
  }

  return null;
}

export async function resolveStoreForMerchant(
  merchantIdOrCode: string,
  db: StoreMerchantDb = prisma,
): Promise<{ id: string; slug: string; name: string } | null> {
  const merchant = await db.merchant.findFirst({
    where: {
      OR: [{ id: merchantIdOrCode }, { merchantId: merchantIdOrCode }],
    },
    select: { id: true, merchantId: true, name: true },
  });
  if (!merchant) return null;

  const zhuwo = ZHUWO_CONSIGNMENT_BRANCHES.find(
    (b) => b.merchantId === merchant.merchantId || b.name === merchant.name,
  );
  if (zhuwo) {
    const bySlug = await db.store.findUnique({
      where: { slug: zhuwo.storeSlug },
      select: { id: true, slug: true, name: true },
    });
    if (bySlug) return bySlug;
  }

  const slug = merchantToStoreSlug(merchant.merchantId);
  const bySlug = await db.store.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true },
  });
  if (bySlug) return bySlug;

  const byName = await db.store.findFirst({
    where: { name: { equals: merchant.name, mode: 'insensitive' } },
    select: { id: true, slug: true, name: true },
  });
  return byName;
}

export async function resolveMerchantForStore(
  storeIdOrSlug: string,
  db: StoreMerchantDb = prisma,
): Promise<{ id: string; merchantId: string; name: string } | null> {
  const store = await db.store.findFirst({
    where: {
      OR: [{ id: storeIdOrSlug }, { slug: storeIdOrSlug }],
    },
    select: { id: true, slug: true, name: true },
  });
  if (!store) return null;

  const code = storeSlugToMerchantCode(store.slug);
  if (code) {
    const byCode = await db.merchant.findUnique({
      where: { merchantId: code },
      select: { id: true, merchantId: true, name: true },
    });
    if (byCode) return byCode;
  }

  const zhuwo = ZHUWO_CONSIGNMENT_BRANCHES.find(
    (b) => b.storeSlug === store.slug || b.name === store.name,
  );
  if (zhuwo) {
    const byZhuwo = await db.merchant.findFirst({
      where: {
        OR: [{ merchantId: zhuwo.merchantId }, { name: zhuwo.name }],
      },
      select: { id: true, merchantId: true, name: true },
    });
    if (byZhuwo) return byZhuwo;
  }

  const byName = await db.merchant.findFirst({
    where: { name: { equals: store.name, mode: 'insensitive' } },
    select: { id: true, merchantId: true, name: true },
  });
  return byName;
}

export async function resolveStoreMerchantLink(
  storeIdOrSlug: string,
  db: StoreMerchantDb = prisma,
): Promise<StoreMerchantLink | null> {
  const store = await db.store.findFirst({
    where: {
      OR: [{ id: storeIdOrSlug }, { slug: storeIdOrSlug }],
    },
    select: { id: true, slug: true, name: true },
  });
  if (!store) return null;
  const merchant = await resolveMerchantForStore(store.id, db);
  if (!merchant) return null;
  return {
    storeId: store.id,
    storeSlug: store.slug,
    storeName: store.name,
    merchantId: merchant.id,
    merchantCode: merchant.merchantId,
    merchantName: merchant.name,
  };
}
