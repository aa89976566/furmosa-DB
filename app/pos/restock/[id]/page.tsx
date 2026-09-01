import Link from 'next/link';
import { Check } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getAuthenticatedMerchantId, requireMerchantSession } from '@/lib/merchant-auth';
import { loadPosAccount } from '@/lib/pos/account';
import { resolveFurmosaProductImage } from '@/lib/pos/furmosa-com-images';
import { getRestockRequestForMerchant } from '@/lib/restock-request/service';
import { restockStatusLabelForMerchant, type ApprovedSnapshotLine } from '@/lib/restock-request/constants';
import { PosShell } from '@/components/pos/pos-shell';
import {
  RestockReceiptVerification,
  type ReceiptVerificationItem,
} from '@/components/pos/restock-receipt-verification';
import { Card, CardContent } from '@/components/ui/card';
import { ClearDraftOnSuccess } from './clear-draft-on-success';
import { confirmRestockReceiptAction } from './actions';

export const metadata = { title: '補貨單 · Furmosa 店家' };

const shipmentCopy = {
  pending: { label: 'HQ 已核准，等待備貨', help: 'HQ 正在安排商品與出貨。' },
  packed: { label: '商品已備妥', help: '商品已完成備貨，準備交給物流。' },
  shipped: { label: '商品運送中', help: '商品已離開 HQ，請留意物流進度。' },
  delivered: { label: '商品已送達，待驗收', help: '請逐項核對實收數量。' },
  received: { label: '收貨完成', help: '商品已加入店家庫存。' },
  cancelled: { label: '出貨已取消', help: '請查看公司回覆或聯絡 HQ。' },
} as const;

