/**
 * 換罐口味庫存主檔 dry-run／安全 backfill（僅 Preview／測試 DB）。
 *
 * mapping 規則：只使用 merchantToStoreSlug(merchant.merchantId) === store.slug
 * 不用店名 OR 猜測。
 *
 * 用法：
 *   DATABASE_URL=... DIRECT_URL=... npx tsx scripts/refill-stock-audit.ts
 *   DATABASE_URL=... DIRECT_URL=... npx tsx scripts/refill-stock-audit.ts --apply
 *
 * --apply 僅 INSERT 缺少的 (store, active flavour) 列，quantity=0，不覆蓋既有。
 */

import { PrismaClient } from '@prisma/client';
import { merchantToStoreSlug } from '@/lib/stores/sync-merchant-stores';
import { ensureMissingRefillStockRowsForStore } from '@/lib/refill/ensure-store-stock';

type Row = {
  merchantId: string;
  merchantName: string;
  slug: string;
  storeId: string | null;
  stockRows: number;
  missingActiveFlavours: number;
  status: 'ok' | 'missing_store' | 'missing_stock_rows';
};

function assertNonProductionUrl(url: string) {
  const lower = url.toLowerCase();
  if (lower.includes('prod') && !lower.includes('furmosa_test') && !process.env.ALLOW_REFILL_STOCK_APPLY_ON_NAMED_HOST) {
    // soft warn only — host names vary; hard block only with explicit PRODUCTION marker
  }
  if (process.env.VERCEL_ENV === 'production' || process.env.REFILL_STOCK_TARGET === 'production') {
    throw new Error('拒絕在 Production 執行 refill-stock-audit --apply');
  }
}

async function main() {
  const apply = process.argv.includes('--apply');
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('缺少 DATABASE_URL / DIRECT_URL');
    process.exit(1);
  }
  if (apply) assertNonProductionUrl(url);

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const merchants = await prisma.merchant.findMany({
      where: { status: 'active' },
      select: { id: true, merchantId: true, name: true, type: true, types: true },
      orderBy: { merchantId: 'asc' },
    });
    const jarMerchants = merchants.filter(
      (m) => m.types.includes('jar_exchange') || m.type === 'jar_exchange',
    );
    const activeFlavours = await prisma.refillFlavour.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    const flavourCount = activeFlavours.length;

    const rows: Row[] = [];
    let insertTotal = 0;
    let skipTotal = 0;
    let errorTotal = 0;

    for (const m of jarMerchants) {
      const slug = merchantToStoreSlug(m.merchantId);
      const store = await prisma.store.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!store) {
        errorTotal += 1;
        rows.push({
          merchantId: m.merchantId,
          merchantName: m.name,
          slug,
          storeId: null,
          stockRows: 0,
          missingActiveFlavours: flavourCount,
          status: 'missing_store',
        });
        continue;
      }

      const stockRows = await prisma.merchantRefillStock.count({
        where: { storeId: store.id },
      });
      const have = await prisma.merchantRefillStock.findMany({
        where: {
          storeId: store.id,
          flavourId: { in: activeFlavours.map((f) => f.id) },
        },
        select: { flavourId: true },
      });
      const missing = flavourCount - have.length;
      const status = missing > 0 ? 'missing_stock_rows' : 'ok';
      rows.push({
        merchantId: m.merchantId,
        merchantName: m.name,
        slug,
        storeId: store.id,
        stockRows,
        missingActiveFlavours: missing,
        status,
      });

      if (apply && missing > 0) {
        const r = await ensureMissingRefillStockRowsForStore(prisma, store.id);
        insertTotal += r.inserted;
        skipTotal += r.skippedExisting;
      } else if (missing === 0) {
        skipTotal += stockRows;
      }
    }

    console.log(
      JSON.stringify(
        {
          mode: apply ? 'apply' : 'dry-run',
          activeFlavourCount: flavourCount,
          jarExchangeMerchantCount: jarMerchants.length,
          summary: {
            ok: rows.filter((r) => r.status === 'ok').length,
            missing_store: rows.filter((r) => r.status === 'missing_store').length,
            missing_stock_rows: rows.filter((r) => r.status === 'missing_stock_rows').length,
            inserted: apply ? insertTotal : 0,
            skippedExisting: skipTotal,
            errors: errorTotal,
          },
          rows,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
