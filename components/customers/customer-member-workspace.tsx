import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { CustomerActivityTimeline } from '@/components/customers/customer-activity-timeline';
import { CustomerDetailTabs } from '@/components/customers/customer-detail-tabs';
import { appointmentStatusLabelForMerchant } from '@/lib/booking/constants';
import {
  refillOrderStatusLabel,
  refillOrderTypeLabel,
} from '@/lib/customers/customer-crm-labels';
import type { CustomerDetailData } from '@/lib/customers/load-customer-detail';
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/format';
import { ledgerSourceLabel } from '@/lib/jar-exchange/labels';
import { orderSourceLabel, orderStatusLabel } from '@/lib/labels';

const couponStatusLabel: Record<string, string> = {
  issued: '未使用',
  used: '已核銷',
  cancelled: '已取消',
};

function TableFrame({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}

function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-8 text-center text-sm text-muted-foreground">
        {children}
      </td>
    </tr>
  );
}

const tableClass = 'w-full min-w-[560px] text-left text-sm';
const headClass = 'border-b border-border text-xs font-medium text-muted-foreground';
const thClass = 'px-3 py-2.5 font-medium';
const tdClass = 'border-b border-border/70 px-3 py-3 align-top';

function PointsTable({ data, compact = false }: { data: CustomerDetailData; compact?: boolean }) {
  const rows = compact ? data.recentPointsLedger.slice(0, 3) : data.recentPointsLedger;
  return (
    <TableFrame>
      <table className={tableClass}>
        <thead className={headClass}>
          <tr><th className={thClass}>點數</th><th className={thClass}>來源</th><th className={thClass}>異動後餘額</th><th className={thClass}>時間</th></tr>
        </thead>
        <tbody>
          {rows.length === 0 ? <EmptyRow colSpan={4}>尚無點數異動紀錄</EmptyRow> : rows.map((row) => (
            <tr key={row.id}>
              <td className={`${tdClass} font-semibold tabular-nums`}>{row.pointsChange > 0 ? '+' : ''}{row.pointsChange}</td>
              <td className={tdClass}>{ledgerSourceLabel[row.sourceType] ?? row.sourceType}{row.note ? <span className="block text-xs text-muted-foreground">{row.note}</span> : null}</td>
              <td className={`${tdClass} tabular-nums`}>{row.balanceAfter}</td>
              <td className={`${tdClass} whitespace-nowrap text-muted-foreground`}>{formatDateTime(row.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableFrame>
  );
}

function CodesTable({ data, compact = false }: { data: CustomerDetailData; compact?: boolean }) {
  const rows = compact ? data.recentRedeemedCodes.slice(0, 3) : data.recentRedeemedCodes;
  return (
    <TableFrame>
      <table className={tableClass}>
        <thead className={headClass}>
          <tr><th className={thClass}>序號</th><th className={thClass}>增加點數</th><th className={thClass}>輸入管道</th><th className={thClass}>輸入時間</th></tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={4}>
              <span className="block font-medium text-foreground">尚無集點序號輸入紀錄</span>
              <span className="mt-1 block text-xs">成功輸入後會保留序號、點數與時間</span>
            </EmptyRow>
          ) : rows.map((row) => (
            <tr key={row.id}>
              <td className={`${tdClass} font-mono text-xs`}>{row.code}</td>
              <td className={`${tdClass} font-semibold tabular-nums`}>+{row.pointValue}</td>
              <td className={`${tdClass} text-muted-foreground`}>未記錄</td>
              <td className={`${tdClass} whitespace-nowrap text-muted-foreground`}>{row.redeemedAt ? formatDateTime(row.redeemedAt) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableFrame>
  );
}

function CouponsTable({ data, compact = false }: { data: CustomerDetailData; compact?: boolean }) {
  const allRows = data.jar?.redemptions ?? [];
  const rows = compact ? allRows.slice(0, 3) : allRows;
  return (
    <TableFrame>
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className={headClass}>
          <tr><th className={thClass}>獎勵</th><th className={thClass}>扣除點數</th><th className={thClass}>優惠券碼</th><th className={thClass}>狀態</th><th className={thClass}>發行／核銷時間</th></tr>
        </thead>
        <tbody>
          {rows.length === 0 ? <EmptyRow colSpan={5}>尚無優惠券兌換紀錄</EmptyRow> : rows.map((row) => (
            <tr key={row.id}>
              <td className={`${tdClass} font-medium`}>{row.reward.rewardName}</td>
              <td className={`${tdClass} tabular-nums`}>−{row.pointsSpent}</td>
              <td className={`${tdClass} font-mono text-xs`}>{row.couponCode ?? '—'}</td>
              <td className={tdClass}>{couponStatusLabel[row.couponStatus] ?? row.couponStatus}</td>
              <td className={`${tdClass} whitespace-nowrap text-muted-foreground`}>
                {formatDateTime(row.issuedAt)}{row.usedAt ? <span className="block text-xs">核銷 {formatDateTime(row.usedAt)}</span> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableFrame>
  );
}

function OrdersTable({ data }: { data: CustomerDetailData }) {
  return (
    <TableFrame>
      <table className="w-full min-w-[650px] text-left text-sm">
        <thead className={headClass}>
          <tr><th className={thClass}>訂單編號</th><th className={thClass}>來源</th><th className={thClass}>狀態</th><th className={thClass}>金額</th><th className={thClass}>建立時間</th></tr>
        </thead>
        <tbody>
          {data.customer.orders.length === 0 ? <EmptyRow colSpan={5}>尚無訂單紀錄</EmptyRow> : data.customer.orders.slice(0, 3).map((order) => (
            <tr key={order.id}>
              <td className={tdClass}><Link href={`/orders/${order.id}`} className="font-mono text-xs font-medium hover:underline">{order.orderNumber}</Link></td>
              <td className={tdClass}>{orderSourceLabel[order.source] ?? order.source}</td>
              <td className={tdClass}>{orderStatusLabel[order.status] ?? order.status}</td>
              <td className={`${tdClass} tabular-nums`}>{formatCurrency(Number(order.total))}</td>
              <td className={`${tdClass} whitespace-nowrap text-muted-foreground`}>{formatDateTime(order.orderedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableFrame>
  );
}

function OperationsSummary({ data }: { data: CustomerDetailData }) {
  if (
    data.openRefillOrders.length === 0
    && data.issuedJars.length === 0
    && data.recentAppointments.length === 0
  ) return null;

  return (
    <div className="mt-6 grid gap-6 border-t border-border pt-5 lg:grid-cols-3 lg:divide-x lg:divide-border">
      <div className="min-w-0">
        <SectionHeading title="待處理換罐" />
        {data.openRefillOrders.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">目前沒有待處理換罐</p>
        ) : (
          <ul className="mt-2 divide-y divide-border text-sm">
            {data.openRefillOrders.slice(0, 3).map((order) => (
              <li key={order.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium">{refillOrderTypeLabel(order.orderType)} · {order.product?.name ?? '未指定商品'}</span>
                  <span className="whitespace-nowrap tabular-nums">NT${formatNumber(order.totalAmount)}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{refillOrderStatusLabel(order.status)} · {order.merchant.name}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="min-w-0 lg:pl-6">
        <SectionHeading title="目前持有罐" />
        {data.issuedJars.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">目前沒有持有中的罐</p>
        ) : (
          <ul className="mt-2 divide-y divide-border text-sm">
            {data.issuedJars.slice(0, 3).map((jar) => (
              <li key={jar.id} className="py-3">
                <span className="font-mono text-xs font-medium">{jar.code}</span>
                <p className="mt-1 text-xs text-muted-foreground">{jar.issuedMerchant?.name ?? '未記錄店家'}{jar.issuedAt ? ` · ${formatDateTime(jar.issuedAt)}` : ''}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="min-w-0 lg:pl-6">
        <SectionHeading title="最近預約" />
        {data.recentAppointments.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">尚無預約紀錄</p>
        ) : (
          <ul className="mt-2 divide-y divide-border text-sm">
            {data.recentAppointments.slice(0, 3).map((appointment) => (
              <li key={appointment.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium">{appointment.serviceName}</span>
                  <span className="text-xs text-muted-foreground">{appointmentStatusLabelForMerchant(appointment.status)}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(appointment.startsAt)} · {appointment.merchant.name}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SectionHeading({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {href ? <Link href={href} className="inline-flex items-center gap-1 text-xs font-medium hover:underline">{linkLabel ?? '查看完整紀錄'}<ChevronRight className="h-3.5 w-3.5" /></Link> : null}
    </div>
  );
}

function Overview({ data }: { data: CustomerDetailData }) {
  const base = `/customers/${data.customer.id}`;
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">換罐與點數摘要</h2>
        {data.hasJar ? <Link href={`${base}/jar-exchange/actions`} className="inline-flex items-center gap-1 text-sm font-medium hover:underline">換罐操作<ChevronRight className="h-4 w-4" /></Link> : null}
      </div>

      <div className="mt-5 grid gap-6 xl:grid-cols-2 xl:divide-x xl:divide-border">
        <div className="min-w-0"><SectionHeading title="最近點數異動" href={`${base}/jar-ledger`} /><div className="mt-2"><PointsTable data={data} compact /></div></div>
        <div className="min-w-0 xl:pl-6"><SectionHeading title="最近集點序號" href={`${base}/jar-codes`} /><div className="mt-2"><CodesTable data={data} compact /></div></div>
      </div>

      <div className="mt-6 border-t border-border pt-5"><SectionHeading title="優惠券狀態" href={`${base}/jar-rewards`} /><div className="mt-2"><CouponsTable data={data} compact /></div></div>
      <div className="mt-6 border-t border-border pt-5"><SectionHeading title="最近訂單" href="/orders" linkLabel="查看全部訂單" /><div className="mt-2"><OrdersTable data={data} /></div></div>

      <OperationsSummary data={data} />

      {data.customer.subscriptions.length > 0 ? (
        <div className="mt-6 border-t border-border pt-5">
          <SectionHeading title="訂閱" href="/subscriptions" linkLabel="查看訂閱" />
          <ul className="mt-3 divide-y divide-border text-sm">{data.customer.subscriptions.map((subscription) => <li key={subscription.id} className="flex items-center justify-between gap-3 py-3"><Link href={`/subscriptions/${subscription.id}`} className="font-medium hover:underline">{subscription.plan.name}</Link><span className="text-muted-foreground">{subscription.status}</span></li>)}</ul>
        </div>
      ) : null}
    </section>
  );
}

export function CustomerMemberWorkspace({ data }: { data: CustomerDetailData }) {
  const base = `/customers/${data.customer.id}`;
  return (
    <CustomerDetailTabs
      items={[
        { value: 'overview', label: '總覽', content: <Overview data={data} /> },
        { value: 'points', label: '點數紀錄', content: <section className="rounded-2xl border border-border bg-card p-5"><SectionHeading title="點數紀錄" href={`${base}/jar-ledger`} /><div className="mt-3"><PointsTable data={data} /></div></section> },
        { value: 'codes', label: '集點序號', content: <section className="rounded-2xl border border-border bg-card p-5"><SectionHeading title="集點序號" href={`${base}/jar-codes`} /><div className="mt-3"><CodesTable data={data} /></div></section> },
        { value: 'coupons', label: '優惠券', content: <section className="rounded-2xl border border-border bg-card p-5"><SectionHeading title="優惠券" href={`${base}/jar-rewards`} /><div className="mt-3"><CouponsTable data={data} /></div></section> },
        { value: 'activity', label: '最近活動', content: <CustomerActivityTimeline data={data} /> },
      ]}
    />
  );
}
