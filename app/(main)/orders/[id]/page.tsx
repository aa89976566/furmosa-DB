import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import {
  HorizontalSectionBand,
  HorizontalSectionPane,
} from '@/components/shared/horizontal-sections';
import { SectionCard } from '@/components/shared/section-card';
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
import { orderStatusLabel, paymentStatusLabel, shippingFeeTypeLabel } from '@/lib/labels';
import { shippingMethodLabel } from '@/lib/shipping-policy';
import { OrderAmountSummary } from '@/components/orders/order-amount-summary';
import { DetailBadgeRow, DetailStrip } from '@/components/shared/detail-fields';
import { LogisticsSummary } from '@/components/shared/logistics-summary';
import { resolveLogisticsForOrderList } from '@/lib/logistics-display';
import { isOrderEditable } from '@/lib/orders/build-edit-initial';
import { shipmentStatusLabel, shipmentStatusVariant } from '@/lib/shipment';
import {
  ArrowLeft,
  AlertTriangle,
  MapPin,
  StickyNote,
  Truck,
  CreditCard,
  Clock,
  Package,
  ClipboardList,
  Pencil,
} from 'lucide-react';
import {
  updateOrderPaymentStatus,
  updateOrderShippingFeeType,
  updateOrderStatus,
} from '../actions';

