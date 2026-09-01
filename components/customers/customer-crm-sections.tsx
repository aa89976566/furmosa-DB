import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';
import type { CustomerDetailData } from '@/lib/customers/load-customer-detail';
import {
  paymentOrderStatusLabel,
  paymentPurposeLabel,
  refillOrderStatusLabel,
  refillOrderTypeLabel,
} from '@/lib/customers/customer-crm-labels';
import { appointmentStatusLabelForMerchant } from '@/lib/booking/constants';
import { jarCodeStatusLabel, ledgerSourceLabel } from '@/lib/jar-exchange/labels';
import { formatDateTime, formatNumber } from '@/lib/format';

type IssuedJar = CustomerDetailData['issuedJars'][number];
type AppointmentRow = CustomerDetailData['recentAppointments'][number];
type OpenRefill = CustomerDetailData['openRefillOrders'][number];
type LedgerRow = CustomerDetailData['recentPointsLedger'][number];

export function CustomerPointsSummary({
  pointsBalance,
  recentLedger,
  customerId,
}: {
  pointsBalance: number;
  recentLedger: LedgerRow[];
  customerId: string;
}) {
  return (
    <SectionCard
      title="點數摘要"
      description="餘額取自帳本最後一筆 balanceAfter"
      tone="supply"
      action={
        <div className="flex flex-wrap justify-end gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/customers/${customerId}/jar-ledger`}>完整帳本</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/customers/${customerId}/points/adjust`}>調整點數</Link>
          </Button>
        </div>
      }
    >
      <p className="text-2xl font-semibold tabular-nums text-navy">
        {formatNumber(pointsBalance)}
        <span className="ml-1 text-sm font-normal text-muted-foreground">點</span>
      </p>
      {recentLedger.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">尚無點數紀錄</p>
      ) : (
        <ul className="mt-4 divide-y divide-border/50">
          {recentLedger.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-start justify-between gap-2 py-2.5 first:pt-0"
            >
              <div className="min-w-0">
                <Badge variant="outline" className="text-[10px]">
                  {ledgerSourceLabel[row.sourceType] ?? row.sourceType}
                </Badge>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDateTime(row.createdAt)}
                  {row.note ? ` · ${row.note}` : ''}
                </p>
              </div>
              <div className="text-right text-sm tabular-nums">
                <div
                  className={
                    row.pointsChange >= 0 ? 'font-medium text-success' : 'font-medium text-info'
                  }
                >
                  {row.pointsChange > 0 ? '+' : ''}
                  {formatNumber(row.pointsChange)}
                </div>
                <div className="text-xs text-muted-foreground">
                  餘 {formatNumber(row.balanceAfter)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

export function CustomerIssuedJars({ jars }: { jars: IssuedJar[] }) {
  return (
    <SectionCard
      title="目前持有罐"
      description="僅 status＝issued 且已綁定本會員"
      tone="supply"
    >
      {jars.length === 0 ? (
        <p className="text-sm text-muted-foreground">目前沒有持有中的罐</p>
      ) : (
        <ul className="space-y-2">
          {jars.map((jar) => (
            <li
              key={jar.id}
              className="rounded-xl border border-border/50 px-3 py-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-sm font-semibold tracking-wide">
                  {jar.code}
                </span>
                <Badge variant="success" className="text-[10px]">
                  {jarCodeStatusLabel[jar.status] ?? jar.status}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                交付店家：{jar.issuedMerchant?.name ?? '—'}
                {jar.issuedAt ? ` · ${formatDateTime(jar.issuedAt)}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

export function CustomerRecentAppointments({
  appointments,
}: {
  appointments: AppointmentRow[];
}) {
  return (
    <SectionCard
      title="最近預約"
      description="預約店家（目前以 Merchant 作為履約分店顯示）"
      tone="operations"
    >
      {appointments.length === 0 ? (
        <p className="text-sm text-muted-foreground">尚無預約紀錄</p>
      ) : (
        <ul className="space-y-2">
          {appointments.map((row) => (
            <li
              key={row.id}
              className="rounded-xl border border-border/50 px-3 py-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">{row.serviceName}</span>
                <Badge variant="secondary" className="text-[10px]">
                  {appointmentStatusLabelForMerchant(row.status)}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDateTime(row.startsAt)} · {row.merchant.name}
                {row.petName ? ` · ${row.petName}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

export function CustomerOpenRefills({ orders }: { orders: OpenRefill[] }) {
  return (
    <SectionCard
      title="待處理換罐"
      description="未完成訂單（待付款／待補款／待驗罐／待交付）"
      tone="operations"
    >
      {orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">目前沒有待處理換罐</p>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => {
            const latestPayment = order.payments[0] ?? null;
            return (
              <li
                key={order.id}
                className="rounded-xl border border-border/50 px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px]">
                      {refillOrderTypeLabel(order.orderType)}
                    </Badge>
                    <Badge variant="warning" className="text-[10px]">
                      {refillOrderStatusLabel(order.status)}
                    </Badge>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">
                    NT${formatNumber(order.totalAmount)}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {order.merchant.name}
                  {order.appointment
                    ? ` · 預約 ${formatDateTime(order.appointment.startsAt)}`
                    : ''}
                  {order.product?.name ? ` · ${order.product.name}` : ''}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  舊罐 {order.oldContainerSerial ?? '—'}
                  {' · '}
                  新罐 {order.newContainerSerial ?? '—'}
                </p>
                {latestPayment ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    付款：{paymentPurposeLabel(latestPayment.purpose)} ·{' '}
                    {paymentOrderStatusLabel(latestPayment.status)} · NT$
                    {formatNumber(latestPayment.amount)}
                    {latestPayment.merchantTradeNo
                      ? ` · ${latestPayment.merchantTradeNo}`
                      : ''}
                  </p>
                ) : null}
                {order.missingContainerNote ? (
                  <p className="mt-1 text-xs text-amber-800">
                    未帶罐備註：{order.missingContainerNote}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
