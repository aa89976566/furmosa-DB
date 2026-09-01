import Link from 'next/link';
import type { ReactNode } from 'react';
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
import { shippingFeeTypeLabel } from '@/lib/labels';
import { shippingMethodLabel } from '@/lib/shipping-policy';
import { OrderAmountSummary } from '@/components/orders/order-amount-summary';
import { DetailBadgeRow, DetailStrip } from '@/components/shared/detail-fields';
import { LogisticsSummary } from '@/components/shared/logistics-summary';
import { resolveLogisticsForOrderList } from '@/lib/logistics-display';
import { isOrderEditable } from '@/lib/orders/build-edit-initial';
import { replaceJibaLegacyCatnipName } from '@/lib/campaigns/jiba-two-piece/constants';
import {
  loadJibaChargeSourcesByOrderIds,
  resolveShipmentFulfillmentFee,
} from '@/lib/campaigns/jiba-two-piece/shipment-charge';
import { shipmentStatusLabel, shipmentStatusVariant } from '@/lib/shipment';
import {
  ArrowLeft,
  AlertTriangle,
  MapPin,
  StickyNote,
  Truck,
  CreditCard,
  Package,
  ClipboardList,
  CheckCircle2,
  Pencil,
} from 'lucide-react';
import {
  OrderPaymentStatusToggles,
  OrderStatusToggles,
} from '@/components/orders/order-status-toggles';
import { updateOrderShippingFeeType } from '../actions';
import { approveOrderForShipment } from '../actions';
import { ShopifyIntakePanel } from '@/components/orders/shopify-intake-panel';
import { OmsReviewPanel } from '@/components/orders/oms-review-panel';
import { snapshotView, omsShipmentNotice } from '@/lib/shopify/snapshot-view';
import { currentReviewDraft } from '@/lib/orders/review-display';
import { OMS_LABELS } from '@/lib/orders/oms';
import { OrderDeletionForm } from '@/components/orders/order-deletion-form';

