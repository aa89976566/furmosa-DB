import { randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { getMerchantTypesMap } from '@/lib/merchant-types-persist';
import type { MerchantType } from '@/lib/merchant-types';
import { prisma } from '@/lib/prisma';
import { isInternalMerchantId } from '@/lib/stores/partner-store-visibility';

/** 寄賣店家編號 → 核銷 slug（MER-0001 → mer_0001） */
export function merchantToStoreSlug(merchantId: string): string {
  return merchantId.trim().toLowerCase().replace(/-/g, '_');
}

/** legacy NOT NULL placeholder, not auth credential */
function generateLegacyStorePlaceholder(): string {
  return randomBytes(24).toString('base64url');
}

type MerchantStoreSource = {
  id: string;
  merchantId: string;
  name: string;
  status: string;
};

/** 標記換罐的寄賣店家 → 寫入 stores 表供 LINE 開戶／折價券核銷 */
export async function syncPartnerStoreForJarExchangeMerchant(
  db: PrismaClient,
  merchant: MerchantStoreSource,
  types: MerchantType[],
): Promise<void> {
  if (merchant.status !== 'active' || !types.includes('jar_exchange')) return;

  const slug = merchantToStoreSlug(merchant.merchantId);

  const existingBySlug = await db.store.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
  if (existingBySlug) {
    if (existingBySlug.name !== merchant.name) {
      await db.store.update({
        where: { id: existingBySlug.id },
        data: { name: merchant.name },
      });
    }
    return;
  }

  const existingByName = await db.store.findFirst({
    where: { name: { equals: merchant.name, mode: 'insensitive' } },
    select: { id: true, name: true },
  });
  if (existingByName) {
    if (existingByName.name !== merchant.name) {
      await db.store.update({
        where: { id: existingByName.id },
        data: { name: merchant.name },
      });
    }
    return;
  }

  await db.store.create({
    data: {
      id: `store_${slug}`,
      name: merchant.name,
      slug,
      secretToken: generateLegacyStorePlaceholder(),
    },
  });
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
    // 測試／對照店不同步進顧客可見的 stores 主檔
    if (isInternalMerchantId(merchant.merchantId)) continue;
    const types = typesMap.get(merchant.id) ?? ['consignment'];
    if (!types.includes('jar_exchange')) continue;
    await syncPartnerStoreForJarExchangeMerchant(db, merchant, types);
    synced++;
  }
  return synced;
}
