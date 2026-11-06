import { notFound, redirect } from 'next/navigation';

import { PageHeader } from '@/components/shared/page-header';
import { getCurrentUser } from '@/lib/auth';
import {
  loadRefillHistoryAudit,
  type RefillHistoryAnomalyType,
} from '@/lib/refill/history-audit';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const TYPE_LABELS: Record<RefillHistoryAnomalyType, string> = {
  DUPLICATE_ELIGIBILITY: '重複空罐資格',
  PRICE_MISMATCH: '價格不符合規則',
  PAID_NOT_DELIVERED: '付款後尚未交付',
  DELIVERED_WITHOUT_STOCK_TXN: '已交付但沒有扣庫存',
  DUPLICATE_POINTS: '重複加點',
  MISSING_RECONCILIATION: '缺少對帳來源',
};

const AUDIT_ROLES = new Set(['admin', 'inventory_reviewer']);

function taipeiTime(value: string) {
  return new Intl.DateTimeFormat('zh-TW', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Taipei',
  }).format(new Date(value));
}

export default async function RefillAuditPage() {
  const session = await getCurrentUser();
  if (!session) redirect('/login?next=/refill/audit');
  if (!AUDIT_ROLES.has(session.role)) notFound();

  const report = await loadRefillHistoryAudit(prisma);
  const total = report.anomalies.length;
  const visible = report.anomalies.slice(0, 200);

  return (
    <>
      <PageHeader
        title="換罐歷史異常盤點"
        description="只讀取正式資料並產生檢查結果，不會修改訂單、付款、庫存、點數或對帳"
      />
      <div className="space-y-5 p-4 sm:p-6">
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">本次盤點結果</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">{total} 筆異常</p>
            </div>
            <p className="text-sm text-muted-foreground">產生時間 {taipeiTime(report.generatedAt)}</p>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            「付款後尚未交付」以付款超過 7 天為判定基準。本頁沒有修復按鈕，任何資料修正都必須另行審核
          </p>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(Object.entries(TYPE_LABELS) as Array<[RefillHistoryAnomalyType, string]>).map(([type, label]) => (
            <div key={type} className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums">{report.totals[type]}</p>
            </div>
          ))}
        </section>

        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border p-4 sm:p-5">
            <h2 className="font-semibold">異常明細</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {total > visible.length ? `顯示前 ${visible.length} 筆，共 ${total} 筆` : `共 ${total} 筆`}
            </p>
          </div>
          {visible.length ? (
            <div className="divide-y divide-border">
              {visible.map((anomaly) => (
                <article key={`${anomaly.type}:${anomaly.key}`} className="grid gap-2 p-4 sm:grid-cols-[12rem_minmax(0,1fr)] sm:p-5">
                  <div>
                    <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
                      {TYPE_LABELS[anomaly.type]}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium">{anomaly.summary}</p>
                    <p className="mt-1 break-all text-sm text-muted-foreground">
                      識別：{anomaly.key}
                    </p>
                    {anomaly.orderIds.length ? (
                      <p className="mt-1 break-all text-sm text-muted-foreground">
                        訂單：{anomaly.orderIds.join('、')}
                      </p>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">目前沒有偵測到異常</div>
          )}
        </section>
      </div>
    </>
  );
}
