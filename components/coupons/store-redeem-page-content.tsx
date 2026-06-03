import { StoreCouponRedeemForm } from '@/components/coupons/store-coupon-redeem-form';
import type { RedeemStoreOption } from '@/lib/stores/list-redeem-stores';

export function StoreRedeemPageContent({
  stores,
  defaultStoreSlug,
  storeLabel,
  lockedStore = false,
}: {
  stores: RedeemStoreOption[];
  defaultStoreSlug?: string;
  /** 專屬連結進入時顯示鎖定店家 */
  storeLabel?: string | null;
  lockedStore?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/70 bg-white p-4 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">換罐驗證</p>
        <h2 className="mt-1 text-lg font-bold text-navy">匠寵驗證系統</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {storeLabel
            ? `目前店家：${storeLabel} · 請輸入會員出示的優惠碼`
            : '請選擇店家並輸入會員出示的優惠碼'}
        </p>
      </div>

      {stores.length === 0 ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          無法載入合作店家清單，請稍後再試或聯絡匠寵客服。
        </div>
      ) : (
        <StoreCouponRedeemForm
          stores={stores}
          defaultStoreSlug={defaultStoreSlug}
          lockedStoreSlug={lockedStore ? defaultStoreSlug : undefined}
        />
      )}
    </div>
  );
}
