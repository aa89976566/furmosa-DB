import Link from 'next/link';
import { getAuthenticatedMerchantId, requireMerchantSession } from '@/lib/merchant-auth';
import { prisma } from '@/lib/prisma';
import { PosShell } from '@/components/pos/pos-shell';
import { Card, CardContent } from '@/components/ui/card';

export const metadata = { title: '銷售紀錄 · Furmosa 店家' };
export const dynamic = 'force-dynamic';

const paymentLabels: Record<string, string> = {
  unpaid: '尚未付款',
  partial: '部分付款',
  paid: '已付款',
  cod: '貨到付款',
  refunded: '已退款',
};

function formatMoney(value: number) {
  return `NT$${Math.round(value).toLocaleString('zh-TW')}`;
}

export default async function PosSalesPage() {
  await requireMerchantSession();
  const merchantId = await getAuthenticatedMerchantId();
  const orders = await prisma.order.findMany({
    where: { merchantId },
    orderBy: { orderedAt: 'desc' },
    take: 100,
    select: {
      id: true,
      orderNumber: true,
      orderedAt: true,
      total: true,
      paymentStatus: true,
      status: true,
      items: {
        select: { productName: true, quantity: true, unitPrice: true },
      },
    },
  });

  return (
    <PosShell>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <header className="mb-6 border-b border-[#e7e5e4] pb-5">
          <Link href="/pos/records" className="text-sm text-muted-foreground">
            ← 紀錄
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-[#191919]">銷售紀錄</h1>
          <p className="mt-1 text-sm text-muted-foreground">查看門市訂單、商品與付款狀態。</p>
        </header>

        {orders.length === 0 ? (
          <Card className="border-[#e7e5e4] bg-white shadow-none">
            <CardContent className="p-6 text-sm text-muted-foreground">
              目前沒有門市銷售紀錄。
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#e7e5e4] bg-white">
            {orders.map((order) => (
              <article
                key={order.id}
                className="border-b border-[#e7e5e4] p-4 last:border-b-0 sm:p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#191919]">{order.orderNumber}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {order.orderedAt.toLocaleString('zh-TW', {
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold text-[#191919]">{formatMoney(order.total)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {paymentLabels[order.paymentStatus] ?? order.paymentStatus}
                    </p>
                  </div>
                </div>
                <div className="mt-4 space-y-1 border-t border-[#e7e5e4] pt-3 text-sm">
                  {order.items.map((item, index) => (
                    <div key={`${order.id}-${index}`} className="flex justify-between gap-4">
                      <span className="min-w-0 truncate text-[#4f4f4f]">
                        {item.productName} × {item.quantity}
                      </span>
                      <span className="shrink-0 text-[#191919]">
                        {formatMoney(item.unitPrice * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </PosShell>
  );
}
