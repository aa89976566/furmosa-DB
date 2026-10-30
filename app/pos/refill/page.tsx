import { requireMerchantSession } from '@/lib/merchant-auth';
import { loadPosAccount, loadPosMerchantProfile } from '@/lib/pos/account';
import { RefillWorkspace } from '@/components/pos/refill-workspace';
import {
  listMerchantJarExchangeMembers,
  listMerchantRefillOrders,
} from '@/lib/refill/merchant';
import { toPosRefillOrderCard } from '@/lib/pos/refill-view';
import { getRefillRewardPolicyForStore } from '@/lib/coupons/store-discount';

export const dynamic = 'force-dynamic';
export const metadata = { title: '換罐 · Furmosa 店家' };

export default async function PosRefillPage() {
  const session = await requireMerchantSession();
  const merchantRequest = loadPosMerchantProfile(session.merchantId);
  const [account, merchant, orders, members] = await Promise.all([
    loadPosAccount(session.merchantId, session.username, merchantRequest),
    merchantRequest,
    listMerchantRefillOrders(session.merchantId),
    listMerchantJarExchangeMembers(session.merchantId),
  ]);

  return (
    <RefillWorkspace
      account={account}
      initialOrders={orders.map(toPosRefillOrderCard)}
      initialMembers={members}
      payQrUrl={null}
      rewardPolicy={getRefillRewardPolicyForStore(
        merchant?.merchantId ?? '',
        merchant?.name,
      )}
    />
  );
}
