import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
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
import {
  isJibaPaymentReviewHold,
  JIBA_PAYMENT_REVIEW_LABEL,
} from '@/lib/campaigns/jiba-two-piece/payment';
import { paymentStatusLabel, shippingFeeTypeLabel } from '@/lib/labels';
import {
  shipmentStatusLabel,
  shipmentStatusVariant,
  shipmentTypeLabel,
  nextStatuses,
  nextActionLabel,
  timelineSteps,
  type ShipmentStatus,
} from '@/lib/shipment';
import { productLabel } from '@/lib/product-label';
import { cn } from '@/lib/utils';
import { markShipmentStatus } from '../actions';
import { CarrierSelect } from '@/components/shared/carrier-select';
import { parsePlanContents } from '@/lib/plan-contents';
import { resolveShipActionCarrierDefaults } from '@/lib/merchant-shipping-defaults';
import {
  ArrowLeft,
  Package,
  CheckCircle2,
  Clock,
  XCircle,
  Truck,
  Repeat,
  CalendarClock,
  HandCoins,
  BadgeCheck,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ShipmentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const shipment = await prisma.shipment.findUnique({
    where: { id: params.id },
    include: {
      merchant: true,
      customer: true,
      order: true,
      subscriptionShipment: { include: { subscription: { include: { plan: true } } } },
      items: { include: { product: true } },
    },
  });
  if (!shipment) notFound();

  const totalQty = shipment.items.reduce((s, i) => s + i.quantity, 0);
  const paymentReviewHold = isJibaPaymentReviewHold(shipment.order);
  const allowedNext = paymentReviewHold
    ? nextStatuses(shipment.status).filter((status) => status !== 'shipped' && status !== 'delivered')
    : nextStatuses(shipment.status);
  const steps = timelineSteps(shipment);
  const isFinal = ['delivered', 'cancelled'].includes(shipment.status);
  const shipCarrierDefaults = resolveShipActionCarrierDefaults({
    carrier: shipment.carrier,
    recipientName: shipment.recipientName,
    recipientPhone: shipment.recipientPhone,
    recipientAddress: shipment.recipientAddress,
    merchant: shipment.merchant,
  });

  // 運輸人員需要的收款資訊：是否要當面跟客戶收錢
  const order = shipment.order;
  const codGoods = order?.paymentStatus === 'cod';
  const codFreight = order?.shippingFeeType === 'cod';
  const needCollect = codGoods || codFreight;
  const collectAmount = order
    ? (codGoods ? Number(order.total) : 0) + (codFreight ? Number(order.shippingFee) : 0)
    : 0;

  const isSubscription = shipment.type === 'subscription';
  const subscription = shipment.subscriptionShipment?.subscription ?? null;
  const planContents = isSubscription
    ? parsePlanContents(subscription?.plan?.contents)
    : [];
  const scheduledDate = shipment.subscriptionShipment?.scheduledDate ?? null;

  return (
    <>
      <PageHeader
        title={`出貨單 ${shipment.shipmentNumber}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{shipmentTypeLabel[shipment.type] ?? shipment.type}</Badge>
            <Badge variant={shipmentStatusVariant[shipment.status] ?? 'secondary'}>
              {shipmentStatusLabel[shipment.status] ?? shipment.status}
            </Badge>
            {paymentReviewHold ? (
              <Badge variant="warning">{JIBA_PAYMENT_REVIEW_LABEL}</Badge>
            ) : null}
            <span className="text-xs text-muted-foreground">
              建立於 {formatDateTime(shipment.createdAt)}
            </span>
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {shipment.order ? (
              <Button variant="default" size="sm" asChild>
                <Link href={`/orders/${shipment.order.id}`}>
                  訂單 {shipment.order.orderNumber}
                </Link>
              </Button>
            ) : null}
            <Button variant="outline" size="sm" asChild>
              <Link href="/shipments">
                <ArrowLeft className="mr-1 h-4 w-4" />
                返回隊列
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 p-6 lg:grid-cols-3">
        {needCollect && !isFinal && (
          <div className="rounded-lg border-2 border-warning bg-warning/10 p-4 lg:col-span-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning text-warning-foreground">
                <HandCoins className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold">送達時請向客戶當面收款</div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-xs text-muted-foreground">應收：</span>
                  <span className="font-mono text-2xl font-bold text-warning">
                    {formatCurrency(collectAmount)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    （
                    {codGoods && <span>貨款 {formatCurrency(Number(order!.total))}</span>}
                    {codGoods && codFreight && <span> + </span>}
                    {codFreight && (
                      <span>運費 {formatCurrency(Number(order!.shippingFee))}</span>
                    )}
                    ）
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  收到款項後再點下方「送達」，並在備註寫上收款方式（現金 / 行動支付等）。
                </p>
              </div>
            </div>
          </div>
        )}

        <SectionCard title="物流時間軸" className="lg:col-span-3">
          <ol className="grid gap-3 md:grid-cols-4">
            {steps.map((step, idx) => {
              const isCancelled =
                shipment.status === 'cancelled' && idx > 0 && !step.done;
              return (
                <li
                  key={step.key}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border p-3',
                    step.done && !isCancelled && 'border-success/50 bg-success/5',
                    isCancelled && 'border-destructive/40 bg-destructive/5',
                    !step.done && !isCancelled && 'bg-muted/30',
                  )}
                >
                  <div
                    className={cn(
                      'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs',
                      step.done && !isCancelled
                        ? 'bg-success text-success-foreground'
                        : isCancelled
                          ? 'bg-destructive text-destructive-foreground'
                          : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {isCancelled ? (
                      <XCircle className="h-4 w-4" />
                    ) : step.done ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Clock className="h-4 w-4" />
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">{step.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {step.at ? formatDateTime(step.at) : '尚未'}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </SectionCard>

        <SectionCard title="收件 / 物流資訊" className="lg:col-span-1">
          <dl className="space-y-2 text-sm">
            <Row label="類型" value={shipmentTypeLabel[shipment.type] ?? shipment.type} />
            <Row
              label="目的地"
              value={
                shipment.merchant ? (
                  <Link
                    href={`/merchants/${shipment.merchant.id}`}
                    className="font-medium hover:underline"
                  >
                    {shipment.merchant.name}
                  </Link>
                ) : shipment.customer ? (
                  <Link
                    href={`/customers/${shipment.customer.id}`}
                    className="font-medium hover:underline"
                  >
                    {shipment.customer.name}
                  </Link>
                ) : (
                  (shipment.recipientName ?? '-')
                )
              }
            />
            <Row label="收件人" value={shipment.recipientName ?? '-'} />
            <Row label="電話" value={shipment.recipientPhone ?? '-'} />
            <Row label="地址" value={shipment.recipientAddress ?? '-'} />
            <Row label="物流商" value={shipment.carrier ?? '-'} />
            <Row
              label="追蹤碼"
              value={
                shipment.trackingNumber ? (
                  <span className="font-mono text-xs">{shipment.trackingNumber}</span>
                ) : (
                  '-'
                )
              }
            />
            {shipment.order && (
              <>
                <Row
                  label="關聯訂單"
                  value={
                    <Link
                      href={`/orders/${shipment.order.id}`}
                      className="font-mono text-xs hover:underline"
                    >
                      {shipment.order.orderNumber}
                    </Link>
                  }
                />
                <Row
                  label="付款狀態"
                  value={
                    <Badge
                      variant={
                        shipment.order.paymentStatus === 'paid'
                          ? 'success'
                          : shipment.order.paymentStatus === 'cod'
                            ? 'warning'
                            : 'secondary'
                      }
                    >
                      {shipment.order.paymentStatus === 'paid' && (
                        <BadgeCheck className="mr-1 h-3 w-3" />
                      )}
                      {shipment.order.paymentStatus === 'cod' && (
                        <HandCoins className="mr-1 h-3 w-3" />
                      )}
                      {paymentStatusLabel[shipment.order.paymentStatus] ??
                        shipment.order.paymentStatus}
                    </Badge>
                  }
                />
                <Row
                  label="運費類型"
                  value={
                    <Badge variant="outline">
                      {shippingFeeTypeLabel[shipment.order.shippingFeeType] ??
                        shipment.order.shippingFeeType}
                    </Badge>
                  }
                />
                <Row
                  label="訂單金額"
                  value={
                    <span className="font-mono">
                      {formatCurrency(Number(shipment.order.total))}
                    </span>
                  }
                />
              </>
            )}
            {shipment.subscriptionShipment?.subscription && (
              <Row
                label="關聯訂閱"
                value={
                  <Link
                    href={`/subscriptions/${shipment.subscriptionShipment.subscription.id}`}
                    className="font-mono text-xs hover:underline"
                  >
                    {shipment.subscriptionShipment.subscription.subscriptionNo}
                  </Link>
                }
              />
            )}
          </dl>
          {shipment.notes && (
            <div className="mt-4 rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-line text-muted-foreground">
              {shipment.notes}
            </div>
          )}
        </SectionCard>

        {isSubscription && (
          <SectionCard
            title={
              <span className="flex items-center gap-2">
                <Repeat className="h-4 w-4 text-info" />
                訂閱方案內容
              </span>
            }
            description={
              <span className="flex flex-wrap items-center gap-3 text-xs">
                {subscription?.plan && (
                  <span>
                    方案：
                    <span className="font-medium text-foreground">{subscription.plan.name}</span>
                    {subscription.plan.tagline && (
                      <span className="ml-1 text-muted-foreground">
                        · {subscription.plan.tagline}
                      </span>
                    )}
                  </span>
                )}
                {scheduledDate && (
                  <span className="flex items-center gap-1">
                    <CalendarClock className="h-3.5 w-3.5 text-info" />
                    預定出貨：
                    <span className="font-medium text-foreground">
                      {formatDateTime(scheduledDate)}
                    </span>
                  </span>
                )}
              </span>
            }
            className="lg:col-span-2"
          >
            {planContents.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                此方案沒有設定固定內容（請依當期規劃出貨）
              </div>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {planContents.map((c, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 rounded-lg border bg-muted/20 p-3"
                  >
                    <Package className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{c.name}</div>
                      {c.weight && (
                        <div className="text-xs text-muted-foreground">{c.weight}</div>
                      )}
                      {c.note && (
                        <div className="mt-0.5 text-xs text-muted-foreground">{c.note}</div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              訂閱方案的實際商品由倉庫依當期規劃挑選，這裡列出的是方案承諾內容，方便你撿貨對齊。
            </p>
          </SectionCard>
        )}

        {!(isSubscription && shipment.items.length === 0) && (
        <SectionCard
          title="商品明細"
          description={`${shipment.items.length} 項 · 共 ${totalQty} 件`}
          className="lg:col-span-2"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>商品</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">重量</TableHead>
                <TableHead className="text-right">數量</TableHead>
                <TableHead className="text-center">單位</TableHead>
                <TableHead>備註</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipment.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Link
                      href={`/products/${item.productId}`}
                      className="flex items-center gap-2 font-medium hover:underline"
                    >
                      <Package className="h-4 w-4 text-muted-foreground" />
                      {productLabel(item.productName, item.weightGrams)}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {item.sku}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {item.weightGrams ? `${item.weightGrams}g` : '-'}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {item.quantity}
                  </TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">
                    {item.unit ?? '-'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {item.notes ?? '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>
        )}

        {!isFinal && (
          <SectionCard
            title="推進狀態"
            description={
              paymentReviewHold
                ? `此單仍在${JIBA_PAYMENT_REVIEW_LABEL}，不可標記已寄出`
                : shipment.type === 'customer_order'
                  ? '物流人員操作 — 狀態會同步更新關聯訂單的出貨與訂單狀態'
                  : '物流人員操作 — 寄出時要填物流商與追蹤碼'
            }
            className="lg:col-span-3"
          >
            <div className="grid gap-4 lg:grid-cols-3">
              {allowedNext.map((next) => (
                <StatusActionCard
                  key={next}
                  shipmentId={shipment.id}
                  next={next}
                  currentStatus={shipment.status}
                  defaultCarrier={shipCarrierDefaults.defaultCarrier}
                  defaultTracking={shipment.trackingNumber}
                  defaultPickupStore={shipCarrierDefaults.pickupStore}
                  defaultPickupName={shipCarrierDefaults.pickupName}
                  defaultPickupPhone={shipCarrierDefaults.pickupPhone}
                />
              ))}
            </div>
          </SectionCard>
        )}
      </div>
    </>
  );
}

function StatusActionCard({
  shipmentId,
  next,
  currentStatus,
  defaultCarrier,
  defaultTracking,
  defaultPickupStore,
  defaultPickupName,
  defaultPickupPhone,
}: {
  shipmentId: string;
  next: ShipmentStatus;
  currentStatus: string;
  defaultCarrier: string | null;
  defaultTracking: string | null;
  defaultPickupStore?: string | null;
  defaultPickupName?: string | null;
  defaultPickupPhone?: string | null;
}) {
  const isShipping = next === 'shipped';
  const isDanger = next === 'cancelled';

  return (
    <form
      action={markShipmentStatus}
      className={cn(
        'space-y-3 rounded-lg border p-4',
        isDanger ? 'border-destructive/40 bg-destructive/5' : 'bg-muted/20',
      )}
    >
      <input type="hidden" name="shipmentId" value={shipmentId} />
      <input type="hidden" name="next" value={next} />

      <div className="flex items-center gap-2">
        {next === 'shipped' && <Truck className="h-4 w-4 text-info" />}
        {next === 'delivered' && <CheckCircle2 className="h-4 w-4 text-success" />}
        {next === 'cancelled' && <XCircle className="h-4 w-4 text-destructive" />}
        {next === 'pending' && <Clock className="h-4 w-4 text-warning" />}
        <h3 className="text-sm font-semibold">{nextActionLabel(next)}</h3>
      </div>

      {isShipping && (
        <>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">物流商</label>
            <CarrierSelect
              defaultValue={defaultCarrier}
              defaultPickupStore={defaultPickupStore}
              defaultPickupName={defaultPickupName}
              defaultPickupPhone={defaultPickupPhone}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">追蹤碼</label>
            <input
              name="trackingNumber"
              defaultValue={defaultTracking ?? ''}
              placeholder="1234-5678-9012"
              className="block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </>
      )}

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">備註（選填）</label>
        <input
          name="note"
          placeholder={
            next === 'delivered'
              ? '收件人簽收 / 放置位置...'
              : next === 'cancelled'
                ? '取消原因...'
                : ''
          }
          className="block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {next === 'delivered' && currentStatus !== 'shipped' && (
        <p className="text-xs text-warning">
          ⚠ 通常要先「已寄出」再「已送達」。確定可以跳過嗎？
        </p>
      )}
      {next === 'delivered' && (
        <p className="text-xs text-success">
          ✓ 確認送達後會自動把商品加進對方庫存
        </p>
      )}

      <Button
        type="submit"
        variant={isDanger ? 'outline' : 'default'}
        className={cn('w-full', isDanger && 'text-destructive hover:bg-destructive/10')}
      >
        {nextActionLabel(next)}
      </Button>
    </form>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b pb-2 last:border-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
