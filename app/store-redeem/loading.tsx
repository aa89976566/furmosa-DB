import { StoreRedeemPageContent } from '@/components/coupons/store-redeem-page-content';
import { listRedeemStoresSync } from '@/lib/stores/list-redeem-stores';

export default function StoreRedeemLoading() {
  const stores = listRedeemStoresSync();

  return (
    <StoreRedeemPageContent
      stores={stores}
      defaultStoreSlug={undefined}
    />
  );
}
