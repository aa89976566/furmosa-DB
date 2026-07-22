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
import { Card, CardContent } from '@/components/ui/card';

export const metadata = { title: '補貨詳情 · Furmosa 店家' };

export default async function PosRestockDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireMerchantSession();
  const merchantId = await getAuthenticatedMerchantId();
  const req = await getRestockRequestForMerchant(params.id, merchantId);
  if (!req) notFound();

  const snapshot = (req.approvedSnapshot as ApprovedSnapshotLine[] | null) ?? null;

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-6">
      <Link href="/pos/restock" className="text-xs text-muted-foreground">
        ← 補貨列表
      </Link>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-navy">補貨申請</h1>
          <p className="text-sm text-muted-foreground">
            {restockRequestTypeLabel(req.requestType)} ·{' '}
            {req.createdAt.toLocaleString('zh-TW')}
          </p>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">
          {restockStatusLabelForMerchant(req.status)}
        </span>
      </div>

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
          ) : null}
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
          <p className="text-sm font-medium">申請品項</p>
          {req.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">請公司代為配置</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {req.items.map((it) => (
                <li key={it.id} className="flex justify-between gap-2">
                  <span>{it.product.name}</span>
                  <span className="text-muted-foreground">
                    申請 {it.requestedQuantity ?? 0}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {(snapshot && snapshot.length > 0) ||
      req.items.some((it) => (it.approvedQuantity ?? 0) > 0) ? (
        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="text-sm font-medium">已確認品項</p>
            <ul className="space-y-2 text-sm">
              {snapshot
                ? snapshot.map((line) => (
                    <li key={line.productId} className="flex justify-between gap-2">
                      <span>{line.productName}</span>
                      <span className="font-medium">{line.quantity}</span>
                    </li>
                  ))
                : req.items
                    .filter((it) => (it.approvedQuantity ?? 0) > 0)
                    .map((it) => (
                      <li key={it.id} className="flex justify-between gap-2">
                        <span>{it.product.name}</span>
                        <span className="font-medium">{it.approvedQuantity}</span>
                      </li>
                    ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