export default async function PosRestockDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { ok?: string; received?: string };
}) {
  const session = await requireMerchantSession();
  const merchantId = await getAuthenticatedMerchantId();
  const [account, req] = await Promise.all([
    loadPosAccount(session.merchantId, session.username),
    getRestockRequestForMerchant(params.id, merchantId),
  ]);
  if (!req) notFound();

  const shipment = req.shipment;
  const copy = shipment
    ? shipmentCopy[shipment.status as keyof typeof shipmentCopy] ?? {
        label: '補貨處理中',
        help: '最新進度會顯示在這裡。',
      }
    : null;
  const snapshot = (req.approvedSnapshot as ApprovedSnapshotLine[] | null) ?? null;
  const shortId = req.id.slice(0, 8).toUpperCase();
  const justSubmitted = searchParams?.ok === '1';
  const justReceived = searchParams?.received === '1';
  const timeline = shipment
    ? [
        { label: 'HQ 核准', done: true },
        { label: '完成備貨', done: Boolean(shipment.packedAt) },
        { label: '商品出貨', done: Boolean(shipment.shippedAt) },
        { label: '物流送達', done: Boolean(shipment.deliveredAt) },
        { label: '店家驗收', done: shipment.status === 'received' },
      ]
    : [];

  const verificationItems: ReceiptVerificationItem[] = (shipment?.items ?? []).map((item) => ({
    lineId: item.id,
    productId: item.productId,
    name: item.productName,
    sku: item.sku,
    specification: item.weightGrams ? `${item.weightGrams}g` : item.unit || '每件',
    imageUrl: resolveFurmosaProductImage(item.productName, item.product.imageUrl),
    expectedQuantity: item.quantity,
  }));
  const summaryItems =
    verificationItems.length > 0
      ? verificationItems
      : snapshot?.map((item) => ({
          lineId: item.productId,
          productId: item.productId,
          name: item.productName,
          sku: item.sku,
          specification: '每件',
          imageUrl: resolveFurmosaProductImage(
            item.productName,
            req.items.find((line) => line.product.id === item.productId)?.product.imageUrl ?? null,
          ),
          expectedQuantity: item.quantity,
        })) ??
        req.items.map((item) => ({
          lineId: item.id,
          productId: item.product.id,
          name: item.product.name,
          sku: item.product.sku,
          specification: item.product.unit,
          imageUrl: resolveFurmosaProductImage(item.product.name, item.product.imageUrl),
          expectedQuantity: item.approvedQuantity ?? item.requestedQuantity ?? 0,
        }));

  return (
    <PosShell storeName={account.storeName} account={account} wide>
      <main className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6 md:px-8 md:py-8">
        {justSubmitted ? <ClearDraftOnSuccess /> : null}
        <Link href="/pos/restock" className="inline-flex text-sm text-muted-foreground hover:text-foreground">
          ← 補貨
        </Link>
        <header className="pr-16">
          <h1 className="text-2xl font-semibold tracking-tight text-navy md:text-3xl">補貨單</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            編號 {shortId} ・ 送出時間 {req.createdAt.toLocaleString('zh-TW')}
          </p>
        </header>

        {justSubmitted ? (
          <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
            申請已送出，HQ 將開始確認品項。
          </div>
        ) : null}
        {justReceived ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
            收貨完成，商品已加入店家庫存。
          </div>
        ) : null}

        {shipment && copy ? (
          <section className="rounded-2xl border bg-card p-5 md:p-6">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                <Check className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold md:text-xl">{copy.label}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{copy.help}</p>
                <p className="mt-4 text-sm text-muted-foreground">出貨單</p>
                <p className="font-medium">{shipment.shipmentNumber}</p>
                {shipment.trackingNumber ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {shipment.carrier || '物流'} · {shipment.trackingNumber}
                  </p>
                ) : null}
              </div>
            </div>

            <ol className="mt-7 grid grid-cols-5 gap-1" aria-label="補貨處理進度">
              {timeline.map((step, index) => (
                <li key={step.label} className="relative text-center">
                  {index > 0 ? (
                    <span
                      className={`absolute right-1/2 top-4 h-px w-full ${step.done ? 'bg-foreground' : 'bg-border'}`}
                      aria-hidden
                    />
                  ) : null}
                  <span
                    className={`relative z-10 mx-auto flex h-8 w-8 items-center justify-center rounded-full border text-xs ${
                      step.done
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border bg-card text-muted-foreground'
                    }`}
                  >
                    {step.done ? <Check className="h-4 w-4" /> : null}
                  </span>
                  <span className="mt-2 block text-[11px] leading-tight md:text-sm">{step.label}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : (
          <Card>
            <CardContent className="p-5 text-sm">
              {restockStatusLabelForMerchant(req.status)}，建立出貨單後會在這裡顯示進度。
            </CardContent>
          </Card>
        )}

        <section className="rounded-2xl border bg-card px-5 py-4 md:px-6">
          <p className="text-sm text-muted-foreground">預計到貨</p>
          <p className="mt-1 font-medium">
            {req.expectedArrivalDate
              ? req.expectedArrivalDate.toLocaleDateString('zh-TW')
              : 'HQ 確認後提供'}
          </p>
          {req.hqNote ? <p className="mt-3 text-sm text-muted-foreground">HQ：{req.hqNote}</p> : null}
        </section>

        {shipment?.status === 'delivered' && verificationItems.length > 0 ? (
          <RestockReceiptVerification
            requestId={req.id}
            items={verificationItems}
            action={confirmRestockReceiptAction}
          />
        ) : (
          <section className="rounded-2xl border bg-card p-5 md:p-6">
            <h2 className="text-base font-semibold md:text-lg">
              {shipment?.status === 'received' ? '已收貨品項' : '補貨品項'}
            </h2>
            <ul className="mt-3 divide-y">
              {summaryItems.map((item) => (
                <li key={item.lineId} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="block font-medium">{item.name}</span>
                    <span className="text-muted-foreground">{item.sku}</span>
                  </span>
                  <span className="shrink-0 font-medium">{item.expectedQuantity} 件</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </PosShell>
  );
}
