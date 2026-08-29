import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { listJarExchangeProductsForRestock } from '@/lib/restock-request/service';
import {
  restockRequestTypeLabel,
  restockStatusLabelForHq,
} from '@/lib/restock-request/constants';
import {
  canAccessHqRestockInbox,
  restockRequestNumber,
} from '@/lib/restock-request/hq-inbox';
import {
  canAddHqRestockCatalogItems,
  canShowHqRestockReviewForm,
  hqRestockAllowedActionLabels,
  hqRestockDetailViewMode,
} from '@/lib/restock-request/review-policy';
import { HqRestockDetailForm } from './hq-restock-form';

export const metadata = { title: '補貨申請詳情 · Furmosa HQ' };
export const dynamic = 'force-dynamic';

export default async function HqRestockRequestDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (
    !canAccessHqRestockInbox({
      hasHqSession: Boolean(user),
      hasMerchantSession: false,
    })
  ) {
    redirect('/login');
  }

  const req = await prisma.restockRequest.findUnique({
    where: { id: params.id },
    include: {
      merchant: true,
      items: { include: { product: true } },
      shipment: { select: { id: true, shipmentNumber: true, status: true } },
      requestedBy: { select: { username: true } },
      approvedBy: { select: { name: true } },
    },
  });
  if (!req) notFound();

  const catalog = await listJarExchangeProductsForRestock();
  const viewMode = hqRestockDetailViewMode(req.status, req.shipmentId);
  const showForm = canShowHqRestockReviewForm(req.status, req.shipmentId);
  const allowedActions = hqRestockAllowedActionLabels(req.status, req.shipmentId);
  const itemRows = req.items.map((it) => ({
    productId: it.productId,
    productName: it.product.name,
    requestedQuantity: it.requestedQuantity,
    approvedQuantity: it.approvedQuantity ?? it.requestedQuantity ?? 0,
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <Link href="/restock-requests" className="text-sm text-muted-foreground">
        ← 補貨申請列表
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-navy">{req.merchant.name}</h1>
        <p className="text-sm text-muted-foreground">
          申請編號 {restockRequestNumber(req.id)} · {restockRequestTypeLabel(req.requestType)} ·{' '}
          {restockStatusLabelForHq(req.status)}
        </p>
        <p className="text-sm text-muted-foreground">
          店家編號 {req.merchant.merchantId}
          {req.requestedBy.username ? ` · 送出帳號 ${req.requestedBy.username}` : ''}
        </p>
        <p className="text-sm text-muted-foreground">
          送出 {req.createdAt.toLocaleString('zh-TW')} · 更新 {req.updatedAt.toLocaleString('zh-TW')}
        </p>
        {req.approvedAt ? (
          <p className="text-sm text-muted-foreground">
            核准 {req.approvedAt.toLocaleString('zh-TW')}
            {req.approvedBy?.name ? ` · ${req.approvedBy.name}` : ''}
          </p>
        ) : null}
        {req.rejectedAt ? (
          <p className="text-sm text-muted-foreground">
            拒絕 {req.rejectedAt.toLocaleString('zh-TW')}
          </p>
        ) : null}
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

      {req.hqNote ? (
        <div className="rounded-xl border bg-card p-4 text-sm">
          <p className="text-muted-foreground">審核備註</p>
          <p className="mt-1 whitespace-pre-wrap">{req.hqNote}</p>
        </div>
      ) : null}

      <div className="rounded-xl border bg-card p-4 text-sm">
        <p className="mb-2 font-medium">目前可進行的操作</p>
        {allowedActions.length > 0 ? (
          <p>{allowedActions.join('、')}</p>
        ) : (
          <p className="text-muted-foreground">這張申請已結束，只能查看結果。</p>
        )}
      </div>

      {showForm ? (
        <HqRestockDetailForm
          key={`${req.id}-${req.updatedAt.toISOString()}`}
          requestId={req.id}
          detailHref={`/restock-requests/${req.id}`}
          viewMode={viewMode === 'result' ? 'review' : viewMode}
          allowCatalogAdds={canAddHqRestockCatalogItems(
            req.status,
            req.items.length,
            req.shipmentId,
          )}
          hqNote={req.hqNote ?? ''}
          expectedArrivalDate={
            req.expectedArrivalDate
              ? req.expectedArrivalDate.toISOString().slice(0, 10)
              : ''
          }
          items={itemRows}
          catalog={catalog.map((p) => ({ id: p.id, name: p.name }))}
        />
      ) : (
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <p className="text-sm font-medium">申請結果</p>
          {itemRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">沒有品項</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {itemRows.map((item) => (
                <li
                  key={item.productId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2"
                >
                  <span className="font-medium">{item.productName}</span>
                  <span className="text-muted-foreground">
                    申請 {item.requestedQuantity ?? '—'} · 核准 {item.approvedQuantity}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
