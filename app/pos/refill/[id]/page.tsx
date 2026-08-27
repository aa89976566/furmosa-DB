import { requireMerchantSession } from '@/lib/merchant-auth';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { PosShell } from '@/components/pos/pos-shell';
import { RefillOrderActions } from '@/components/pos/refill-order-actions';
import { getLiffUrlIfConfigured } from '@/lib/line/liff-config';
import { loadPosAccount } from '@/lib/pos/account';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function PosRefillDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireMerchantSession();
  const [account, order] = await Promise.all([
    loadPosAccount(session.merchantId, session.username),
    prisma.refillOrder.findUnique({
      where: { id: params.id },
      include: {
        merchant: { select: { id: true, name: true, merchantId: true } },
        appointment: { select: { startsAt: true, petName: true } },
        customer: { select: { name: true } },
        payments: { orderBy: { createdAt: 'desc' }, take: 3 },
      },
    }),
  ]);

  if (!order || order.merchantId !== session.merchantId) {
    notFound();
  }

  const paid = Boolean(order.paidAt) || order.payments.some((p) => p.status === 'paid');
  const liffBase = getLiffUrlIfConfigured('refill');
  const payQrUrl = liffBase
    ? `${liffBase}?storeId=${encodeURIComponent(order.merchant.merchantId)}`
    : null;

  return (
    <PosShell storeName={account.storeName} account={account}>
      <div className="space-y-5 px-4 py-6 pr-16">
        <Button asChild variant="ghost" className="min-h-[48px] px-2">
          <Link href="/pos/refill">← 換罐</Link>
        </Button>

        <header>
          <h1 className="text-xl font-semibold text-navy">{order.customer.name}</h1>
          <p className="text-sm text-muted-foreground">
            {order.petName ?? order.appointment.petName ?? '毛孩'}
          </p>
        </header>

        <RefillOrderActions
          orderId={order.id}
          status={order.status}
          paid={paid}
          deliveryMode={order.deliveryMode}
          payQrUrl={payQrUrl}
          customerName={order.customer.name}
          oldSerial={order.oldContainerSerial}
          newSerial={order.newContainerSerial}
          missingContainerNote={order.missingContainerNote}
        />
      </div>
    </PosShell>
  );
}
