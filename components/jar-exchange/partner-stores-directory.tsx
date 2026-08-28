import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { formatGroomingCouponDiscountAmount } from '@/lib/coupons/constants';
import {
  partnerStoreExceptionLabel,
  partnerStoreNeedsIdentityNote,
  type PartnerStoreDirectoryRow,
} from '@/lib/jar-exchange/partner-store-directory';
import { buildUnifiedStoreRedeemUrl } from '@/lib/stores/redeem-url';
import { cn } from '@/lib/utils';

function StoreIdentity({ row }: { row: PartnerStoreDirectoryRow }) {
  const exception = partnerStoreExceptionLabel(row);
  const showSlug = partnerStoreNeedsIdentityNote(row);

  return (
    <div className="min-w-0">
      <p className="font-medium text-navy">{row.name}</p>
      {exception ? <p className="mt-1 text-xs text-muted-foreground">{exception}</p> : null}
      {showSlug ? <p className="mt-1 font-mono text-xs text-muted-foreground">{row.slug}</p> : null}
      {row.namesDiffer && row.merchantName ? (
        <p className="mt-1 text-xs text-muted-foreground">後台店名 {row.merchantName}</p>
      ) : null}
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
  const redeemHref = row.canRedeem ? buildUnifiedStoreRedeemUrl(row.slug) : null;
  const settleHref = row.canRedeem
    ? `/admin/store-report?store=${encodeURIComponent(row.slug)}`
    : null;
  const detailHref = row.merchantRecordId ? `/merchants/${row.merchantRecordId}` : null;
  const linkClass = 'underline-offset-4 hover:underline';

  if (layout === 'mobile') {
    return (
      <div className="mt-4 space-y-2">
        {redeemHref ? (
          <Button variant="outline" className="h-11 w-full" asChild>
            <a href={redeemHref} target="_blank" rel="noreferrer">
              開啟核銷
            </a>
          </Button>
        ) : null}
        <div className="flex flex-wrap gap-x-4 text-sm">
          {settleHref ? (
            <Link href={settleHref} className={cn(linkClass, 'text-navy')}>
              結帳
            </Link>
          ) : null}
          {detailHref ? (
            <Link href={detailHref} className={cn(linkClass, 'text-muted-foreground')}>
              店家詳情
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap justify-end gap-x-4 text-sm">
      {redeemHref ? (
        <a
          href={redeemHref}
          target="_blank"
          rel="noreferrer"
          className={cn(linkClass, 'font-medium text-navy')}
        >
          核銷
        </a>
      ) : null}
      {settleHref ? (
        <Link href={settleHref} className={cn(linkClass, 'text-navy')}>
          結帳
        </Link>
      ) : null}
      {detailHref ? (
        <Link href={detailHref} className={cn(linkClass, 'text-muted-foreground')}>
          詳情
        </Link>
      ) : null}
    </div>
  );
}

function StoreCard({ row }: { row: PartnerStoreDirectoryRow }) {
  return (
    <article className="border-b border-border/60 py-4 last:border-b-0">
      <div className="flex items-start justify-between gap-4">
        <StoreIdentity row={row} />
        <p className="shrink-0 text-sm tabular-nums text-muted-foreground">
          {formatGroomingCouponDiscountAmount(row.groomingDiscountAmount)}
        </p>
      </div>
      <StoreActions row={row} layout="mobile" />
    </article>
  );
}

export function PartnerStoresDirectory({ rows }: { rows: PartnerStoreDirectoryRow[] }) {
  if (rows.length === 0) {
    return <p className="px-5 py-12 text-center text-sm text-muted-foreground">目前沒有合作店家。</p>;
  }

  return (
    <>
      <div className="divide-y px-5 md:hidden">
        {rows.map((row) => (
          <StoreCard key={row.key} row={row} />
        ))}
      </div>

      <table className="hidden w-full text-sm md:table">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="px-5 py-3 font-medium">店家</th>
            <th className="px-5 py-3 font-medium">折價</th>
            <th className="px-5 py-3 text-right font-medium">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.key} className="align-top">
              <td className="px-5 py-3">
                <StoreIdentity row={row} />
              </td>
              <td className="px-5 py-3 tabular-nums text-muted-foreground">
                {formatGroomingCouponDiscountAmount(row.groomingDiscountAmount)}
              </td>
              <td className="px-5 py-3">
                <StoreActions row={row} layout="desktop" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
