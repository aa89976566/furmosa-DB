import { requireMerchantSession } from '@/lib/merchant-auth';
import { prisma } from '@/lib/prisma';
import {
  listMerchantJarExchangeMembers,
  listMerchantRefillOrders,
} from '@/lib/refill/merchant';
import { loadPosAccount } from '@/lib/pos/account';
import { RefillWorkspace } from '@/components/pos/refill-workspace';
import { getLiffUrlIfConfigured } from '@/lib/line/liff-config';
import { toPosRefillOrderCard } from '@/lib/pos/refill-view';
import { getRefillRewardPolicyForStore } from '@/lib/coupons/store-discount';

export const metadata = { title: '換罐 · Furmosa 店家' };
export const dynamic = 'force-dynamic';

export default async function PosRefillHubPage(
  props: {
    searchParams?: Promise<{ order?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const session = await requireMerchantSession();
  const [account, rows, members, merchant] = await Promise.all([
    loadPosAccount(session.merchantId, session.username),
    listMerchantRefillOrders(session.merchantId).catch((error) => {
      console.error('[pos.refill]', error);
      return [] as Awaited<ReturnType<typeof listMerchantRefillOrders>>;
    }),
    listMerchantJarExchangeMembers(session.merchantId).catch((error) => {
      console.error('[pos.refill.members]', error);
      return [] as Awaited<ReturnType<typeof listMerchantJarExchangeMembers>>;
    }),
    prisma.merchant.findFirst({
      where: { id: session.merchantId },
      select: { merchantId: true, name: true },
    }),
  ]);

  const liffBase = getLiffUrlIfConfigured('refill');
  const payQrUrl =
    liffBase && merchant?.merchantId
      ? `${liffBase}?storeId=${encodeURIComponent(merchant.merchantId)}`
      : null;

  return (
    <RefillWorkspace
      account={account}
      initialOrders={rows.map(toPosRefillOrderCard)}
      initialMembers={members}
      initialOrderId={searchParams?.order ?? null}
      payQrUrl={payQrUrl}
      rewardPolicy={getRefillRewardPolicyForStore(
        merchant?.merchantId ?? '',
        merchant?.name ?? null,
      )}
    />
  );
}