export const dynamic = 'force-dynamic';

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      omsReviewedBy: { select: { name: true } },
      merchant: true,
      items: { include: { product: true } },
      shipments: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!order) notFound();

  const sourceView = order.omsStatus ? snapshotView(order.shopifySnapshot) : null;
  const shipmentNotice = omsShipmentNotice(order.omsStatus, order.shipments.length);
  const reviewAudit = order.omsStatus ? await prisma.statusAuditLog.findFirst({
    where: { entityType: 'oms_review', entityId: order.id },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { metadataJson: true },
  }) : null;
  const savedReview = order.omsStatus ? currentReviewDraft(order.shopifySnapshot, reviewAudit?.metadataJson) : null;

  const editable = isOrderEditable(order);
  const recipientNameMissing =
    !order.customer?.name?.trim() || order.customer.name.trim() === 'Shopify 客戶';
  const shippingMissingFields = [
    ...(recipientNameMissing ? ['收件人'] : []),
    ...(!order.customer?.phone?.trim() ? ['電話'] : []),
    ...(order.shippingMethod === 'home' && !order.shippingAddress?.trim() ? ['地址'] : []),
    ...(order.shippingMethod === 'convenience' && !order.cvsBrand?.trim() ? ['超商'] : []),
    ...(order.shippingMethod === 'convenience' && !order.cvsStoreName?.trim()
      ? ['門市名稱']
      : []),
    ...(order.shippingMethod === 'convenience' && !order.shippingAddress?.trim()
      ? ['門市所在地']
      : []),
  ];
  const shippingIncomplete = shippingMissingFields.length > 0;
  const logistics = resolveLogisticsForOrderList(order);
  const jibaSources = await loadJibaChargeSourcesByOrderIds([order.id]);
  const fulfillmentFee = resolveShipmentFulfillmentFee({
    orderStatus: order.status,
    shippingFeeType: order.shippingFeeType,
    jiba: jibaSources.get(order.id) ?? null,
  });
  const isMerchantRestock = Boolean(order.merchantId && !order.customerId);
  return (
    <>
      <PageHeader
        tone="orders"
        title={order.orderNumber}
        description={`下單時間 ${formatDateTime(order.orderedAt)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {editable.ok && !order.omsStatus ? (
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
        {order.deletedAt && <p className="rounded border border-destructive p-4 text-sm">此訂單已從 HQ 刪除，不會出現在一般清單或待審核。原因：{order.deletionReason}</p>}
        <ShopifyIntakePanel snapshot={order.shopifySnapshot} status={order.omsStatus} issues={order.omsIssueFlags} />
        {!order.deletedAt && <OmsReviewPanel orderId={order.id} snapshot={order.shopifySnapshot} status={order.omsStatus} />}
        {order.omsStatus && <div className="ml-auto max-w-sm"><OrderDeletionForm key={String(order.deletedAt)} orderId={order.id} orderNumber={order.orderNumber} deleted={Boolean(order.deletedAt)} /></div>}
        <SecondaryInformation compact={Boolean(order.omsStatus)}>
        <HorizontalSectionBand>
          <HorizontalSectionPane tone="orders" icon={ClipboardList} title="訂單摘要">
            <DetailBadgeRow className="mb-3">
              <StatusBadge kind="orderSource" value={order.source} />
              {order.omsStatus ? <Badge variant="secondary">{OMS_LABELS[order.omsStatus]}</Badge>
                : <StatusBadge kind="order" value={order.status} />}
              <StatusBadge kind="payment" value={order.paymentStatus} />
              {shipmentNotice ? <span className="text-xs text-muted-foreground">{shipmentNotice}</span>
                : <StatusBadge kind="fulfillment" value={order.fulfillmentStatus} />}
            </DetailBadgeRow>

            <div className="mb-3 rounded-lg border bg-muted/20 p-3">
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">{order.omsStatus ? 'OMS 審核進度' : '訂單狀態（可調整）'}</p>
              {order.omsStatus ? (
                <p className="text-xs text-muted-foreground">目前：{OMS_LABELS[order.omsStatus]}。請使用上方訂單審核區操作；確認訂單與建立出貨單是兩個不同步驟。</p>
              ) : order.status === 'pending_review' ? (
                <p className="text-xs text-muted-foreground">
                  待審核訂單必須使用下方的專用核准按鈕，不能直接變更狀態。
                </p>
              ) : (
                <OrderStatusToggles orderId={order.id} status={order.status} />
              )}
              {order.status === 'cancelled' ? (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  此訂單目前為「已取消」，不會出現在訂單列表。改為其他狀態即可回到列表。
                </p>
              ) : null}
            </div>

            {order.status === 'pending_review' && !order.omsStatus ? (
              <div className="mb-3 rounded-lg border border-warning/40 bg-warning/10 p-3">
                <p className="text-sm font-medium">
                  {order.paymentStatus === 'paid' ? '待客服審核' : '等待顧客付款'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {shippingIncomplete
                    ? `配送資料不完整：缺少${shippingMissingFields.join('、')}。補齊前不會建立出貨單。`
                    : order.paymentStatus === 'paid'
                    ? '款項已確認；審核通過後才會建立出貨單並進入出貨隊列。'
                    : '此訂單尚未付款。收到 Shopify 付款通知後，才能審核並建立出貨單。'}
                </p>
                {shippingIncomplete ? (
                  <Button className="mt-3" type="button" size="sm" variant="outline" asChild>
                    <Link href={`/orders/${order.id}/edit`}>
                      <MapPin className="mr-1 h-4 w-4" />
                      補齊配送資料
                    </Link>
                  </Button>
                ) : order.paymentStatus === 'paid' ? (
                  <form action={approveOrderForShipment} className="mt-3">
                    <input type="hidden" name="orderId" value={order.id} />
                    <Button type="submit" size="sm">
                      <CheckCircle2 className="mr-1 h-4 w-4" />
                      審核通過並建立出貨單
                    </Button>
                  </form>
                ) : null}
              </div>
            ) : null}

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
                  label: '合作店家',
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
                <span className="whitespace-pre-line">{replaceJibaLegacyCatnipName(order.note)}</span>
              </div>
            ) : null}
          </HorizontalSectionPane>

          <HorizontalSectionPane tone="logistics" icon={Truck} title="運輸資訊">
            {order.omsStatus ? (
              savedReview ? <div className="space-y-2 text-sm break-words">
                <p className="text-xs text-muted-foreground">目前來源版本已儲存的審核資料（尚未儲存的表單修改不會顯示於此）</p>
                <p>配送：{savedReview.method === 'home' ? '黑貓宅配' : savedReview.method === 'convenience' ? '7-11 取貨' : '待確認'} · 溫層：{({ ambient: '常溫', chilled: '冷藏', frozen: '冷凍' } as Record<string, string>)[savedReview.temperature] || '待確認'}</p>
                <p>收件人：{savedReview.recipient || '待補'} · 電話：{savedReview.phone || '待補'}</p>
                <p>地址：{savedReview.address || '待補'}</p>
                {savedReview.method === 'convenience' && <p>門市：{savedReview.storeId || '店號待補'} · {savedReview.storeName || '名稱待補'}</p>}
                <p className="text-xs text-muted-foreground">是否可出貨仍以系統檢查與人工審核結果為準；資料顯示完整不代表物流已接單。</p>
              </div> : <p className="text-sm text-warning">目前來源版本尚無有效審核資料，請在上方填寫並「儲存並檢查」。</p>
            ) : <>
            <LogisticsSummary logistics={logistics} />
            {shippingIncomplete ? (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-xs">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                <div>
                  <p className="font-medium">待補配送資料</p>
                  <p className="mt-0.5 text-muted-foreground">
                    缺少{shippingMissingFields.join('、')}，目前不能建立出貨單。
                  </p>
                </div>
              </div>
            ) : null}
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
                顯示合作店家檔案中的預設運輸資料。
                <Link
                  href={`/merchants/${order.merchant.id}`}
                  className="ml-1 text-info hover:underline"
                >
                  編輯店家運輸
                </Link>
              </p>
            ) : null}

            </>}
            <div className="mt-3 border-t pt-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">出貨單</p>
              {order.shipments.length === 0 ? (
                <p className="text-xs text-muted-foreground">尚未建立出貨單</p>
              ) : (
                <>
                  <ul className="space-y-1.5">
                    {order.shipments.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-2.5 py-1.5"
                      >
                        <Link
                          href={
                            isMerchantRestock
                              ? `/shipments?type=consignment&s=${encodeURIComponent(s.id)}`
                              : `/shipments?s=${encodeURIComponent(s.id)}`
                          }
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
                  {isMerchantRestock ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      此為店家補貨單，請至出貨隊列{' '}
                      <Link
                        href={`/shipments?type=consignment&s=${encodeURIComponent(order.shipments[0]!.id)}`}
                        className="text-info hover:underline"
                      >
                        「店家補貨」分類
                      </Link>{' '}
                      查看（不在「直客訂單」）。
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </HorizontalSectionPane>

          <HorizontalSectionPane
            tone="finance"
            icon={CreditCard}
            title="付款與運費"
            description={order.omsStatus ? '付款與金額由 Shopify 同步' : '可隨時調整'}
          >
            {order.omsStatus ? (
              <div className="space-y-3">
                <StatusBadge kind="payment" value={order.paymentStatus} />
                <p className="text-sm">Shopify 原始總額：{sourceView?.currency} {sourceView?.total || '待重新同步'}</p>
                <p className="text-xs text-muted-foreground">請在 Shopify 處理付款或金額變更後重新同步；HQ 不套用手動訂單運費試算。</p>
              </div>
            ) : (
            <div className="space-y-3">
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
                        className={toggleButtonClass(order.shippingFeeType === s, false)}
                      >
                        {shippingFeeTypeLabel[s]}
                      </button>
                    </form>
                  ))}
                </div>
                {fulfillmentFee.isJiba ? (
                  <p className="mt-2 text-sm font-medium">
                    開箱運費：{fulfillmentFee.fulfillmentFeeLabel}
                  </p>
                ) : null}
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {fulfillmentFee.isJiba
                    ? '開箱單依申報／核帳狀態顯示，不把未付或待核帳寫成包郵。'
                    : `${shippingMethodLabel(order)}。合計為買家應付；包郵時公司運費成本另列、不計入合計。`}
                </p>
              </div>
            </div>
            )}
          </HorizontalSectionPane>
        </HorizontalSectionBand>
        </SecondaryInformation>

        <SectionCard
          tone="orders"
          icon={Package}
          title="訂單品項"
          description={order.omsStatus && !order.items.length
            ? `Shopify 原始品項 ${sourceView?.items.length ?? 0} 項；尚未建立 HQ 出貨品項`
            : `${order.items.length} 項 · 共 ${order.items.reduce((s, i) => s + i.quantity, 0)} 件`}
        >
          {(() => {
            const incomplete = order.items
              .filter((it) => !it.isGift)
              .map((it) => ({
                item: it,
                missing: [
                  ...(!it.sku?.trim() ? ['SKU'] : []),
                  ...(Number(it.unitPrice) <= 0 ? ['單價'] : []),
                  ...(!it.weightGrams || Number(it.weightGrams) <= 0 ? ['重量'] : []),
                ],
              }))
              .filter(({ missing }) => missing.length > 0);
            return incomplete.length > 0 ? (
              <div className="mb-3 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 p-3 text-xs">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                <div>
                  <p className="font-medium">
                    有 <span className="font-semibold">{incomplete.length}</span> 個品項資料未完整
                  </p>
                  <ul className="mt-1 space-y-0.5 text-muted-foreground">
                    {incomplete.map(({ item, missing }) => (
                      <li key={item.id}>
                        {replaceJibaLegacyCatnipName(item.productName)}：缺少
                        {missing.join('、')}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-muted-foreground">請在出貨前補齊商品資料。</p>
                </div>
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
              {order.omsStatus && !order.items.length && sourceView?.items.map((item, index) => (
                <TableRow key={`source-${index}`}>
                  <TableCell>{item.title}</TableCell><TableCell>{item.sku || '待對應 SKU'}</TableCell>
                  <TableCell>待確認</TableCell><TableCell>—</TableCell><TableCell>{item.quantity ?? '待確認'}</TableCell>
                  <TableCell>{sourceView.currency} {item.price || '待確認'}</TableCell>
                  <TableCell>{sourceView.currency} {item.lineTotal ?? '待確認'}</TableCell>
                </TableRow>
              ))}
              {order.items.map((it) => {
                const skuMissing = !it.sku?.trim();
                const priceMissing = !it.isGift && Number(it.unitPrice) <= 0;
                const weightMissing = !it.isGift && (!it.weightGrams || Number(it.weightGrams) <= 0);
                return (
                  <TableRow key={it.id}>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/products/${it.productId}`}
                          className="font-medium hover:underline"
                        >
                          {replaceJibaLegacyCatnipName(it.productName)}
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
                      {weightMissing ? (
                        <span className="inline-flex items-center gap-1 rounded bg-warning/10 px-1.5 py-0.5 text-xs text-warning">
                          <AlertTriangle className="h-3 w-3" />
                          未填
                        </span>
                      ) : it.weightGrams ? (
                        `${it.weightGrams}g`
                      ) : (
                        '-'
                      )}
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
            {order.omsStatus ? (
              <div className="space-y-2 text-sm">
                <p className="font-semibold">Shopify 原始總額：{sourceView?.currency} {sourceView?.total || '待重新同步'}</p>
                <p className="text-xs text-muted-foreground">以來源訂單金額為準，不重新計算運費或稅費。</p>
              </div>
            ) : (
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
            )}
          </div>
        </SectionCard>

        <details className="rounded-xl border bg-card p-4">
          <summary className="cursor-pointer font-medium">活動紀錄與訂單時間軸</summary>
          <ol className="relative ml-3 mt-4 space-y-4 border-l pl-6">
            <TimelineItem
              time={order.orderedAt}
              title="訂單建立"
              description={`來源：${order.source}`}
            />
            {order.omsStatus && order.omsReviewedAt ? (
              <TimelineItem time={order.omsReviewedAt} title="OMS 人工確認"
                description={`審核者：${order.omsReviewedBy?.name || '原審核者帳號已不存在'}；確認不代表已出貨`} />
            ) : null}
            {!order.omsStatus && order.status !== 'draft' ? (
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
        </details>
      </div>
    </>
  );
}

function SecondaryInformation({ compact, children }: { compact: boolean; children: ReactNode }) {
  if (!compact) return <>{children}</>;
  return <details className="rounded-xl border bg-muted/10 p-4">
    <summary className="cursor-pointer font-medium">訂單、物流與付款摘要</summary>
    <p className="mt-2 text-xs text-muted-foreground">主要審核完成後，需要核對明細時再展開。</p>
    <div className="mt-4">{children}</div>
  </details>;
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
