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
import { JIBA_PAYMENT_REVIEW_LABEL } from '@/lib/campaigns/jiba-two-piece/payment';
import {
  loadJibaChargeSourcesByOrderIds,
  resolveShipmentFulfillmentFee,
} from '@/lib/campaigns/jiba-two-piece/shipment-charge';
import { replaceJibaLegacyCatnipName } from '@/lib/campaigns/jiba-two-piece/constants';
import { paymentStatusLabel } from '@/lib/labels';
import {
  shipmentStatusLabel,
  shipmentStatusVariant,
  shipmentTypeLabel,
  nextStatuses,
  timelineSteps,
} from '@/lib/shipment';
import { productLabel } from '@/lib/product-label';
import { cn } from '@/lib/utils';
import { ShipmentStatusActions } from '@/components/shipments/shipment-status-actions';
import { parsePlanContents } from '@/lib/plan-contents';
import { resolveShipActionCarrierDefaults } from '@/lib/merchant-shipping-defaults';
import { shipmentInventoryAdvisories } from '@/lib/inventory/shipment-advisory';
import { normalizeStoredShopifyRecipient } from '@/lib/shopify/recipient-name';
import { displayOrderNumber } from '@/lib/orders/display-order-number';
import {
  ArrowLeft,
  Package,
  CheckCircle2,
  Clock,
  XCircle,
  Repeat,
  CalendarClock,
  HandCoins,
  BadgeCheck,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ShipmentDetailPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ error?: string }>;
  }
) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const actionError = (searchParams?.error ?? '').trim();
  const shipment = await prisma.shipment.findUnique({
    where: { id: params.id },
    include: {
      merchant: true,
      customer: true,
      order: true,
      subscriptionShipment: { include: { subscription: { include: { plan: true } } } },
      items: {
        include: {
          product: {
            include: {
              priceTiers: true,
              inventoryBalances: {
                where: { warehouse: { code: 'WH-MAIN' } },
                take: 1,
              },
            },
          },
        },
      },
    },
  });
  if (!shipment) notFound();

  const totalQty = shipment.items.reduce((s, i) => s + i.quantity, 0);
  const jibaSources = await loadJibaChargeSourcesByOrderIds([shipment.orderId]);
  const fee = resolveShipmentFulfillmentFee({
    orderStatus: shipment.order?.status,
    shippingFeeType: shipment.order?.shippingFeeType,
    jiba: shipment.orderId ? jibaSources.get(shipment.orderId) ?? null : null,
  });
  const paymentReviewHold = fee.paymentReviewHold;
  const allowedByPayment = paymentReviewHold
    ? nextStatuses(shipment.status).filter((status) => status !== 'shipped' && status !== 'delivered')
    : nextStatuses(shipment.status);
  const allowedNext = shipment.type === 'merchant_restock'
    ? allowedByPayment.filter((status) => status !== 'delivered')
    : allowedByPayment;
  const steps = timelineSteps(shipment);
  const isFinal = ['delivered', 'received', 'cancelled'].includes(shipment.status);
  const displayRecipientName = shipment.order?.omsStatus
    ? normalizeStoredShopifyRecipient(shipment.recipientName, shipment.order.shopifySnapshot)
    : shipment.recipientName;
  const shipCarrierDefaults = resolveShipActionCarrierDefaults({
    carrier: shipment.carrier,
    recipientName: displayRecipientName,
    recipientPhone: shipment.recipientPhone,
    recipientAddress: shipment.recipientAddress,
    merchant: shipment.merchant,
  });
  const inventoryWarnings = shipmentInventoryAdvisories(shipment.items);

  // 運輸人員需要的收款資訊：是否要當面跟客戶收錢
  const order = shipment.order;
  const orderDisplayNumber = order ? displayOrderNumber(order) : null;
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
                  訂單 {orderDisplayNumber}
                </Link>
              </Button>
            ) : null}
            <Button variant="outline" size="sm" asChild>
              <Link href="/shipments?status=pending">
                <ArrowLeft className="mr-1 h-4 w-4" />
                返回隊列
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 p-6 lg:grid-cols-3">
        {actionError ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive lg:col-span-3" role="alert">
            {actionError}
          </div>
        ) : null}
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
                  (displayRecipientName ?? '-')
                )
              }
            />
            <Row label="收件人" value={displayRecipientName ?? '-'} />
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
                      {orderDisplayNumber}
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
                    <Badge variant={paymentReviewHold ? 'warning' : 'outline'}>
                      {fee.fulfillmentFeeLabel ??
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
              {replaceJibaLegacyCatnipName(shipment.notes)}
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
            title="下一步"
            description={
              paymentReviewHold
                ? `此單仍在${JIBA_PAYMENT_REVIEW_LABEL}，不可標記已寄出`
                : shipment.status === 'shipped'
                  ? '貨物已寄出；收到物流到達資訊後，再確認貨物到達'
                  : '填寫物流資料後確認寄出，關聯訂單會同步更新'
            }
            className="lg:col-span-3"
          >
            <ShipmentStatusActions
              shipmentId={shipment.id}
              currentStatus={shipment.status}
              allowedNext={allowedNext}
              defaultCarrier={shipCarrierDefaults.defaultCarrier}
              defaultTracking={shipment.trackingNumber}
              defaultPickupStore={shipCarrierDefaults.pickupStore}
              defaultPickupName={shipCarrierDefaults.pickupName}
              defaultPickupPhone={shipCarrierDefaults.pickupPhone}
              inventoryWarnings={inventoryWarnings}
            />
          </SectionCard>
        )}
      </div>
    </>
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
