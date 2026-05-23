import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';
import { MerchantStockFilterLinks } from '@/components/merchants/merchant-stock-filter-links';
import { MerchantStockTxnTable } from '@/components/merchants/merchant-stock-txn-table';
import {
  buildMerchantStockTxnWhere,
  parseMerchantStockLedgerSearchParams,
} from '@/lib/merchant-stock-query';

export const dynamic = 'force-dynamic';

export default async function MerchantLedgerPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const merchant = await prisma.merchant.findUnique({
    where: { id: params.id },
    select: { id: true, name: true },
  });
  if (!merchant) notFound();

  const filters = parseMerchantStockLedgerSearchParams(searchParams ?? {});
  const where = buildMerchantStockTxnWhere({ ...filters, merchantId: merchant.id });

  const txns = await prisma.merchantStockTxn.findMany({
    where,
    include: {
      merchant: { select: { id: true, name: true, merchantId: true } },
      product: { select: { id: true, name: true, sku: true } },
      order: { select: { id: true, orderNumber: true } },
      settlement: { select: { id: true, settlementId: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const basePath = `/merchants/${merchant.id}/ledger`;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {merchant.name} 的庫存異動；全站紀錄請至寄賣庫存頁
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/merchants/stock?merchantId=${merchant.id}`}>全站庫存紀錄</Link>
        </Button>
      </div>

      <MerchantStockFilterLinks
        basePath={basePath}
        merchants={[]}
        hideViewTabs
        showMerchantFilter={false}
        filters={{
          type: filters.type,
          month: filters.month,
          settled: filters.settled,
        }}
      />

      <SectionCard title={`動作流水（${txns.length} 筆）`}>
        <MerchantStockTxnTable txns={txns} />
      </SectionCard>
    </div>
  );
}
