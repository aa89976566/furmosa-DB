import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { prisma } from '@/lib/prisma';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { shippingFeeTypeLabel } from '@/lib/labels';
import { shippingMethodLabel } from '@/lib/shipping-policy';
import { OrderAmountSummary } from '@/components/orders/order-amount-summary';
import { LogisticsSummary } from '@/components/shared/logistics-summary';
import { resolveLogisticsForOrderList } from '@/lib/logistics-display';
import { isOrderEditable } from '@/lib/orders/build-edit-initial';
import { shipmentStatusLabel, shipmentStatusVariant } from '@/lib/shipment';
import {
  ArrowLeft,
  AlertTriangle,
  MapPin,
  StickyNote,
  Pencil,
} from 'lucide-react';
import {
  OrderPaymentStatusToggles,
  OrderStatusToggles,
} from '@/components/orders/order-status-toggles';
import { OrderStatusRail } from '@/components/orders/order-status-rail';
import { updateOrderShippingFeeType } from '../actions';

export const dynamic = 'force-dynamic';

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      merchant: true,
      items: { include: { product: true } },
      shipments: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!order) notFound();

  const editable = isOrderEditable(order);
  const logistics = resolveLogisticsForOrderList(order);
  const incompleteItems = order.items.filter(
    (it) =>
      !it.isGift &&
      (Number(it.unitPrice) === 0 || !it.sku || it.sku.startsWith('FUR-')),
  );

  return (
    <div className="min-h-full bg-canvas">
      <header className="border-b border-border/60 bg-card">
        <div className="px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                訂單
              </p>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-ink md:text-3xl">
                訂單詳情
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm text-muted-foreground">{order.orderNumber}</span>
                <StatusBadge kind="order" value={order.status} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {editable.ok ? (
                <Button size="sm" asChild>
                  <Link href={`/orders/${order.id}/edit`}>
                    <Pencil className="mr-1 h-4 w-4" />
                    編輯訂單
                  </Link>
                </Button>
              ) : null}
              <Button variant="outline" size="sm" asChild>
                <Link href="/orders">
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  返回列表
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="space-y-5 p-4 sm:space-y-6 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="bento-card p-5">
            <h2 className="text-sm font-semibold text-ink">摘要</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <DetailRow label="下單時間" value={formatDateTime(order.orderedAt)} />
              <DetailRow
                label="客戶"
                value={
                  order.customer ? (
                    <span>
                      <Link href={`/customers/${order.customer.id}`} className="font-medium hover:underline">
                        {order.customer.name}
                      </Link>
                      {order.customer.phone ? (
                        <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                          {order.customer.phone}
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    '—'
                  )
                }
              />
              <DetailRow
                label="寄賣店家"
                value={
                  order.merchant ? (
                    <Link href={`/merchants/${order.merchant.id}`} className="font-medium hover:underline">
                      {order.merchant.name}
                    </Link>
                  ) : (
                    '—'
                  )
                }
              />
              <DetailRow label="來源" value={<StatusBadge kind="orderSource" value={order.source} />} />
              {order.completedAt ? (
                <DetailRow label="完成時間" value={formatDateTime(order.completedAt)} />
              ) : null}
            </dl>
            {order.note ? (
              <div className="mt-4 flex gap-2 rounded-xl border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
                <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="whitespace-pre-line">{order.note}</span>
              </div>
            ) : null}
          </section>

          <section className="bento-card p-5">
            <h2 className="text-sm font-semibold text-ink">運輸</h2>
            <div className="mt-4">
              <LogisticsSummary logistics={logistics} />
              {order.shippingAddress &&
              order.shippingMethod === 'convenience' &&
              !logistics.destination.includes(order.shippingAddress.trim()) ? (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="whitespace-pre-line">{order.shippingAddress}</span>
                </p>
              ) : null}
            </div>
            <div className="mt-4 border-t border-border/60 pt-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">出貨單</p>
              {order.shipments.length === 0 ? (
                <p className="text-xs text-muted-foreground">尚未建立出貨單</p>
              ) : (
                <ul className="space-y-1.5">
                  {order.shipments.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-muted/20 px-2.5 py-1.5"
                    >
                      <Link
                        href={
                          order.source === 'consignment'
                            ? `/shipments?type=consignment&s=${encodeURIComponent(s.id)}`
                            : `/shipments?s=${encodeURIComponent(s.id)}`
                        }
                        className="min-w-0 font-mono text-xs hover:underline"
                      >
                        {s.shipmentNumber}
                      </Link>
                      <Badge
                        variant={shipmentStatusVariant[s.status] ?? 'secondary'}
                        className="shrink-0"
                      >
                        {shipmentStatusLabel[s.status] ?? s.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="bento-card p-5">
            <h2 className="text-sm font-semibold text-ink">付款</h2>
            <div className="mt-4 space-y-4">
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">付款狀態</p>
                <OrderPaymentStatusToggles
                  orderId={order.id}
                  paymentStatus={order.paymentStatus}
                />
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">運費類型</p>
                <div className="flex flex-wrap gap-1.5">
                  {(['free', 'prepaid', 'unpaid', 'cod'] as const).map((s) => (
                    <form key={s} action={updateOrderShippingFeeType}>
                      <input type="hidden" name="orderId" value={order.id} />
                      <input type="hidden" name="shippingFeeType" value={s} />
                      <button
                        type="submit"
                        disabled={order.shippingFeeType === s}
                        className={cn(
                          'rounded-md border px-2.5 py-1 text-xs whitespace-nowrap transition disabled:cursor-not-allowed',
                          order.shippingFeeType === s
                            ? 'border-ink bg-ink font-medium text-white'
                            : 'border-border bg-background hover:bg-muted',
                        )}
                      >
                        {shippingFeeTypeLabel[s]}
                      </button>
                    </form>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {shippingMethodLabel(order)}
                </p>
              </div>
              <OrderAmountSummary
                order={{
                  subtotal: Number(order.subtotal),
                  discount: Number(order.discount),
                  shippingFee: Number(order.shippingFee),
                  shippingFeeType: order.shippingFeeType,
                  shippingMethod: order.shippingMethod,
                  cvsBrand: order.cvsBrand,
                  companyShippingCost: Number(order.companyShippingCost),
                  giftCost: Number(order.giftCost ?? 0),
                  total: Number(order.total),
                }}
              />
            </div>
          </section>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
          <section className="bento-card overflow-hidden">
            <div className="border-b border-border/60 px-5 py-4">
              <h2 className="text-sm font-semibold text-ink">訂單明細</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {order.items.length} 項 · 共{' '}
                {order.items.reduce((s, i) => s + i.quantity, 0)} 件
              </p>
            </div>
            <div className="p-5">
              {incompleteItems.length > 0 ? (
                <div className="mb-3 flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-3 text-xs">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    有 <span className="font-semibold">{incompleteItems.length}</span> 個品項缺欄位（SKU
                    或單價）— 請出貨前補完。
                  </span>
                </div>
              ) : null}

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>商品</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">數量</TableHead>
                      <TableHead className="text-right">單價</TableHead>
                      <TableHead className="text-right">小計</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.items.map((it) => {
                      const skuMissing = !it.sku || it.sku.startsWith('FUR-');
                      const priceMissing = !it.isGift && Number(it.unitPrice) === 0;
                      return (
                        <TableRow key={it.id}>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-2">
                              <Link
                                href={`/products/${it.productId}`}
                                className="font-medium hover:underline"
                              >
                                {it.productName}
                              </Link>
                              {it.isGift ? (
                                <Badge variant="secondary" className="text-[10px] font-normal">
                                  贈品
                                </Badge>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {skuMissing ? it.sku || '未填' : it.sku}
                          </TableCell>
                          <TableCell className="text-right font-mono">{it.quantity}</TableCell>
                          <TableCell className="text-right">
                            {it.isGift
                              ? '—'
                              : priceMissing
                                ? '未填'
                                : formatCurrency(Number(it.unitPrice))}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {it.isGift
                              ? `成本 ${formatCurrency(Number(it.unitCost ?? 0) * it.quantity)}`
                              : priceMissing
                                ? '-'
                                : formatCurrency(Number(it.subtotal))}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </section>

          <div className="space-y-4">
            <section className="bento-card p-5">
              <h2 className="text-sm font-semibold text-ink">訂單狀態</h2>
              <div className="mt-4">
                <OrderStatusRail status={order.status} />
              </div>
              <div className="mt-4 border-t border-border/60 pt-4">
                <p className="mb-2 text-xs font-medium text-muted-foreground">調整狀態</p>
                <OrderStatusToggles orderId={order.id} status={order.status} />
                {order.status === 'cancelled' ? (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    已取消訂單不會出現在列表；改為其他狀態即可回到列表。
                  </p>
                ) : null}
              </div>
            </section>

            <section className="bento-card p-5">
              <h2 className="text-sm font-semibold text-ink">活動紀錄</h2>
              <ol className="relative ml-2 mt-4 space-y-4 border-l border-border pl-5">
                <TimelineItem
                  time={order.orderedAt}
                  title="訂單建立"
                  description={`來源：${order.source}`}
                />
                {order.status !== 'draft' ? (
                  <TimelineItem
                    time={order.orderedAt}
                    title="訂單確認"
                    description={`付款：${order.paymentStatus}`}
                  />
                ) : null}
                {['shipped', 'delivered', 'completed'].includes(order.status) ? (
                  <TimelineItem
                    time={order.shippedAt ?? order.orderedAt}
                    title="已出貨"
                    description="運送中"
                  />
                ) : null}
                {order.completedAt ? (
                  <TimelineItem time={order.completedAt} title="訂單完成" description="交易完成" />
                ) : null}
              </ol>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-ink">{value}</dd>
    </div>
  );
}

function TimelineItem({
  time,
  title,
  description,
}: {
  time: Date;
  title: string;
  description?: string;
}) {
  return (
    <li className="relative">
      <span className="absolute -left-[27px] top-1.5 flex h-2.5 w-2.5 rounded-full bg-ink ring-4 ring-card" />
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      <p className="text-xs text-muted-foreground">{formatDateTime(time)}</p>
    </li>
  );
}
