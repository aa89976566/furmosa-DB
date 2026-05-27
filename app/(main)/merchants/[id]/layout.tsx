import { notFound } from 'next/navigation';
import { MerchantTypeBadges } from '@/components/merchants/merchant-type-badges';
import { getMerchantIndustry } from '@/lib/merchant-industry-persist';
import { getMerchantTypes } from '@/lib/merchant-types-persist';
import { prisma } from '@/lib/prisma';
import { Badge } from '@/components/ui/badge';
import { merchantIndustryDisplay } from '@/lib/labels';
import { MerchantBackButton } from './merchant-back-button';
import { MerchantTabs } from './merchant-tabs';

export const dynamic = 'force-dynamic';

export default async function MerchantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const merchantRow = await prisma.merchant.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, merchantId: true, type: true },
  });
  if (!merchantRow) notFound();

  const [industry, types, shipmentsInTransit, draftSettlements] = await Promise.all([
    getMerchantIndustry(prisma, params.id),
    getMerchantTypes(prisma, params.id, merchantRow.type),
    prisma.shipment.count({
      where: { merchantId: params.id, status: { in: ['pending', 'packed', 'shipped'] } },
    }),
    prisma.settlement.count({
      where: { merchantId: params.id, status: { in: ['draft', 'reviewing'] } },
    }),
  ]);

  return (
    <>
      <div className="flex flex-col gap-2 border-b border-border/60 bg-surface-raised px-6 py-5 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{merchantRow.name}</h1>
            <MerchantTypeBadges types={types} />
            {industry ? (
              <Badge variant="outline">{merchantIndustryDisplay(industry)}</Badge>
            ) : null}
          </div>
          <p className="font-mono text-xs text-muted-foreground">{merchantRow.merchantId}</p>
        </div>
        <div className="flex gap-2">
          <MerchantBackButton merchantId={merchantRow.id} />
        </div>
      </div>

      <MerchantTabs
        merchantId={merchantRow.id}
        tabs={[
          { href: '', label: '總覽' },
          { href: 'products', label: '商品與庫存' },
          { href: 'shipments', label: '運送', badge: shipmentsInTransit },
          { href: 'sales', label: '訂單' },
          { href: 'settlement', label: '結算', badge: draftSettlements },
          { href: 'ledger', label: '動作流水' },
        ]}
      />

      <div className="bg-canvas">{children}</div>
    </>
  );
}
