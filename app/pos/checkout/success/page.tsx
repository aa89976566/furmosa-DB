import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { PosShell } from '@/components/pos/pos-shell';
import { requireMerchantSession } from '@/lib/merchant-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function money(value: number) {
  return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(value);
}

export default async function CheckoutSuccessPage({ searchParams }: { searchParams: { order?: string } }) {
  const session = await requireMerchantSession();
  const orderNumber = String(searchParams.order ?? '');
  const order = await prisma.order.findFirst({
    where: { orderNumber, merchantId: session.merchantId, source: 'consignment' },
    include: { items: true },
  });
  if (!order) notFound();

  return (
    <PosShell>
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="rounded-2xl border border-[#e7e5e4] bg-white p-6 shadow-sm sm:p-8">
          <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          <p className="mt-5 text-sm text-muted-foreground">銷售已完成</p>
          <h1 className="mt-1 text-2xl font-semibold">已收款 {money(order.total)}</h1>
          <p className="mt-2 text-sm text-muted-foreground">訂單 {order.orderNumber}，庫存與銷售紀錄已同步更新。</p>
          <ul className="mt-6 divide-y divide-[#eee] border-y border-[#eee]">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-4 py-3 text-sm">
                <span>{item.productName} × {item.quantity}</span>
                <span className="font-medium">{money(item.subtotal)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link href="/pos/checkout" className="flex min-h-[48px] items-center justify-center rounded-xl bg-[#191919] px-4 font-semibold text-white">下一筆銷售</Link>
            <Link href="/pos/sales" className="flex min-h-[48px] items-center justify-center rounded-xl border border-[#d6d3d1] bg-white px-4 font-semibold">查看銷售紀錄</Link>
          </div>
        </div>
      </div>
    </PosShell>
  );
}
