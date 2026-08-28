import Link from 'next/link';
import { MerchantTypeBadges } from '@/components/merchants/merchant-type-badges';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  GROOMING_COUPON_DISCOUNT_ZHUWO,
  formatGroomingCouponDiscountAmount,
} from '@/lib/coupons/constants';
import type { PartnerStoreDirectoryRow } from '@/lib/jar-exchange/partner-store-directory';
import { buildUnifiedStoreRedeemUrl } from '@/lib/stores/redeem-url';
import { ExternalLink, Receipt, Store } from 'lucide-react';

function sourceHint(row: PartnerStoreDirectoryRow): string | null {
  if (row.canRedeem && row.hasJarExchangeMerchant) return null;
  if (row.canRedeem) return '尚未標記為換罐後台店家';
  if (row.hasJarExchangeMerchant) return '尚未加入核銷清單';
  return null;
}

function StoreActions({ row }: { row: PartnerStoreDirectoryRow }) {
  return (
    <div className="flex flex-wrap gap-2">
      {row.canRedeem ? (
        <Button variant="outline" size="sm" asChild>
          <a href={buildUnifiedStoreRedeemUrl(row.slug)} target="_blank" rel="noreferrer">
            <ExternalLink className="mr-1 h-3.5 w-3.5" />
            開啟核銷
          </a>
        </Button>
      ) : null}
      {row.canRedeem ? (
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/admin/store-report?store=${encodeURIComponent(row.slug)}`}>
            <Receipt className="mr-1 h-3.5 w-3.5" />
            結帳
          </Link>
        </Button>
      ) : null}
      {row.merchantRecordId ? (
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/merchants/${row.merchantRecordId}`}>
            <Store className="mr-1 h-3.5 w-3.5" />
            店家詳情
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

function StoreIdentity({ row }: { row: PartnerStoreDirectoryRow }) {
  const hint = sourceHint(row);
  return (
    <div className="min-w-0">
      <p className="font-medium text-navy">{row.name}</p>
      <p className="mt-0.5 font-mono text-xs text-muted-foreground">{row.slug}</p>
      {row.namesDiffer && row.merchantName ? (
        <p className="mt-1 text-xs text-muted-foreground">後台店名：{row.merchantName}</p>
      ) : null}
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function RedeemStatusBadge({ canRedeem }: { canRedeem: boolean }) {
  return canRedeem ? (
    <Badge variant="success">可核銷</Badge>
  ) : (
    <Badge variant="muted">未開放核銷</Badge>
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
      <div className="flex items-start justify-between gap-3">
        <StoreIdentity row={row} />
        <RedeemStatusBadge canRedeem={row.canRedeem} />
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
        <StoreActions row={row} />
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
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/20 text-left text-xs text-muted-foreground">
              <th className="px-5 py-3 font-medium">店家</th>
              <th className="px-5 py-3 font-medium">城市</th>
              <th className="px-5 py-3 font-medium">身分類型</th>
              <th className="px-5 py-3 font-medium">功能狀態</th>
              <th className="px-5 py-3 font-medium">美容折價</th>
              <th className="px-5 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.key} className="hover:bg-muted/10">
                <td className="px-5 py-3">
                  <StoreIdentity row={row} />
                </td>
                <td className="px-5 py-3 text-muted-foreground">{row.city ?? '—'}</td>
                <td className="px-5 py-3">
                  <MerchantTypeBadges types={row.types} />
                </td>
                <td className="px-5 py-3">
                  <RedeemStatusBadge canRedeem={row.canRedeem} />
                </td>
                <td className="px-5 py-3">
                  <DiscountBadge amount={row.groomingDiscountAmount} />
                </td>
                <td className="px-5 py-3">
                  <div className="flex justify-end">
                    <StoreActions row={row} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
