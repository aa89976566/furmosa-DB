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

export const metadata = { title: '補口味申請 · Furmosa 店家' };

export default async function PosRestockDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { ok?: string };
}) {
  await requireMerchantSession();
  const merchantId = await getAuthenticatedMerchantId();
  const req = await getRestockRequestForMerchant(params.id, merchantId);
  if (!req) notFound();

  const snapshot = (req.approvedSnapshot as ApprovedSnapshotLine[] | null) ?? null;
  const shortId = req.id.slice(0, 8).toUpperCase();
  const justSubmitted = searchParams?.ok === '1';

  return (
    <PosShell>
      <div className="space-y-4 px-4 py-6">
        {justSubmitted ? <ClearDraftOnSuccess /> : null}
        <Link href="/pos/restock/progress" className="text-xs text-muted-foreground">
          ← 申請進度
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
            <h1 className="text-xl font-semibold text-navy">補口味申請</h1>
            <p className="text-sm text-muted-foreground">
              {restockRequestTypeLabel(req.requestType)} · 編號 {shortId}
            </p>
            <p className="text-xs text-muted-foreground">
              送出時間 {req.createdAt.toLocaleString('zh-TW')}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-medium">
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
            <p className="text-sm font-medium">申請品項</p>
            {req.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">請公司代為配置</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {req.items.map((it) => (
                  <li key={it.id} className="flex justify-between gap-2">
                    <span className="min-w-0 break-words">{it.product.name}</span>
                    <span className="shrink-0 text-muted-foreground">
                      申請 {it.requestedQuantity ?? 0}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {(snapshot && snapshot.length > 0) ||
        req.items.some((it) => (it.approvedQuantity ?? 0) > 0 && req.status !== 'submitted') ? (
          <Card>
            <CardContent className="space-y-2 p-4">
              <p className="text-sm font-medium">已確認品項</p>
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
