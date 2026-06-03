import { StoreCouponRedeemForm } from '@/components/coupons/store-coupon-redeem-form';
import { listPartnerStoresFromDb } from '@/lib/stores/partner-stores';

export const dynamic = 'force-dynamic';

type Props = { searchParams?: { store?: string } };

export default async function StoreRedeemPage({ searchParams }: Props) {
  const stores = await listPartnerStoresFromDb();
  const defaultStoreSlug = searchParams?.store?.trim();

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-white p-4 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">換罐驗證</p>
        <h2 className="mt-1 text-lg font-bold text-navy">匠寵驗證系統</h2>
        <p className="mt-2 text-sm text-muted-foreground">請選擇店家並輸入會員出示的優惠碼</p>
      </div>
      <StoreCouponRedeemForm
        stores={stores.map((s) => ({ slug: s.slug, name: s.name }))}
        defaultStoreSlug={defaultStoreSlug}
      />
    </div>
  );
}
