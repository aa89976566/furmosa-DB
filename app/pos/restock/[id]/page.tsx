import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getAuthenticatedMerchantId,
  requireMerchantSession,
} from '@/lib/merchant-auth';
import { getRestockRequestForMerchant } from '@/lib/restock-request/service';
import {
  restockRequestTypeLabel,
  restockStatusLabelForMerchant,
  type ApprovedSnapshotLine,
} from '@/lib/restock-request/constants';
import { PosShell } from '@/components/pos/pos-shell';
import { Card, CardContent } from '@/components/ui/card';
import { ClearDraftOnSuccess } from './clear-draft-on-success';
import { ConfirmReceiptButton } from './confirm-receipt-button';

import { loadPosAccount } from '@/lib/pos/account';

export const metadata = { title: '補貨單 · Furmosa 店家' };

export default async function PosRestockDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { ok?: string };
}) {
  const session = await requireMerchantSession();
  const merchantId = await getAuthenticatedMerchantId();
  const [account, req] = await Promise.all([
    loadPosAccount(session.merchantId, session.username),
    getRestockRequestForMerchant(params.id, merchantId),
  ]);
  if (!req) notFound();

  const snapshot = (req.approvedSnapshot as ApprovedSnapshotLine[] | null) ?? null;
  const shortId = req.id.slice(0, 8).toUpperCase();
  const justSubmitted = searchParams?.ok === '1';
  const shipment = req.shipment;
  const shipmentCopy = shipment
    ? {
        pending: { label: 'HQ 已核准，等待備貨', help: 'HQ 正在安排商品與出貨。' },
        packed: { label: '商品已備妥', help: '商品已完成備貨，準備交給物流。' },
        shipped: { label: '商品運送中', help: '商品已離開 HQ，請留意物流進度。' },
        delivered: { label: '待確認收貨', help: '請核對這批商品，再確認收到貨。' },
        received: { label: '店家已確認收貨', help: '商品已加入店家可售庫存。' },
        cancelled: { label: '出貨已取消', help: '請查看公司回覆或聯絡 HQ。' },
      }[shipment.status]
    : null;
  const shipmentTimeline = shipment
    ? [
        { label: 'HQ 核准', done: true },
        { label: '完成備貨', done: Boolean(shipment.packedAt) },
        { label: '商品出貨', done: Boolean(shipment.shippedAt) },
        { label: '物流送達', done: Boolean(shipment.deliveredAt) },
        { label: '店家確認收貨', done: shipment.status === 'received' },
      ]
    : [];
  const requestedItems = req.items.filter(
    (item) => (item.requestedQuantity ?? 0) > 0,
  );
  const hasApprovedItems =
    Boolean(snapshot?.length) ||
    req.items.some((item) => (item.approvedQuantity ?? 0) > 0 && req.status !== 'submitted');

  return (
    <PosShell storeName={account.storeName} account={account}>
      <div className="space-y-4 px-4 py-6">
        {justSubmitted ? <ClearDraftOnSuccess /> : null}
        <Link href="/pos/restock" className="text-xs text-muted-foreground">
          ← 補貨
        </Link>

        {justSubmitted ? (
          <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
            <p className="font-medium text-foreground">申請已送出</p>
            <p className="text-muted-foreground">
              編號 {shortId} · {req.createdAt.toLocaleString('zh-TW')}
            </p>
          </div>
        ) : null}

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-navy">補貨單</h1>
            <p className="text-sm text-muted-foreground">
              {restockRequestTypeLabel(req.requestType)} · 編號 {shortId}
            </p>
            <p className="text-xs text-muted-foreground">
              送出時間 {req.createdAt.toLocaleString('zh-TW')}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-medium">
            {shipmentCopy?.label ?? restockStatusLabelForMerchant(req.status)}
          </span>
        </div>

        {shipmentCopy && shipment ? (
          <Card className={shipment.status === 'delivered' ? 'border-amber-300 bg-amber-50' : ''}>
            <CardContent className="space-y-3 p-4">
              <div>
                <p className="font-semibold">{shipmentCopy.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{shipmentCopy.help}</p>
              </div>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <p>
                  <span className="text-muted-foreground">出貨單</span>
                  <br />
                  <span className="font-medium">{shipment.shipmentNumber}</span>
                </p>
                {shipment.carrier ? (
                  <p>
                    <span className="text-muted-foreground">配送方式</span>
                    <br />
                    <span className="font-medium">{shipment.carrier}</span>
                  </p>
                ) : null}
                {shipment.trackingNumber ? (
                  <p>
                    <span className="text-muted-foreground">追蹤編號</span>
                    <br />
                    <span className="font-medium">{shipment.trackingNumber}</span>
                  </p>
                ) : null}
              </div>
              {shipment.status === 'delivered' ? (
                <ConfirmReceiptButton requestId={req.id} />
              ) : null}

              <div className="border-t pt-3">
                <p className="mb-3 text-sm font-medium">處理進度</p>
                <ol className="grid gap-2 sm:grid-cols-5">
                  {shipmentTimeline.map((step) => (
                    <li key={step.label} className="flex items-center gap-2 text-sm sm:block">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                          step.done
                            ? 'bg-foreground text-background'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {step.done ? '✓' : '·'}
                      </span>
                      <span className="sm:mt-2 sm:block">{step.label}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardContent className="space-y-3 p-4 text-sm">
            {req.expectedArrivalDate ? (
              <p>
                <span className="text-muted-foreground">預計到貨</span>
                <br />
                <span className="font-medium">
                  {req.expectedArrivalDate.toLocaleDateString('zh-TW')}
                </span>
              </p>
            ) : (
              <p className="text-muted-foreground">
                公司確認後會顯示預計到貨日。你目前不用自行修改這張申請。
              </p>
            )}
            {req.merchantNote ? (
              <p>
                <span className="text-muted-foreground">你的備註</span>
                <br />
                {req.merchantNote}
              </p>
            ) : null}
            {req.hqNote ? (
              <p>
                <span className="text-muted-foreground">公司回覆</span>
                <br />
                {req.hqNote}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="text-sm font-medium">店家原申請</p>
            {requestedItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {hasApprovedItems
                  ? 'HQ 已調整品項，請以下方核准內容為準。'
                  : '請公司代為配置'}
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {requestedItems.map((it) => (
                  <li key={it.id} className="flex justify-between gap-2">
                    <span className="min-w-0 break-words">{it.product.name}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {it.requestedQuantity}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {hasApprovedItems ? (
          <Card>
            <CardContent className="space-y-2 p-4">
              <p className="text-sm font-medium">HQ 核准內容</p>
              <ul className="space-y-2 text-sm">
                {snapshot
                  ? snapshot.map((line) => (
                      <li key={line.productId} className="flex justify-between gap-2">
                        <span className="min-w-0 break-words">{line.productName}</span>
                        <span className="shrink-0 font-medium">{line.quantity}</span>
                      </li>
                    ))
                  : req.items
                      .filter((it) => (it.approvedQuantity ?? 0) > 0)
                      .map((it) => (
                        <li key={it.id} className="flex justify-between gap-2">
                          <span className="min-w-0 break-words">{it.product.name}</span>
                          <span className="shrink-0 font-medium">{it.approvedQuantity}</span>
                        </li>
                      ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </PosShell>
  );
}