const ORDER_STATUS_OPTIONS = [
  'draft',
  'confirmed',
  'packed',
  'shipped',
  'delivered',
  'completed',
  'cancelled',
] as const;

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
  return (
    <>
      <PageHeader
        tone="orders"
        title={order.orderNumber}
        description={`下單時間 ${formatDateTime(order.orderedAt)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {editable.ok ? (
              <Button variant="default" size="sm" asChild>
                <Link href={`/orders/${order.id}/edit`}>
                  <Pencil className="mr-1 h-4 w-4" />
                  修改訂單
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
        }
      />

      <div className="space-y-6 p-6">
        <HorizontalSectionBand>
          <HorizontalSectionPane tone="orders" icon={ClipboardList} title="訂單摘要">
            <DetailBadgeRow className="mb-3">
              <StatusBadge kind="orderSource" value={order.source} />
              <StatusBadge kind="order" value={order.status} />
              <StatusBadge kind="payment" value={order.paymentStatus} />
              <StatusBadge kind="fulfillment" value={order.fulfillmentStatus} />
            </DetailBadgeRow>

            <div className="mb-3 rounded-lg border bg-muted/20 p-3">
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">訂單狀態（可調整）</p>
              <div className="flex flex-wrap gap-1.5">
                {ORDER_STATUS_OPTIONS.map((s) => (
                  <form key={s} action={updateOrderStatus}>
                    <input type="hidden" name="orderId" value={order.id} />
                    <input type="hidden" name="status" value={s} />
                    <button
                      type="submit"
                      disabled={order.status === s}
                      className={toggleButtonClass(
                        order.status === s,
                        false,
                        s === 'cancelled',
                      )}
                    >
                      {orderStatusLabel[s]}
                    </button>
                  </form>
                ))}
              </div>
              {order.status === 'cancelled' ? (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  此訂單目前為「已取消」，會收錄在「歷史訂單」。改為其他狀態即可回到訂單列表。
                </p>
              ) : null}
            </div>

            <DetailStrip
              columns={1}
              items={[
                {
                  label: '訂單編號',
                  value: <span className="font-mono">{order.orderNumber}</span>,
                },
                {
                  label: '客戶',
                  value: order.customer ? (
                    <span className="block min-w-0">
                      <Link
                        href={`/customers/${order.customer.id}`}
                        className="text-info hover:underline"
                      >
                        {order.customer.name}
                      </Link>
                      {order.customer.phone ? (
                        <span className="mt-0.5 block font-mono text-xs font-normal text-muted-foreground">
                          {order.customer.phone}
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  ),
                },
                {
                  label: '寄賣店家',
                  value: order.merchant ? (
                    <Link
                      href={`/merchants/${order.merchant.id}`}
                      className="text-info hover:underline"
                    >
                      {order.merchant.name}
                    </Link>
                  ) : (
                    <span className="font-normal text-muted-foreground">—</span>
                  ),
                },
                ...(order.completedAt
                  ? [{ label: '完成時間', value: formatDateTime(order.completedAt) }]
                  : []),
              ]}
            />

            {order.note ? (
              <div className="mt-3 flex gap-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="whitespace-pre-line">{order.note}</span>
              </div>
            ) : null}
          </HorizontalSectionPane>

          <HorizontalSectionPane tone="logistics" icon={Truck} title="運輸資訊">
            <LogisticsSummary logistics={logistics} />
            {order.shippingAddress &&
            order.shippingMethod === 'convenience' &&
            !logistics.destination.includes(order.shippingAddress.trim()) ? (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="whitespace-pre-line">{order.shippingAddress}</span>
              </p>
            ) : null}
            {order.merchant && !order.shippingMethod ? (
              <p className="mt-2 text-xs text-muted-foreground">
                顯示寄賣店家檔案中的預設運輸資料。
                <Link
                  href={`/merchants/${order.merchant.id}`}
                  className="ml-1 text-info hover:underline"
                >
                  編輯店家運輸
                </Link>
              </p>
            ) : null}

            <div className="mt-3 border-t pt-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">出貨單</p>
              {order.shipments.length === 0 ? (
                <p className="text-xs text-muted-foreground">尚未建立出貨單</p>
              ) : (
                <ul className="space-y-1.5">
                  {order.shipments.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-2.5 py-1.5"
                    >
                      <Link
                        href={`/shipments/${s.id}`}
                        className="min-w-0 font-mono text-xs text-info hover:underline"
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
          </HorizontalSectionPane>

          <HorizontalSectionPane
            tone="finance"
            icon={CreditCard}
            title="付款與運費"
            description="可隨時調整"
          >
            <div className="space-y-3">
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">付款狀態</p>
                <div className="flex flex-wrap gap-1.5">
                  {(['unpaid', 'partial', 'paid', 'cod', 'refunded'] as const).map((s) => (
                    <form key={s} action={updateOrderPaymentStatus}>
                      <input type="hidden" name="orderId" value={order.id} />
                      <input type="hidden" name="paymentStatus" value={s} />
                      <button
                        type="submit"
                        disabled={order.paymentStatus === s}
                        className={toggleButtonClass(order.paymentStatus === s, false)}
                      >
                        {paymentStatusLabel[s]}
                      </button>
                    </form>
                  ))}
                </div>
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
                        className={toggleButtonClass(order.shippingFeeType === s, false)}
                      >
                        {shippingFeeTypeLabel[s]}
                      </button>
                    </form>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {shippingMethodLabel(order)}。合計為買家應付；包郵時公司運費成本另列、不計入合計。
                </p>
              </div>
            </div>
          </HorizontalSectionPane>
        </HorizontalSectionBand>

        <SectionCard
          tone="orders"
          icon={Package}
          title="訂單品項"
          description={`${order.items.length} 項 · 共 ${order.items.reduce((s, i) => s + i.quantity, 0)} 件`}
        >
          {(() => {
            const incomplete = order.items.filter(
              (it) =>
                !it.isGift &&
                (Number(it.unitPrice) === 0 || !it.sku || it.sku.startsWith('FUR-')),
            );
            return incomplete.length > 0 ? (
              <div className="mb-3 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 p-3 text-xs">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                <span>
                  有 <span className="font-semibold">{incomplete.length}</span> 個品項缺欄位（SKU
                  自動帶入或單價未填）— 請出貨前回試算表 / 系統補完。
                </span>
              </div>
            ) : null;
          })()}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>商品</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">重量</TableHead>
                <TableHead className="text-center">單位</TableHead>
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
                    <TableCell className="font-mono text-xs">
                      {skuMissing ? (
                        <span className="inline-flex items-center gap-1 rounded bg-warning/10 px-1.5 py-0.5 text-warning">
                          <AlertTriangle className="h-3 w-3" />
                          {it.sku || '未填'}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{it.sku}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {it.weightGrams ? `${it.weightGrams}g` : '-'}
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {it.unit ?? '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">{it.quantity}</TableCell>
                    <TableCell className="text-right">
                      {it.isGift ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : priceMissing ? (
                        <span className="inline-flex items-center gap-1 rounded bg-warning/10 px-1.5 py-0.5 text-xs text-warning">
                          <AlertTriangle className="h-3 w-3" />
                          未填
                        </span>
                      ) : (
                        formatCurrency(Number(it.unitPrice))
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {it.isGift ? (
                        <span className="text-xs text-warning">
                          成本 {formatCurrency(Number(it.unitCost ?? 0) * it.quantity)}
                        </span>
                      ) : priceMissing ? (
                        <span className="text-muted-foreground">-</span>
                      ) : (
                        formatCurrency(Number(it.subtotal))
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="mt-6 ml-auto w-full max-w-xs">
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
        </SectionCard>

        <SectionCard
          tone="operations"
          icon={Clock}
          title="活動紀錄"
          description="訂單流程時間軸"
        >
          <ol className="relative ml-3 space-y-4 border-l pl-6">
            <TimelineItem
              time={order.orderedAt}
              title="訂單建立"
              description={`來源：${order.source}`}
            />
            {order.status !== 'draft' ? (
              <TimelineItem
                time={order.orderedAt}
                title="訂單確認"
                description={`付款狀態：${order.paymentStatus}`}
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
        </SectionCard>
      </div>
    </>
  );
}

function toggleButtonClass(selected: boolean, fullWidth = false, destructive = false) {
  return cn(
    'rounded-md border px-2.5 py-1 text-xs whitespace-nowrap transition disabled:cursor-not-allowed',
    fullWidth && 'w-full text-left',
    selected
      ? destructive
        ? 'border-destructive/40 bg-destructive/10 font-medium text-destructive'
        : 'border-primary/40 bg-primary/10 font-medium text-primary'
      : destructive
        ? 'border-destructive/30 bg-background text-destructive hover:bg-destructive/10'
        : 'border-border bg-background hover:bg-muted',
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
      <span className="absolute -left-[31px] top-1 flex h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      <p className="text-xs text-muted-foreground">{formatDateTime(time)}</p>
    </li>
  );
}
