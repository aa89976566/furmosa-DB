import { StoreRedeemPageContent } from '@/components/coupons/store-redeem-page-content';
import { listRedeemStores } from '@/lib/stores/list-redeem-stores';

/**
 * ISR：店家清單可快取 → HTML 可被 Vercel CDN HIT
 * ?store= 改由客戶端讀取，避免 searchParams 強迫整頁 dynamic
 */
export const revalidate = 60;
export const runtime = 'nodejs';

export default async function StoreRedeemPage() {
  const stores = await listRedeemStores();
  return <StoreRedeemPageContent stores={stores} />;
}
