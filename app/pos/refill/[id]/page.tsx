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
      product: { select: { name: true } },
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
            <Link href="/pos/refill">← 換罐訂單</Link>
          </Button>
        </div>

        <header className="border-b border-[#e7e5e4] pb-5">
          <p className="text-sm text-muted-foreground">處理換罐訂單</p>
          <h1 className="mt-1 text-2xl font-semibold">
            {order.petName ?? order.appointment.petName ?? '毛孩'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {order.customer.name} · {formatLocalDate(order.appointment.startsAt)}{' '}
            {formatLocalTime(order.appointment.startsAt)}
          </p>
        </header>

        <section aria-labelledby="refill-order-title">
          <h2 id="refill-order-title" className="mb-3 text-base font-semibold">客人買了什麼</h2>
          <dl className="divide-y divide-[#e7e5e4] rounded-xl border border-[#e7e5e4] bg-white px-4 text-sm">
          <Row label="商品" value={order.product?.name ?? (order.orderType === 'first' ? '首罐商品' : '換罐商品')} />
          <Row label="購買數量" value={`${order.quantity} 罐`} />
          <Row label="已領數量" value={`${order.fulfilledQuantity} 罐`} />
          <Row label="還可領取" value={`${remainingQuantity} 罐`} strong />
          <Row label="付款狀態" value={paid ? `已付 NT$${order.totalAmount}` : '尚未付款'} />
          <Row
            label="空罐狀態"
            value={
              order.deliveryMode === 'first'
                ? '這筆不用收空罐'
                : order.oldContainerSerial
                  ? `已收 1 個（${order.oldContainerSerial}）`
                  : '這筆還沒收空罐'
            }
          />
          <Row
            label="交付狀態"
            value={
              order.fulfilledQuantity >= order.quantity
                ? `已全部交付，共 ${order.quantity} 罐`
                : order.fulfilledQuantity > 0
                  ? `已交付 ${order.fulfilledQuantity} 罐，剩 ${remainingQuantity} 罐`
                  : '還沒交付商品'
            }
          />
          {order.missingContainerNote ? (
            <Row label="備註" value={order.missingContainerNote} />
          ) : null}
          </dl>
        </section>

        <section aria-labelledby="refill-action-title">
          <div className="mb-3">
            <h2 id="refill-action-title" className="text-base font-semibold">這次怎麼交付</h2>
            <p className="text-sm text-muted-foreground">先填這次給客人的商品數量，再填收到的空罐數量。</p>
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

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex min-h-[52px] items-center justify-between gap-3 py-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`text-right ${strong ? 'text-base font-semibold' : 'font-medium'}`}>{value}</dd>
    </div>
  );
}
