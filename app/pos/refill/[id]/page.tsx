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
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between">
          <Button asChild variant="ghost" className="min-h-[44px] px-2">
            <Link href="/pos/refill">← 待換罐</Link>
          </Button>
        </div>

        <header className="border-b border-[#e7e5e4] pb-5">
          <p className="text-sm text-muted-foreground">換罐交付</p>
          <h1 className="mt-1 text-2xl font-semibold">
            {order.petName ?? order.appointment.petName ?? '毛孩'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {order.customer.name} · {formatLocalDate(order.appointment.startsAt)}{' '}
            {formatLocalTime(order.appointment.startsAt)}
          </p>
        </header>

        <section aria-labelledby="refill-order-title">
          <h2 id="refill-order-title" className="mb-3 text-base font-semibold">訂單資料</h2>
          <dl className="divide-y divide-[#e7e5e4] rounded-xl border border-[#e7e5e4] bg-white px-4 text-sm">
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
              order.fulfilledQuantity >= order.quantity
                ? `已全數交付 ${order.quantity}／${order.quantity} 罐`
                : order.fulfilledQuantity > 0
                  ? `已交付 ${order.fulfilledQuantity}／${order.quantity} 罐`
                  : '尚未交付'
            }
          />
          {order.missingContainerNote ? (
            <Row label="備註" value={order.missingContainerNote} />
          ) : null}
          </dl>
        </section>

        <section aria-labelledby="refill-action-title">
          <div className="mb-3">
            <h2 id="refill-action-title" className="text-base font-semibold">本次交付</h2>
            <p className="text-sm text-muted-foreground">選擇領取與歸還數量，確認結果後才會更新庫存。</p>
          </div>
          <RefillOrderActions
            orderId={order.id}
            status={order.status}
            paid={paid}
            payQrUrl={payQrUrl}
            remainingQuantity={remainingQuantity}
            availableReturnQuantity={availableReturnQuantity}
          />
        </section>
      </div>
    </PosShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-[52px] items-center justify-between gap-3 py-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-right">{value}</dd>
    </div>
  );
}
