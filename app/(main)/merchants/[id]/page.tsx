import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getMerchantShell } from '@/lib/merchants/load-merchant-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/format';
import { MerchantTypeBadges } from '@/components/merchants/merchant-type-badges';
import { merchantIndustryDisplay } from '@/lib/labels';
import { MerchantOperationsHub } from './merchant-operations-hub';
import { MerchantShippingPanel } from '@/components/merchants/merchant-shipping-panel';
import {
  MerchantDlRow,
  MerchantSection,
  MerchantStat,
  MerchantStatGrid,
  MerchantWorkspace,
} from '@/components/merchants/merchant-ui';
import { merchantCarrierLabel } from '@/lib/merchant-shipping-defaults';
import { CARRIER_711 } from '@/lib/carrier-cvs';
import { ChevronRight, MapPin } from 'lucide-react';

export const dynamic = 'force-dynamic';

type BadgeVariant = 'success' | 'info' | 'warning' | 'secondary' | 'destructive';
const stockTxnTypeLabel: Record<string, string> = {
  restock: '進貨',
  sale: '銷售',
  adjust: '盤點',
  return: '退回',
};
const stockTxnTypeStyle: Record<string, BadgeVariant> = {
  restock: 'success',
  sale: 'info',
  adjust: 'warning',
  return: 'secondary',
};

export default async function MerchantOverviewPage({
  params,
}: {
  params: { id: string };
}) {
  const [merchant, shell] = await Promise.all([
    prisma.merchant.findUnique({
      where: { id: params.id },
      include: {
        productRules: { select: { id: true } },
        stocks: { select: { quantity: true, productId: true } },
        stockTxns: {
          include: { product: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    }),
    getMerchantShell(params.id),
  ]);
  if (!merchant) notFound();

  const industry = shell.industry;
  const types = shell.types;

  const productCount = new Set([
    ...merchant.stocks.map((s) => s.productId),
    ...merchant.productRules.map((r) => r.id),
  ]).size;
  const totalStockUnits = merchant.stocks.reduce((s, r) => s + r.quantity, 0);
  const lowStock = merchant.stocks.filter((r) => r.quantity > 0 && r.quantity <= 3).length;
  const outOfStock = merchant.stocks.filter((r) => r.quantity === 0).length;

  return (
    <MerchantWorkspace>
      <MerchantStatGrid>
        <MerchantStat label="商品總數" value={productCount} suffix="項" />
        <MerchantStat label="目前在店庫存" value={totalStockUnits} suffix="件" />
        <MerchantStat
          label="缺貨 / 庫存緊張"
          value={`${outOfStock} / ${lowStock}`}
          tone={outOfStock > 0 ? 'danger' : lowStock > 0 ? 'warning' : 'default'}
        />
      </MerchantStatGrid>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <MerchantSection title="常用操作" description="進貨、清點、銷售與結算入口">
            <MerchantOperationsHub merchantId={merchant.id} />
          </MerchantSection>

          <MerchantSection
            title="最近動作"
            description="最新五筆庫存異動"
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/merchants/${merchant.id}/ledger`}>
                  查看全部
                  <ChevronRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            }
            contentClassName="px-0 py-0"
          >
            {merchant.stockTxns.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">尚無紀錄</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {merchant.stockTxns.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Badge variant={stockTxnTypeStyle[t.type] ?? 'secondary'}>
                        {stockTxnTypeLabel[t.type] ?? t.type}
                      </Badge>
                      <Link
                        href={`/products/${t.productId}`}
                        className="truncate font-medium hover:underline"
                      >
                        {t.product.name}
                      </Link>
                    </div>
                    <div className="flex items-center gap-4 whitespace-nowrap">
                      <span
                        className={
                          t.quantity > 0
                            ? 'font-mono font-semibold text-success'
                            : t.quantity < 0
                              ? 'font-mono font-semibold text-destructive'
                              : 'font-mono'
                        }
                      >
                        {t.quantity > 0 ? '+' : ''}
                        {t.quantity}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(t.createdAt)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </MerchantSection>
        </div>

        <MerchantSection title="店家資料" description="基本檔案與聯絡方式">
          <dl>
            <MerchantDlRow
              label="編號"
              value={<span className="font-mono text-xs">{merchant.merchantId}</span>}
            />
            <MerchantDlRow label="類型" value={<MerchantTypeBadges types={types} />} />
            <MerchantDlRow label="產業" value={merchantIndustryDisplay(industry)} />
            <MerchantDlRow
              label="預設物流"
              value={merchantCarrierLabel(merchant.preferredCarrier)}
            />
            {merchant.preferredCarrier === CARRIER_711 ? (
              <MerchantDlRow label="7-11 門市" value={merchant.pickupStoreName ?? '—'} />
            ) : merchant.preferredCarrier === '黑貓' ||
              merchant.preferredCarrier === '送貨' ? (
              <MerchantDlRow
                label={merchant.preferredCarrier === '送貨' ? '送貨地址' : '收件地址'}
                value={
                  merchant.address ? (
                    <span className="inline-flex max-w-[12rem] items-start justify-end gap-1 text-right">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="break-words">{merchant.address}</span>
                    </span>
                  ) : (
                    '—'
                  )
                }
              />
            ) : null}
            <MerchantDlRow label="聯絡人" value={merchant.contactName ?? '—'} />
            <MerchantDlRow label="電話" value={merchant.phone ?? '—'} />
            <MerchantDlRow label="城市" value={merchant.city ?? '—'} />
          </dl>

          <MerchantShippingPanel
            merchant={{
              id: merchant.id,
              types,
              industry,
              contactName: merchant.contactName,
              phone: merchant.phone,
              email: merchant.email,
              city: merchant.city,
              address: merchant.address,
              preferredCarrier: merchant.preferredCarrier,
              pickupStoreName: merchant.pickupStoreName,
            }}
          />

          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            寄賣分潤（20%／30%）請至
            <Link
              href={`/merchants/${merchant.id}/products`}
              className="font-medium text-primary hover:underline"
            >
              商品與庫存
            </Link>
            依商品設定。
          </p>
        </MerchantSection>
      </div>
    </MerchantWorkspace>
  );
}
