import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { listJarExchangeProductsForRestock } from '@/lib/restock-request/service';
import { ensureRefillPlanSeeded } from '@/lib/jar-exchange/refill-flavours';
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
  await ensureRefillPlanSeeded();

  const req = await prisma.restockRequest.findUnique({
    where: { id: params.id },
    include: {
      merchant: true,
      items: { include: { product: true } },
      shipment: { select: { id: true, shipmentNumber: true, status: true } },
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
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <Link href="/restock-requests" className="text-sm text-muted-foreground">
        ← 補貨申請列表
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-navy">{req.merchant.name}</h1>
        <p className="text-sm text-muted-foreground">
          {restockRequestTypeLabel(req.requestType)} ·{' '}
          {restockStatusLabelForHq(req.status)} · 店家帳號{' '}
          {req.requestedBy.username}
        </p>
        {req.shipment ? (
          <p className="mt-1 text-sm">
            出貨單：{' '}
            <Link className="text-primary underline" href={`/shipments?s=${req.shipment.id}`}>
              {req.shipment.shipmentNumber}
            </Link>
          </p>
        ) : null}
      </div>

      {req.merchantNote ? (
        <div className="rounded-xl border bg-card p-4 text-sm">
          <p className="text-muted-foreground">店家備註</p>
          <p className="mt-1 whitespace-pre-wrap">{req.merchantNote}</p>
        </div>
      ) : null}

      <HqRestockDetailForm
        requestId={req.id}
        locked={locked}
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
    </div>
  );
}
