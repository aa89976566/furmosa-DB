import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { prisma } from '@/lib/prisma';
import { formatDateTime } from '@/lib/format';
import { PartnerReviewForm } from './partner-review-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: '店家合作申請 · Furmosa HQ' };

function displayJson(value: unknown) {
  if (value == null) return '—';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function modeLabel(mode: string) {
  if (mode === 'consign') return '寄賣合作';
  if (mode === 'stock' || mode === 'wholesale') return '店家進貨';
  return mode || '未指定合作方式';
}

export default async function PartnerApplicationPage(
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  const application = await prisma.partnerApplication.findUnique({
    where: { id },
    include: { reviewedBy: { select: { name: true, email: true } } },
  });
  if (!application) notFound();

  const pending = application.status === 'pending_review';
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <Link href="/reviews" className="inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-foreground">
        ← 待審核
      </Link>
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-navy md:text-3xl">{application.storeName}</h1>
            <Badge variant={pending ? 'default' : 'secondary'}>
              {pending ? '待審核' : application.status === 'approved' ? '已核准' : '已退回'}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {application.applicationNo} · {modeLabel(application.mode)} · {formatDateTime(application.createdAt)}
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.85fr)]">
        <div className="space-y-6">
          <section className="rounded-2xl border bg-card p-5">
            <h2 className="font-semibold">店家資料</h2>
            <dl className="mt-4 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
              <Detail label="店家名稱" value={application.storeName} />
              <Detail label="店家類型" value={application.storeType} />
              <Detail label="聯絡人" value={application.contactName} />
              <Detail label="電話" value={application.phone} />
              <Detail label="Email" value={application.email} />
              <Detail label="LINE" value={application.lineId} />
              <Detail label="統一編號" value={application.taxId} />
              <Detail label="預計開始" value={application.expectedStart} />
              <Detail label="地址" value={application.address} full />
            </dl>
          </section>

          <section className="rounded-2xl border bg-card p-5">
            <h2 className="font-semibold">合作內容</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
              {application.description || application.summary || '未填寫'}
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <JsonBlock label="品項與數量" value={application.items} />
              <JsonBlock label="金額摘要" value={application.totals} />
              <JsonBlock label="套用條件" value={application.terms} />
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          {pending ? <PartnerReviewForm applicationId={application.id} /> : (
            <section className="rounded-2xl border bg-card p-5">
              <h2 className="font-semibold">處理結果</h2>
              <p className="mt-3 text-sm text-muted-foreground">
                {application.reviewedAt ? formatDateTime(application.reviewedAt) : '—'}
                {application.reviewedBy ? ` · ${application.reviewedBy.name}` : ''}
              </p>
              <p className="mt-4 whitespace-pre-wrap text-sm">{application.reviewNote || '未留下備註'}</p>
            </section>
          )}
          <section className="rounded-2xl border bg-card p-5">
            <h2 className="font-semibold">申請備註</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{application.notes || '未填寫'}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Detail({ label, value, full = false }: { label: string; value: string | null; full?: boolean }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap">{value || '—'}</dd>
    </div>
  );
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-xl bg-muted/30 p-3">
      <h3 className="text-sm font-medium">{label}</h3>
      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">{displayJson(value)}</pre>
    </div>
  );
}
