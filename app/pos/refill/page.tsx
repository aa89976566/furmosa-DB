import { requireMerchantSession } from '@/lib/merchant-auth';
import { loadPosAccount, loadPosMerchantProfile } from '@/lib/pos/account';
import { RefillWorkspace } from '@/components/pos/refill-workspace';
import { loadMerchantRefillDashboard } from '@/lib/refill/merchant-dashboard';

export const dynamic = 'force-dynamic';
export const metadata = { title: '換罐 · Furmosa 店家' };

export default async function PosRefillPage() {
  const session = await requireMerchantSession();
  const merchantRequest = loadPosMerchantProfile(session.merchantId);
  const [account, dashboard] = await Promise.all([
    loadPosAccount(session.merchantId, session.username, merchantRequest),
    loadMerchantRefillDashboard(session.merchantId),
  ]);

  return <RefillWorkspace account={account} dashboard={dashboard} />;
}
