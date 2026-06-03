import { StoreRedeemPageContent } from '@/components/coupons/store-redeem-page-content';
import { listRedeemStores } from '@/lib/stores/list-redeem-stores';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Props = { searchParams?: { store?: string } };

export default async function StoreRedeemPage({ searchParams }: Props) {
  const stores = await listRedeemStores();
  const defaultStoreSlug = searchParams?.store?.trim();

  return (
    <StoreRedeemPageContent stores={stores} defaultStoreSlug={defaultStoreSlug} />
  );
}
