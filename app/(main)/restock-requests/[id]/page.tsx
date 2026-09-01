import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Check, Clock3, PackageCheck } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate, formatDateTime } from '@/lib/format';
import { listJarExchangeProductsForRestock } from '@/lib/restock-request/service';
import {
  restockRequestTypeLabel,
  restockStatusLabelForHq,
} from '@/lib/restock-request/constants';
import { HqRestockDetailForm } from './hq-restock-form';

export const metadata = { title: '補貨申請詳情 · Furmosa HQ' };

export default async function HqRestockRequestDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const req = await prisma.restockRequest.findUnique({
    where: { id: params.id },
    include: {
      merchant: true,
      items: { include: { product: true } },
      shipment: {
        select: {
          id: true,
          shipmentNumber: true,
          status: true,
          createdAt: true,
          packedAt: true,
          shippedAt: true,
          deliveredAt: true,
        },
      },
      requestedBy: { select: { username: true } },
    },
  });
  if (!req) notFound();

  const catalog = await listJarExchangeProductsForRestock();
  const locked =
    Boolean(req.shipmentId) ||
    req.status === 'converted_to_shipment' ||
    req.status === 'rejected' ||
    req.status === 'cancelled';

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <Link
        href="/restock-requests"
        className="inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-foreground"
      >
        ← 補貨申請列表
      </Link>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-navy md:text-3xl">
              {req.merchant.name}
            </h1>
            <Badge variant={req.status === 'converted_to_shipment' ? 'success' : 'secondary'}>
              {restockStatusLabelForHq(req.status)}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            申請編號 {req.id.slice(0, 8).toUpperCase()} ·{' '}
            {restockRequestTypeLabel(req.requestType)} · 店家帳號{' '}
            {req.requestedBy.username}
          </p>
        </div>
      </div>

      {locked ? (
        <CompletedRestockRequest request={req} />
      ) : (
        <>
          {req.merchantNote ? (
            <div className="rounded-xl border bg-card p-4 text-sm">
              <p className="text-muted-foreground">店家備註</p>
              <p className="mt-1 whitespace-pre-wrap">{req.merchantNote}</p>
            </div>
          ) : null}

          <HqRestockDetailForm
            requestId={req.id}
            locked={false}
            hqNote={req.hqNote ?? ''}
            expectedArrivalDate={
              req.expectedArrivalDate
                ? req.expectedArrivalDate.toISOString().slice(0, 10)
                : ''
            }
            items={req.items.map((it) => ({
              productId: it.productId,
              productName: it.product.name,
              requestedQuantity: it.requestedQuantity,
              approvedQuantity: it.approvedQuantity ?? it.requestedQuantity ?? 0,
            }))}
            catalog={catalog.map((p) => ({ id: p.id, name: p.name }))}
          />
        </>
      )}
    </div>
  );
}

type CompletedRequest = {
  status: string;
  createdAt: Date;
  updatedAt: Date;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  expectedArrivalDate: Date | null;
  merchantNote: string | null;
  hqNote: string | null;
  shipment: {
    id: string;
    shipmentNumber: string;
    status: string;
    createdAt: Date;
    packedAt: Date | null;
    shippedAt: Date | null;
    deliveredAt: Date | null;
  } | null;
  items: Array<{
    id: string;
    requestedQuantity: number | null;
    approvedQuantity: number | null;
    product: { name: string; sku: string };
  }>;
};

function CompletedRestockRequest({ request }: { request: CompletedRequest }) {
  const shipment = request.shipment;
  const converted = request.status === 'converted_to_shipment' && Boolean(shipment);
  const approvedTotal = request.items.reduce(
    (sum, item) =>
      sum + (item.approvedQuantity ?? item.requestedQuantity ?? 0),
    0,
  );

  const decision =
    request.status === 'rejected'
      ? { label: 'HQ 拒絕申請', at: request.rejectedAt }
      : request.status === 'cancelled'
        ? { label: '申請已取消', at: request.updatedAt }
        : { label: 'HQ 完成核准', at: request.approvedAt };

  const timeline = [
    { label: '店家送出申請', at: request.createdAt },
    decision,
    { label: '建立出貨單', at: shipment?.createdAt },
    { label: '商品完成備貨', at: shipment?.packedAt },
    { label: '商品出貨', at: shipment?.shippedAt },
    { label: '店家收到商品', at: shipment?.deliveredAt },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-5 md:p-6">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
              {converted ? <PackageCheck className="h-5 w-5" /> : <Check className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                {converted ? '補貨申請已核准' : restockStatusLabelForHq(request.status)}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {converted
                  ? `共核准 ${approvedTotal} 件商品，出貨單已送至出貨隊列。`
                  : '此申請已結束，以下保留當時的處理結果。'}
              </p>
              {shipment ? (
                <p className="mt-2 font-mono text-sm font-medium">
                  {shipment.shipmentNumber}
                </p>
              ) : null}
            </div>
          </div>
          {shipment ? (
            <Button asChild className="w-full md:w-auto">
              <Link href={`/shipments?s=${shipment.id}`}>
                查看出貨單
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          ) : null}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(17rem,1fr)]">
        <section className="overflow-hidden rounded-2xl border bg-card">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">補貨品項</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              比對店家申請數量與 HQ 最後核准數量
            </p>
          </div>
          <div className="hidden grid-cols-[minmax(0,1fr)_7rem_7rem] gap-4 border-b bg-muted/30 px-5 py-3 text-xs font-medium text-muted-foreground sm:grid">
            <span>商品</span>
            <span className="text-right">申請</span>
            <span className="text-right">核准</span>
          </div>
          <ul className="divide-y">
            {request.items.map((item) => (
              <li
                key={item.id}
                className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_7rem_7rem] sm:items-center sm:gap-4"
              >
                <div>
                  <p className="font-medium">{item.product.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.product.sku}
                  </p>
                </div>
                <div className="flex justify-between text-sm sm:block sm:text-right">
                  <span className="text-muted-foreground sm:hidden">申請</span>
                  <span>{item.requestedQuantity ?? '—'}</span>
                </div>
                <div className="flex justify-between text-sm sm:block sm:text-right">
                  <span className="text-muted-foreground sm:hidden">核准</span>
                  <span className="font-semibold">
                    {item.approvedQuantity ?? item.requestedQuantity ?? 0}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl border bg-card p-5">
            <h2 className="font-semibold">申請資料</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <DetailRow
                label="預計到貨"
                value={request.expectedArrivalDate ? formatDate(request.expectedArrivalDate) : '未設定'}
              />
              <DetailRow label="店家備註" value={request.merchantNote || '未填寫'} />
              <DetailRow label="公司備註" value={request.hqNote || '未填寫'} />
            </dl>
          </section>

          <section className="rounded-2xl border bg-card p-5">
            <h2 className="font-semibold">處理紀錄</h2>
            <ol className="mt-4 space-y-4">
              {timeline.map((step, index) => (
                <li key={step.label} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-full ${step.at ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
                      {step.at ? <Check className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
                    </div>
                    {index < timeline.length - 1 ? (
                      <div className="mt-1 h-full min-h-4 w-px bg-border" />
                    ) : null}
                  </div>
                  <div className="pb-2">
                    <p className="text-sm font-medium">{step.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {step.at ? formatDateTime(step.at) : '尚未完成'}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-wrap text-right font-medium">{value}</dd>
    </div>
  );
}
