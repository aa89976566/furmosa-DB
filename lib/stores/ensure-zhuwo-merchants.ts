import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ZHUWO_CONSIGNMENT_BRANCHES } from '@/lib/stores/zhuwo-branches';
import { syncPartnerStoreForJarExchangeMerchant } from '@/lib/stores/sync-merchant-stores';

async function nextFreeMerchantId(db: PrismaClient): Promise<string> {
  const rows = await db.merchant.findMany({
    where: { merchantId: { startsWith: 'MER-' } },
    select: { merchantId: true },
  });
  let max = 0;
  for (const row of rows) {
    const n = Number(row.merchantId.replace(/^MER-/, ''));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `MER-${String(max + 1).padStart(4, '0')}`;
}

function banqiaoNameWhere() {
  return {
    OR: [
      { name: '豬窩 板橋店' },
      { name: '豬窩板橋店' },
      { name: '豬窩-板橋店' },
      { AND: [{ name: { contains: '豬窩' } }, { name: { contains: '板橋' } }] },
    ],
  };
}

/**
 * 確保豬窩三間分店存在於寄賣 Merchant（讀取清單時呼叫，與 LINE stores sync 同模式）。
 * 以店名為準；偏好 MER 編號被占用時改用下一個空號。
 */
export async function ensureZhuwoConsignmentBranches(
  db: PrismaClient = prisma,
): Promise<{ name: string; merchantId: string; created: boolean }[]> {
  const results: { name: string; merchantId: string; created: boolean }[] = [];

  for (const branch of ZHUWO_CONSIGNMENT_BRANCHES) {
    const existing =
      branch.name === '豬窩 板橋店'
        ? await db.merchant.findFirst({ where: banqiaoNameWhere() })
        : await db.merchant.findFirst({
            where: {
              OR: [{ name: branch.name }, { merchantId: branch.merchantId }],
            },
          });

    if (existing) {
      // 偏好編號對應到別家店時，只更新「確實是這間分店」的那筆
      const isThisBranch =
        existing.name === branch.name ||
        (branch.name === '豬窩 板橋店' &&
          existing.name.includes('豬窩') &&
          existing.name.includes('板橋')) ||
        (existing.merchantId === branch.merchantId &&
          (existing.name === '豬窩' || existing.name.startsWith('豬窩')));

      if (!isThisBranch && existing.merchantId === branch.merchantId) {
        // MER 被占用且不是豬窩分店 → 另外新建
        const merchantId = await nextFreeMerchantId(db);
        const created = await db.merchant.create({
          data: {
            merchantId,
            name: branch.name,
            type: 'consignment',
            types: ['consignment', 'jar_exchange'],
            city: branch.city,
            commissionRate: 0.3,
            status: 'active',
            notes: '[來源] 豬窩分店同步（ensure）',
          },
        });
        await syncPartnerStoreForJarExchangeMerchant(
          db,
          { id: created.id, merchantId: created.merchantId, name: created.name, status: 'active' },
          ['consignment', 'jar_exchange'],
        );
        results.push({ name: created.name, merchantId: created.merchantId, created: true });
        continue;
      }

      const needsUpdate =
        existing.name !== branch.name ||
        !(existing.city ?? '').trim() ||
        existing.type !== 'consignment' ||
        existing.status !== 'active';

      let merchantRow = existing;
      if (needsUpdate) {
        merchantRow = await db.merchant.update({
          where: { id: existing.id },
          data: {
            name: branch.name,
            city: existing.city?.trim() ? existing.city : branch.city,
            type: 'consignment',
            types: ['consignment', 'jar_exchange'],
            status: 'active',
          },
        });
      } else {
        // Still ensure types include jar_exchange when missing
        const types = Array.isArray(existing.types) ? existing.types : [];
        if (!types.includes('jar_exchange') || !types.includes('consignment')) {
          merchantRow = await db.merchant.update({
            where: { id: existing.id },
            data: { types: ['consignment', 'jar_exchange'] },
          });
        }
      }

      await syncPartnerStoreForJarExchangeMerchant(
        db,
        {
          id: merchantRow.id,
          merchantId: merchantRow.merchantId,
          name: merchantRow.name,
          status: merchantRow.status,
        },
        ['consignment', 'jar_exchange'],
      );
      results.push({
        name: merchantRow.name,
        merchantId: merchantRow.merchantId,
        created: false,
      });
      continue;
    }

    const preferredTaken = await db.merchant.findUnique({
      where: { merchantId: branch.merchantId },
      select: { id: true },
    });
    const merchantId = preferredTaken
      ? await nextFreeMerchantId(db)
      : branch.merchantId;

    const created = await db.merchant.create({
      data: {
        merchantId,
        name: branch.name,
        type: 'consignment',
        types: ['consignment', 'jar_exchange'],
        city: branch.city,
        commissionRate: 0.3,
        status: 'active',
        notes: '[來源] 豬窩分店同步（ensure）',
      },
    });
    await syncPartnerStoreForJarExchangeMerchant(
      db,
      { id: created.id, merchantId: created.merchantId, name: created.name, status: 'active' },
      ['consignment', 'jar_exchange'],
    );
    results.push({ name: created.name, merchantId: created.merchantId, created: true });
  }

  // LINE 核銷：確保 zhuwo_* slug 存在（不依賴 mer_00xx）
  for (const branch of ZHUWO_CONSIGNMENT_BRANCHES) {
    const store = await db.store.findUnique({
      where: { slug: branch.storeSlug },
      select: { id: true, name: true },
    });
    if (store) {
      if (store.name !== branch.name) {
        await db.store.update({
          where: { id: store.id },
          data: { name: branch.name },
        });
      }
    } else {
      await db.store.create({
        data: {
          id: `store_${branch.storeSlug}`,
          name: branch.name,
          slug: branch.storeSlug,
          secretToken: branch.storeSecretToken,
        },
      });
    }
  }

  return results;
}
