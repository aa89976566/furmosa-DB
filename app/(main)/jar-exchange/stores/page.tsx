import Link from 'next/link';
import { JarPanel, JarShell } from '@/components/jar-exchange/jar-shell';
import { MerchantTypeBadges } from '@/components/merchants/merchant-type-badges';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { listJarExchangeMerchants } from '@/lib/jar-exchange/partner-merchants';
import { formatCurrency } from '@/lib/format';
import {
  GROOMING_COUPON_DISCOUNT_DEFAULT,
  GROOMING_COUPON_DISCOUNT_ZHUWO,
  formatGroomingCouponDiscountAmount,
  getGroomingCouponDiscountForStore,
} from '@/lib/coupons/constants';
import { buildUnifiedStoreRedeemUrl } from '@/lib/stores/redeem-url';
import { listPartnerStoresFromDb } from '@/lib/stores/partner-stores';
import { merchantToStoreSlug } from '@/lib/stores/sync-merchant-stores';
import { cn } from '@/lib/utils';
import { ExternalLink, Link2, Store } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function JarExchangeStoresPage() {
  const [stores, merchants] = await Promise.all([
    listPartnerStoresFromDb(),
    listJarExchangeMerchants(),
  ]);

  return (
    <JarShell
      pathname="/jar-exchange/stores"
      title="合作店家"
      description={`LINE 開戶、美容折價券核銷（豬窩 ${formatCurrency(GROOMING_COUPON_DISCOUNT_ZHUWO)}、其他店家 ${formatCurrency(GROOMING_COUPON_DISCOUNT_DEFAULT)}）· 統一由店員選擇分店後輸入優惠碼`}
    >
      <div className="space-y-6">
        <JarPanel>
          <div className="border-b border-border/60 px-5 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-navy">核銷合作店家</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  會員開戶與折價券核銷共用此清單，共 {stores.length} 家
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/store-report">
                  查看核銷報表
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {stores.map((store) => (
              <StoreCard
                key={store.slug}
                name={store.name}
                slug={store.slug}
                groomingDiscountAmount={store.groomingDiscountAmount}
              />
            ))}
          </div>

          <div className="border-t border-border/60 bg-muted/20 px-5 py-4">
            <p className="text-xs font-medium text-muted-foreground">統一核銷入口</p>
            <p className="mt-2 break-all font-mono text-xs text-foreground/90">
              {buildUnifiedStoreRedeemUrl()}
            </p>
          </div>
        </JarPanel>

        <JarPanel>
          <div className="border-b border-border/60 px-5 py-4">
            <h2 className="text-base font-semibold text-navy">換罐計畫店家（後台類型）</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              寄賣後台標記為「換罐」的店家，共 {merchants.length} 家
            </p>
          </div>

          {merchants.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              尚無標記為換罐的店家
            </p>
          ) : (
            <>
              <div className="lg:hidden">
                {merchants.map((merchant) => {
                  const slug = merchantToStoreSlug(merchant.merchantId);
                  const discount = getGroomingCouponDiscountForStore(slug, merchant.name);
                  return (
                    <article
                      key={merchant.id}
                      className="space-y-3 border-b border-border/70 px-5 py-4 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <h3 className="break-words font-medium text-ink">{merchant.name}</h3>
                        <p className="font-mono text-xs text-muted-foreground">
                          {merchant.merchantId}
                        </p>
                      </div>
                      <dl className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <dt className="text-[11px] text-muted-foreground">城市</dt>
                          <dd>{merchant.city ?? '—'}</dd>
                        </div>
                        <div>
                          <dt className="text-[11px] text-muted-foreground">美容折價券</dt>
                          <dd className="mt-1">
                            <Badge
                              variant={
                                discount === GROOMING_COUPON_DISCOUNT_ZHUWO
                                  ? 'warning'
                                  : 'secondary'
                              }
                            >
                              {formatGroomingCouponDiscountAmount(discount)}
                            </Badge>
                          </dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="text-[11px] text-muted-foreground">類型</dt>
                          <dd className="mt-1">
                            <MerchantTypeBadges types={merchant.types} />
                          </dd>
                        </div>
                      </dl>
                      <div className="flex justify-end border-t border-border/50 pt-3">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/merchants/${merchant.id}`}>查看</Link>
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b bg-muted/20 text-left text-xs text-muted-foreground">
                      <th className="whitespace-nowrap px-5 py-3 font-medium">編號</th>
                      <th className="min-w-[10rem] px-5 py-3 font-medium">店家名稱</th>
                      <th className="whitespace-nowrap px-5 py-3 font-medium">城市</th>
                      <th className="whitespace-nowrap px-5 py-3 font-medium">美容折價券</th>
                      <th className="px-5 py-3 font-medium">類型</th>
                      <th className="px-5 py-3 text-right font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {merchants.map((merchant) => {
                      const slug = merchantToStoreSlug(merchant.merchantId);
                      const discount = getGroomingCouponDiscountForStore(slug, merchant.name);
                      return (
                        <tr key={merchant.id} className="align-top hover:bg-muted/10">
                          <td className="whitespace-nowrap px-5 py-3 font-mono text-xs">
                            {merchant.merchantId}
                          </td>
                          <td className="max-w-[14rem] break-words px-5 py-3 font-medium">
                            {merchant.name}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">
                            {merchant.city ?? '—'}
                          </td>
                          <td className="px-5 py-3">
                            <Badge
                              variant={
                                discount === GROOMING_COUPON_DISCOUNT_ZHUWO
                                  ? 'warning'
                                  : 'secondary'
                              }
                            >
                              {formatGroomingCouponDiscountAmount(discount)}
                            </Badge>
                          </td>
                          <td className="px-5 py-3">
                            <MerchantTypeBadges types={merchant.types} />
                          </td>
                          <td className="px-5 py-3 text-right">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/merchants/${merchant.id}`}>查看</Link>
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </JarPanel>
      </div>
    </JarShell>
  );
}

function StoreCard({
  name,
  slug,
  groomingDiscountAmount,
}: {
  name: string;
  slug: string;
  groomingDiscountAmount: number;
}) {
  const redeemUrl = buildUnifiedStoreRedeemUrl(slug);
  const initial = name.trim().charAt(0) || '店';

  return (
    <article className="rounded-2xl border border-border/70 bg-card p-4 shadow-card transition-colors hover:border-primary/20">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-sm font-semibold text-primary ring-1 ring-inset ring-primary/15',
          )}
        >
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-navy">{name}</h3>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{slug}</p>
          <Badge className="mt-2" variant={groomingDiscountAmount === GROOMING_COUPON_DISCOUNT_ZHUWO ? 'warning' : 'secondary'}>
            美容折 {formatGroomingCouponDiscountAmount(groomingDiscountAmount)}
          </Badge>
        </div>
        <Store className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link2 className="h-3.5 w-3.5" />
          核銷連結
        </div>
        <p className="break-all font-mono text-[11px] leading-relaxed text-foreground/85">
          {redeemUrl}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <a href={redeemUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="mr-1 h-3.5 w-3.5" />
            開啟核銷
          </a>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/admin/store-report?store=${encodeURIComponent(slug)}`}>結帳報表</Link>
        </Button>
      </div>
    </article>
  );
}
