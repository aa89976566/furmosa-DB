import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { Badge } from '@/components/ui/badge';
import { merchantTypeLabel } from '@/lib/labels';
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
  const [merchant, shipmentsInTransit, draftSettlements] = await Promise.all([
    prisma.merchant.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, merchantId: true, type: true },
    }),
    prisma.shipment.count({
      where: { merchantId: params.id, status: { in: ['pending', 'packed', 'shipped'] } },
    }),
    prisma.settlement.count({
      where: { merchantId: params.id, status: { in: ['draft', 'reviewing'] } },
    }),
  ]);
  if (!merchant) notFound();

  return (
    <>
      <div className="flex flex-col gap-2 border-b border-border/60 bg-surface-raised px-6 py-5 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{merchant.name}</h1>
            <Badge variant="secondary">{merchantTypeLabel[merchant.type]}</Badge>
          </div>
          <p className="font-mono text-xs text-muted-foreground">{merchant.merchantId}</p>
        </div>
        <div className="flex gap-2">
          <MerchantBackButton merchantId={merchant.id} />
        </div>
      </div>

      <MerchantTabs
        merchantId={merchant.id}
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
