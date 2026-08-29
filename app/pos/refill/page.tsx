import { requireMerchantSession } from '@/lib/merchant-auth';
import { prisma } from '@/lib/prisma';
import { listMerchantRefillOrders } from '@/lib/refill/merchant';
import { loadPosAccount } from '@/lib/pos/account';
import { RefillWorkspace } from '@/components/pos/refill-workspace';
import { getLiffUrlIfConfigured } from '@/lib/line/liff-config';
import { toPosRefillOrderCard } from '@/lib/pos/refill-view';

export const metadata = { title: '幫客人換罐 · Furmosa 店家' };
export const dynamic = 'force-dynamic';

export default async function PosRefillHubPage({
  searchParams,
}: {
  searchParams?: { order?: string };
}) {
  const session = await requireMerchantSession();
  const [account, rows, merchant] = await Promise.all([
    loadPosAccount(session.merchantId, session.username),
    listMerchantRefillOrders(session.merchantId).catch((error) => {
      console.error('[pos.refill]', error);
      return [] as Awaited<ReturnType<typeof listMerchantRefillOrders>>;
    }),
    prisma.merchant.findFirst({
      where: { id: session.merchantId },
      select: { merchantId: true },
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
      initialOrderId={searchParams?.order ?? null}
      payQrUrl={payQrUrl}
    />
  );
}
