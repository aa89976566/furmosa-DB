import { MerchantTypeBadges } from '@/components/merchants/merchant-type-badges';
import { getMerchantShell } from '@/lib/merchants/load-merchant-shell';
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
  const shell = await getMerchantShell(params.id);

  return (
    <>
      <div className="flex flex-col gap-2 border-b border-border/60 bg-surface-raised px-6 py-5 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{shell.name}</h1>
            <MerchantTypeBadges types={shell.types} />
            {shell.industry ? (
              <Badge variant="outline">{merchantIndustryDisplay(shell.industry)}</Badge>
            ) : null}
          </div>
          <p className="font-mono text-xs text-muted-foreground">{shell.merchantId}</p>
        </div>
        <div className="flex gap-2">
          <MerchantBackButton merchantId={shell.id} />
        </div>
      </div>

      <MerchantTabs
        merchantId={shell.id}
        tabs={[
          { href: '', label: '總覽' },
          { href: 'settings', label: '合作設定' },
          { href: 'products', label: '商品與庫存' },
          { href: 'shipments', label: '訂單與出貨', badge: shell.shipmentsInTransit },
          { href: 'settlement', label: '帳務', badge: shell.draftSettlements },
          { href: 'account', label: 'POS 帳號' },
        ]}
      />

      <div className="bg-canvas">{children}</div>
    </>
  );
}
