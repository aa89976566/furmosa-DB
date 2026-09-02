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

function SectionHeading({
  title,
  href,
  linkLabel,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {href ? (
        <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium hover:underline">
          {linkLabel ?? '全部'}
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      ) : null}
    </div>
  );
}

function CompactEmpty({ children }: { children: React.ReactNode }) {
  return <p className="mt-5 text-sm text-muted-foreground">{children}</p>;
}

function OverviewPanel({
  title,
  href,
  linkLabel,
  children,
}: {
  title: string;
  href: string;
  linkLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-xl border border-border p-4">
      <SectionHeading title={title} href={href} linkLabel={linkLabel} />
      {children}
    </section>
  );
}

function PointsList({ data, limit }: { data: CustomerDetailData; limit?: number }) {
  const rows = limit ? data.recentPointsLedger.slice(0, limit) : data.recentPointsLedger;
  if (rows.length === 0) return <CompactEmpty>尚無點數異動</CompactEmpty>;

  return (
    <ul className="mt-3 divide-y divide-border">
      {rows.map((row) => (
        <li key={row.id} className="flex min-w-0 items-start justify-between gap-3 py-3 first:pt-1">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{ledgerSourceLabel[row.sourceType] ?? row.sourceType}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDateTime(row.createdAt)} · 餘額 {formatNumber(row.balanceAfter)}
            </p>
            {row.note ? <p className="mt-1 truncate text-xs text-muted-foreground">{row.note}</p> : null}
          </div>
          <span className="shrink-0 text-base font-semibold tabular-nums">
            {row.pointsChange > 0 ? '+' : ''}{formatNumber(row.pointsChange)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function CodesList({ data, limit }: { data: CustomerDetailData; limit?: number }) {
  const rows = limit ? data.recentRedeemedCodes.slice(0, limit) : data.recentRedeemedCodes;
  if (rows.length === 0) return <CompactEmpty>尚無集點序號輸入紀錄</CompactEmpty>;

  return (
    <ul className="mt-3 divide-y divide-border">
      {rows.map((row) => (
        <li key={row.id} className="flex min-w-0 items-start justify-between gap-3 py-3 first:pt-1">
          <div className="min-w-0">
            <p className="break-all font-mono text-xs font-medium">{row.code}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {row.redeemedAt ? formatDateTime(row.redeemedAt) : '時間未記錄'} · 管道未記錄
            </p>
          </div>
          <span className="shrink-0 text-base font-semibold tabular-nums">+{formatNumber(row.pointValue)}</span>
        </li>
      ))}
    </ul>
  );
}

function CouponsList({ data, limit }: { data: CustomerDetailData; limit?: number }) {
  const allRows = data.jar?.redemptions ?? [];
  const rows = limit ? allRows.slice(0, limit) : allRows;
  if (rows.length === 0) return <CompactEmpty>尚無優惠券兌換紀錄</CompactEmpty>;

  return (
    <ul className="mt-3 divide-y divide-border">
      {rows.map((row) => (
        <li key={row.id} className="flex min-w-0 items-start justify-between gap-3 py-3 first:pt-1">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{row.reward.rewardName}</p>
            <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{row.couponCode ?? '尚無優惠券碼'}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDateTime(row.issuedAt)}{row.usedAt ? ` · 核銷 ${formatDateTime(row.usedAt)}` : ''}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-medium">{couponStatusLabel[row.couponStatus] ?? row.couponStatus}</p>
            <p className="mt-1 text-xs tabular-nums text-muted-foreground">−{formatNumber(row.pointsSpent)} 點</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function OrdersList({ data, limit = 3 }: { data: CustomerDetailData; limit?: number }) {
  const rows = data.customer.orders.slice(0, limit);
  if (rows.length === 0) return <CompactEmpty>尚無訂單紀錄</CompactEmpty>;

  return (
    <ul className="mt-3 divide-y divide-border">
      {rows.map((order) => (
        <li key={order.id} className="flex min-w-0 items-start justify-between gap-3 py-3 first:pt-1">
          <div className="min-w-0">
            <Link href={`/orders/${order.id}`} className="block truncate font-mono text-xs font-medium hover:underline">
              {order.orderNumber}
            </Link>
            <p className="mt-1 text-xs text-muted-foreground">
              {orderSourceLabel[order.source] ?? order.source} · {formatDateTime(order.orderedAt)}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-medium">{orderStatusLabel[order.status] ?? order.status}</p>
            <p className="mt-1 text-xs tabular-nums text-muted-foreground">{formatCurrency(Number(order.total))}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function OperationsSummary({ data }: { data: CustomerDetailData }) {
  if (
    data.openRefillOrders.length === 0
    && data.issuedJars.length === 0
    && data.recentAppointments.length === 0
  ) return null;

  return (
    <div className="mt-4 grid gap-3 md:grid-cols-3">
      {data.openRefillOrders.length > 0 ? (
        <section className="rounded-xl border border-border p-4">
          <SectionHeading title="待處理換罐" />
          <ul className="mt-2 divide-y divide-border text-sm">
            {data.openRefillOrders.slice(0, 2).map((order) => (
              <li key={order.id} className="py-3">
                <p className="font-medium">{refillOrderTypeLabel(order.orderType)} · {order.product?.name ?? '未指定商品'}</p>
                <p className="mt-1 text-xs text-muted-foreground">{refillOrderStatusLabel(order.status)} · NT${formatNumber(order.totalAmount)}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.issuedJars.length > 0 ? (
        <section className="rounded-xl border border-border p-4">
          <SectionHeading title="目前持有罐" />
          <ul className="mt-2 divide-y divide-border text-sm">
            {data.issuedJars.slice(0, 2).map((jar) => (
              <li key={jar.id} className="py-3">
                <p className="break-all font-mono text-xs font-medium">{jar.code}</p>
                <p className="mt-1 text-xs text-muted-foreground">{jar.issuedMerchant?.name ?? '未記錄店家'}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.recentAppointments.length > 0 ? (
        <section className="rounded-xl border border-border p-4">
          <SectionHeading title="最近預約" />
          <ul className="mt-2 divide-y divide-border text-sm">
            {data.recentAppointments.slice(0, 2).map((appointment) => (
              <li key={appointment.id} className="py-3">
                <p className="font-medium">{appointment.serviceName}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(appointment.startsAt)} · {appointmentStatusLabelForMerchant(appointment.status)}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Overview({ data }: { data: CustomerDetailData }) {
  const base = `/customers/${data.customer.id}`;
  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">會員摘要</h2>
          <p className="mt-1 text-xs text-muted-foreground">只顯示最近紀錄，完整資料請使用上方分頁</p>
        </div>
        {data.hasJar ? (
          <Link href={`${base}/jar-exchange/actions`} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium hover:underline">
            換罐操作<ChevronRight className="h-4 w-4" />
          </Link>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <OverviewPanel title="最近點數" href={`${base}/jar-ledger`}><PointsList data={data} limit={2} /></OverviewPanel>
        <OverviewPanel title="最近集點序號" href={`${base}/jar-codes`}><CodesList data={data} limit={2} /></OverviewPanel>
        <OverviewPanel title="優惠券" href={`${base}/jar-rewards`}><CouponsList data={data} limit={2} /></OverviewPanel>
        <OverviewPanel title="最近訂單" href="/orders" linkLabel="全部訂單"><OrdersList data={data} limit={2} /></OverviewPanel>
      </div>

      <OperationsSummary data={data} />

      {data.customer.subscriptions.length > 0 ? (
        <section className="mt-4 rounded-xl border border-border p-4">
          <SectionHeading title="訂閱" href="/subscriptions" />
          <ul className="mt-2 divide-y divide-border text-sm">
            {data.customer.subscriptions.slice(0, 3).map((subscription) => (
              <li key={subscription.id} className="flex items-center justify-between gap-3 py-3">
                <Link href={`/subscriptions/${subscription.id}`} className="truncate font-medium hover:underline">{subscription.plan.name}</Link>
                <span className="shrink-0 text-muted-foreground">{subscription.status}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}

function DetailPanel({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <SectionHeading title={title} href={href} linkLabel="完整紀錄" />
      {children}
    </section>
  );
}

export function CustomerMemberWorkspace({ data }: { data: CustomerDetailData }) {
  const base = `/customers/${data.customer.id}`;
  return (
    <CustomerDetailTabs
      items={[
        { value: 'overview', label: '總覽', content: <Overview data={data} /> },
        { value: 'points', label: '點數紀錄', content: <DetailPanel title="點數紀錄" href={`${base}/jar-ledger`}><PointsList data={data} /></DetailPanel> },
        { value: 'codes', label: '集點序號', content: <DetailPanel title="集點序號" href={`${base}/jar-codes`}><CodesList data={data} /></DetailPanel> },
        { value: 'coupons', label: '優惠券', content: <DetailPanel title="優惠券" href={`${base}/jar-rewards`}><CouponsList data={data} /></DetailPanel> },
        { value: 'activity', label: '最近活動', content: <CustomerActivityTimeline data={data} /> },
      ]}
    />
  );
}
