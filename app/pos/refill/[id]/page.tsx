import { formatFlavourLabel } from '@/lib/jar-exchange/refill-plan-content';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CheckCircle2, PackageCheck } from 'lucide-react';
import { PosShell } from '@/components/pos/pos-shell';
import { requireMerchantSession } from '@/lib/merchant-auth';
import { loadPosAccount } from '@/lib/pos/account';
import { loadMerchantRefillOrderDetail } from '@/lib/refill/merchant-dashboard';

export const dynamic = 'force-dynamic';
export const metadata = { title: '換罐紀錄 · Furmosa 店家' };

function dateTime(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function orderTypeLabel(orderType: string, deliveryMode: string) {
  return orderType === 'first' || deliveryMode === 'first' ? '第一罐' : '續罐';
}

function statusLabel(status: string) {
  if (status === 'completed') return '已完成交付';
  if (status === 'payment_pending') return '等待付款';
  if (status === 'awaiting_extra_payment') return '等待補差額';
  return '待交付';
}

export default async function PosRefillDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const session = await requireMerchantSession();
  const [account, order] = await Promise.all([
    loadPosAccount(session.merchantId, session.username),
    loadMerchantRefillOrderDetail(session.merchantId, id),
  ]);
  if (!order) notFound();

  const completed = order.status === 'completed';
  return (
    <PosShell storeName={account.storeName} account={account}>
      <main className="mx-auto w-full px-4 py-6 md:px-6">
        <Link
          href="/pos/records"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回紀錄
        </Link>

        <div className="mt-3 rounded-[28px] border border-border bg-card p-5 shadow-sm md:p-7">
          <div className="flex items-start justify-between gap-4 border-b border-border pb-5">
            <div>
              <p className="text-sm font-medium text-[#17613f]">換罐計畫</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">交付紀錄</h1>
              <p className="mt-2 text-sm text-muted-foreground">訂單 {order.id.slice(-8).toUpperCase()}</p>
            </div>
            <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${completed ? 'bg-emerald-50 text-[#17613f]' : 'bg-amber-50 text-amber-800'}`}>
              {statusLabel(order.status)}
            </span>
          </div>

          <section className="py-6">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-[#17613f]">
                {completed ? <CheckCircle2 className="h-6 w-6" /> : <PackageCheck className="h-6 w-6" />}
              </span>
              <div>
                <p className="text-lg font-semibold">{order.customerName}</p>
                <p className="text-sm text-muted-foreground">毛孩：{order.petName || '未填寫'}</p>
              </div>
            </div>
          </section>

          <dl className="divide-y divide-border rounded-2xl bg-muted/35 px-4">
            <DetailRow label="方式" value={`${orderTypeLabel(order.orderType, order.deliveryMode)} · NT$${order.totalAmount}`} />
            <DetailRow label="付款時間" value={dateTime(order.paidAt)} />
            <DetailRow label="完成時間" value={dateTime(order.completedAt)} />
            <DetailRow
              label="交付品項"
              value={order.deliveredItem ? `${formatFlavourLabel(order.deliveredItem.name, order.deliveredItem.weightGrams)} × ${order.deliveredItem.quantity}` : '尚未交付'}
            />
          </dl>

          <p className="mt-5 text-sm leading-6 text-muted-foreground">
            此紀錄由店員完成交付後自動建立，庫存與稽核紀錄已同步更新
          </p>
        </div>
      </main>
    </PosShell>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-4 py-4 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}
