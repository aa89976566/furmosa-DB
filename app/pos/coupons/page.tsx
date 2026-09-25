import { requireMerchantSession } from '@/lib/merchant-auth';
import { loadPosAccount } from '@/lib/pos/account';
import { PosShell } from '@/components/pos/pos-shell';
import { CouponRedemptionWorkspace } from '@/components/pos/coupon-redemption-workspace';
import { resolveCouponStoreForMerchant } from '@/lib/coupons/merchant-store-access';

export const metadata = { title: '美容券核銷 · Furmosa 店家' };
export const dynamic = 'force-dynamic';

export default async function PosCouponsPage() {
  const session = await requireMerchantSession();
  const [account, store] = await Promise.all([
    loadPosAccount(session.merchantId, session.username),
    resolveCouponStoreForMerchant(session.merchantId),
  ]);

  return (
    <PosShell storeName={account.storeName} account={account} wide>
      <div className="h-full overflow-y-auto">
        {store ? (
          <CouponRedemptionWorkspace storeName={store.storeName} />
        ) : (
          <div className="mx-auto max-w-xl px-4 py-12">
            <div className="rounded-3xl border border-amber-300 bg-amber-50 p-6">
              <h1 className="text-xl font-bold">尚未開通美容券核銷</h1>
              <p className="mt-2 text-sm text-muted-foreground">請聯絡匠寵客服完成店家資料綁定；不會影響收銀及庫存功能。</p>
            </div>
          </div>
        )}
      </div>
    </PosShell>
  );
}
