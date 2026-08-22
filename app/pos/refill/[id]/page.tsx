import { requireMerchantSession } from '@/lib/merchant-auth';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { PosShell } from '@/components/pos/pos-shell';
import { RefillOrderActions } from '@/components/pos/refill-order-actions';
import { formatLocalDate, formatLocalTime } from '@/lib/booking/availability';
import { getLiffUrlIfConfigured } from '@/lib/line/liff-config';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function PosRefillDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireMerchantSession();
  const order = await prisma.refillOrder.findUnique({
    where: { id: params.id },
    include: {
      merchant: { select: { id: true, name: true, merchantId: true } },
      appointment: { select: { startsAt: true, petName: true } },
      customer: { select: { name: true } },
      payments: { orderBy: { createdAt: 'desc' }, take: 3 },
    },
  });

  if (!order || order.merchantId !== session.merchantId) {
    notFound();
  }

  const paid =
    Boolean(order.paidAt) || order.payments.some((p) => p.status === 'paid');
  const liffBase = getLiffUrlIfConfigured('refill');
  const payQrUrl = liffBase
    ? `${liffBase}?storeId=${encodeURIComponent(order.merchant.merchantId)}`
    : null;
  const availableReturnQuantity = await prisma.jarCode.count({
    where: {
      redeemedByCustomerId: order.customerId,
      status: 'issued',
      OR: [
        { lockedByRefillOrderId: null },
        { lockedByRefillOrderId: order.id },
      ],
    },
  });
  const remainingQuantity = Math.max(0, order.quantity - order.fulfilledQuantity);

  return (
    <PosShell>
      <div className="px-4 py-6 space-y-5">
        <div className="flex items-center justify-between">
          <Button asChild variant="ghost" className="min-h-[44px] px-2">
            <Link href="/pos/refill">← 待換罐</Link>
          </Button>
        </div>

        <header>
          <h1 className="text-xl font-semibold">
            {order.petName ?? order.appointment.petName ?? '毛孩'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {order.customer.name} · {formatLocalDate(order.appointment.startsAt)}{' '}
            {formatLocalTime(order.appointment.startsAt)}
          </p>
        </header>

        <dl className="space-y-2 text-sm rounded-xl border p-4">
          <Row label="商品" value={order.orderType === 'first' ? '首罐' : '換罐'} />
          <Row label="指定店家" value={order.merchant.name} />
          <Row label="付款" value={paid ? `已付款 NT$${order.totalAmount}` : '尚未付款'} />
          <Row label="待領取" value={`${remainingQuantity}／${order.quantity} 罐`} />
          <Row
            label="空罐"
            value={
              order.deliveryMode === 'first'
                ? '不需回收（首罐／補差額）'
                : order.oldContainerSerial
                  ? `已收 ${order.oldContainerSerial}`
                  : '等待收空罐'
            }
          />
          <Row
            label="交付"
            value={
              order.status === 'completed'
                ? `已交付 ${order.newContainerSerial ?? ''}`
                : '尚未交付'
            }
          />
          {order.missingContainerNote ? (
            <Row label="備註" value={order.missingContainerNote} />
          ) : null}
        </dl>

        <RefillOrderActions
          orderId={order.id}
          status={order.status}
          paid={paid}
          payQrUrl={payQrUrl}
          remainingQuantity={remainingQuantity}
          availableReturnQuantity={availableReturnQuantity}
        />
      </div>
    </PosShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-right">{value}</dd>
    </div>
  );
}
