import Link from 'next/link';
import { MerchantTypeBadges } from '@/components/merchants/merchant-type-badges';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  GROOMING_COUPON_DISCOUNT_ZHUWO,
  formatGroomingCouponDiscountAmount,
} from '@/lib/coupons/constants';
import {
  partnerStoreSourceKind,
  partnerStoreSourceLabel,
  type PartnerStoreDirectoryRow,
  type PartnerStoreSourceKind,
} from '@/lib/jar-exchange/partner-store-directory';
import { buildUnifiedStoreRedeemUrl } from '@/lib/stores/redeem-url';
import { cn } from '@/lib/utils';
import { ExternalLink, Receipt, Store } from 'lucide-react';

const sourceBadgeVariant: Record<PartnerStoreSourceKind, 'info' | 'warning' | 'muted'> = {
  both: 'info',
  redeem_only: 'warning',
  backend_only: 'muted',
};

function StatusBadges({ row }: { row: PartnerStoreDirectoryRow }) {
  const source = partnerStoreSourceKind(row);
  return (
    <div className="flex flex-wrap gap-1">
      {row.canRedeem ? (
        <Badge variant="success">可核銷</Badge>
      ) : (
        <Badge variant="muted">未開放核銷</Badge>
      )}
      <Badge variant={sourceBadgeVariant[source]}>{partnerStoreSourceLabel[source]}</Badge>
    </div>
  );
}

function StoreActions({
  row,
  layout,
}: {
  row: PartnerStoreDirectoryRow;
  layout: 'desktop' | 'mobile';
}) {
  const mobile = layout === 'mobile';
  const buttonClass = mobile ? 'h-11 w-full justify-center' : 'h-7 px-2';

  return (
    <div className={cn(mobile ? 'grid gap-2' : 'flex flex-col items-end gap-1')}>
      {row.canRedeem ? (
        <Button variant={mobile ? 'outline' : 'ghost'} size="sm" className={buttonClass} asChild>
          <a href={buildUnifiedStoreRedeemUrl(row.slug)} target="_blank" rel="noreferrer">
            {mobile ? <ExternalLink className="mr-1 h-4 w-4" /> : null}
            {mobile ? '開啟核銷' : '核銷'}
          </a>
        </Button>
      ) : null}
      {row.canRedeem ? (
        <Button variant="ghost" size="sm" className={buttonClass} asChild>
          <Link href={`/admin/store-report?store=${encodeURIComponent(row.slug)}`}>
            {mobile ? <Receipt className="mr-1 h-4 w-4" /> : null}
            結帳
          </Link>
        </Button>
      ) : null}
      {row.merchantRecordId ? (
        <Button variant="ghost" size="sm" className={buttonClass} asChild>
          <Link href={`/merchants/${row.merchantRecordId}`}>
            {mobile ? <Store className="mr-1 h-4 w-4" /> : null}
            {mobile ? '店家詳情' : '詳情'}
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

function StoreIdentity({ row }: { row: PartnerStoreDirectoryRow }) {
  return (
    <div className="min-w-0">
      <p className="font-medium text-navy">{row.name}</p>
      <p className="mt-0.5 font-mono text-xs text-muted-foreground">{row.slug}</p>
      {row.namesDiffer && row.merchantName ? (
        <p className="mt-1 text-xs text-muted-foreground">後台店名：{row.merchantName}</p>
      ) : null}
    </div>
  );
}

function DiscountBadge({ amount }: { amount: number }) {
  return (
    <Badge variant={amount === GROOMING_COUPON_DISCOUNT_ZHUWO ? 'warning' : 'secondary'}>
      {formatGroomingCouponDiscountAmount(amount)}
    </Badge>
  );
}

function StoreCard({ row }: { row: PartnerStoreDirectoryRow }) {
  return (
    <article className="rounded-2xl border border-border/70 bg-card p-4 shadow-card">
      <div className="space-y-3">
        <StoreIdentity row={row} />
        <StatusBadges row={row} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">城市</dt>
          <dd className="mt-1">{row.city ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">美容折價</dt>
          <dd className="mt-1">
            <DiscountBadge amount={row.groomingDiscountAmount} />
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-muted-foreground">身分類型</dt>
          <dd className="mt-1">
            <MerchantTypeBadges types={row.types} />
          </dd>
        </div>
      </dl>
      <div className="mt-4">
        <StoreActions row={row} layout="mobile" />
      </div>
    </article>
  );
}

export function PartnerStoresDirectory({ rows }: { rows: PartnerStoreDirectoryRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="px-5 py-12 text-center text-sm text-muted-foreground">
        目前沒有合作店家。核銷清單與換罐後台都還沒有資料。
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3 p-4 md:hidden">
        {rows.map((row) => (
          <StoreCard key={row.key} row={row} />
        ))}
      </div>

      <div className="hidden md:block">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-[28%]" />
            <col className="w-[10%]" />
            <col className="w-[22%]" />
            <col className="w-[20%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
          </colgroup>
          <thead>
            <tr className="border-b bg-muted/20 text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">店家</th>
              <th className="px-4 py-3 font-medium">城市</th>
              <th className="px-4 py-3 font-medium">身分類型</th>
              <th className="px-4 py-3 font-medium">狀態</th>
              <th className="px-4 py-3 font-medium">美容折價</th>
              <th className="px-4 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.key} className="hover:bg-muted/10">
                <td className="px-4 py-3">
                  <StoreIdentity row={row} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">{row.city ?? '—'}</td>
                <td className="px-4 py-3">
                  <MerchantTypeBadges types={row.types} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadges row={row} />
                </td>
                <td className="px-4 py-3">
                  <DiscountBadge amount={row.groomingDiscountAmount} />
                </td>
                <td className="px-4 py-3">
                  <StoreActions row={row} layout="desktop" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
