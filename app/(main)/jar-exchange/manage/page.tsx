import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { JarShell, JarPanel } from '@/components/jar-exchange/jar-shell';
import { CodesAdminTools } from '@/components/jar-exchange/codes-admin';
import { RewardCatalogAdmin } from '@/components/jar-exchange/reward-catalog-admin';
import { LedgerAdmin } from '@/components/jar-exchange/ledger-admin';
import { Badge } from '@/components/ui/badge';
import { JarCodeDeleteButton } from '@/components/jar-exchange/jar-code-delete-button';
import { formatDateTime } from '@/lib/format';
import { jarCodeStatusLabel } from '@/lib/jar-exchange/labels';
import { safeAvailableJarCodeWhere, JAR_CODE_ORDER, managementJarCodeWhere } from '@/lib/jar-exchange/code-management';

export const dynamic = 'force-dynamic';

const TABS = ['codes', 'ledger', 'rewards'] as const;

export default async function JarExchangeManagePage(
  props: {
    searchParams?: Promise<{ tab?: string; q?: string; member?: string; page?: string; status?: string; batch?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const tab = TABS.includes(searchParams?.tab as (typeof TABS)[number])
    ? (searchParams!.tab as (typeof TABS)[number])
    : 'codes';
  const q = (searchParams?.q ?? '').trim().toUpperCase();
  const member = (searchParams?.member ?? '').trim();
  const page = Math.max(1, parseInt(searchParams?.page ?? '1', 10) || 1);
  const pageSize = 50;

  const tabTitle =
    tab === 'codes' ? '序號管理' : tab === 'ledger' ? '點數帳本' : '禮品兌換';

  return (
    <JarShell
      pathname="/jar-exchange/manage"
      tab={tab}
      title={tabTitle}
      description="序號、點數流水與美容券獎勵目錄"
    >
      {tab === 'codes' ? (
        <>
          <CodesAdminTools />
          <CodesTable q={q} page={page} pageSize={pageSize} status={searchParams?.status ?? ''} batch={searchParams?.batch?.trim() ?? ''} />
        </>
      ) : null}
      {tab === 'ledger' ? <LedgerAdmin member={member} /> : null}
      {tab === 'rewards' ? <RewardCatalogAdmin /> : null}
    </JarShell>
  );
}

async function CodesTable({
  q,
  page,
  pageSize,
  status,
  batch,
}: {
  q: string;
  page: number;
  pageSize: number;
  status: string;
  batch: string;
}) {
  const available = await safeAvailableJarCodeWhere(prisma);
  const validStatus = ['available', 'unused', 'issued', 'returned', 'used', 'expired'].includes(status) ? status : '';
  const where = managementJarCodeWhere(available, { status: validStatus, batch, q });

  const [rows, total, availableCount, groups] = await Promise.all([
    prisma.jarCode.findMany({
      where,
      include: {
        redeemedByCustomer: { select: { id: true, name: true, customerId: true } },
      },
      orderBy: JAR_CODE_ORDER,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.jarCode.count({ where }),
    prisma.jarCode.count({ where: available }),
    prisma.jarCode.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageUrl = (next: number) => `/jar-exchange/manage?${new URLSearchParams({ tab: 'codes', page: String(next), q, status: validStatus, batch })}`;

  return (
    <JarPanel>
      <div className="grid grid-cols-2 gap-3 border-b p-4 lg:grid-cols-6">
        <Link href="/jar-exchange/manage?tab=codes&status=available" className="rounded-xl border p-3"><span className="block text-xs text-muted-foreground">可發放（已核對）</span><strong className="text-xl">{availableCount}</strong></Link>
        {groups.map(group => <Link key={group.status} href={`/jar-exchange/manage?tab=codes&status=${encodeURIComponent(group.status)}`} className="rounded-xl border p-3"><span className="block text-xs text-muted-foreground">{jarCodeStatusLabel[group.status] ?? group.status}</span><strong className="text-xl">{group._count._all}</strong></Link>)}
      </div>
      <form className="flex flex-wrap items-center gap-3 border-b border-border/60 p-4" method="get">
        <input type="hidden" name="tab" value="codes" />
        <input
          aria-label="搜尋序號"
          name="q"
          defaultValue={q}
          placeholder="搜尋序號…"
          className="h-9 max-w-xs rounded-xl border border-input bg-card px-3 text-sm"
        />
        <select name="status" defaultValue={validStatus} aria-label="序號狀態" className="h-9 rounded-xl border bg-card px-3 text-sm">
          <option value="">全部狀態</option><option value="available">可發放（已核對）</option>
          {Object.entries(jarCodeStatusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <input name="batch" defaultValue={batch} aria-label="批次" placeholder="批次編號" className="h-9 rounded-xl border bg-card px-3 text-sm" />
        <button className="h-9 rounded-xl bg-primary px-4 text-primary-foreground">搜尋</button>
        <Link className="rounded-xl border px-4 py-2 text-sm" href={`/api/jar-exchange/codes/export${batch ? `?batch=${encodeURIComponent(batch)}` : ''}`}>匯出{batch ? '該批次' : '全部'}可發放 Excel</Link>
      </form>
      <p className="px-4 py-3 text-xs text-muted-foreground">可發放名單會排除持有、使用、占用、歷史使用與客服指定序號。匯出內容為下載當下的資料快照。</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-4 py-3">序號</th>
              <th className="px-4 py-3">批次</th>
              <th className="px-4 py-3">狀態</th>
              <th className="px-4 py-3">使用者</th>
              <th className="px-4 py-3">使用時間</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3 font-mono text-xs"><Link href={`/jar-exchange/manage/codes/${row.id}`} className="underline underline-offset-4">{row.code}</Link></td>
                <td className="px-4 py-3 text-muted-foreground">
                  {row.batchNo ? (
                    <Link
                      href={`/jar-exchange/codes?batch=${encodeURIComponent(row.batchNo)}&status=unused`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                      title="開啟 A4 列印"
                    >
                      {row.batchNo}
                    </Link>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={row.status === 'used' ? 'success' : 'secondary'}>
                    {jarCodeStatusLabel[row.status] ?? row.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  {row.redeemedByCustomer ? (
                    <Link href={`/customers/${row.redeemedByCustomer.id}`} className="hover:underline">
                      {row.redeemedByCustomer.name}
                    </Link>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {row.redeemedAt ? formatDateTime(row.redeemedAt) : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <JarCodeDeleteButton id={row.id} code={row.code} used={row.status !== 'unused' || Boolean(row.redeemedByCustomerId || row.lockedByRefillOrderId || row.issuedAt || row.redeemedAt || row.returnedAt)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 ? (
        <div className="flex justify-between border-t px-4 py-2 text-xs text-muted-foreground">
          <span>
            第 {page}/{totalPages} 頁 · 共 {total} 筆
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link href={pageUrl(page - 1)}>
                上一頁
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link href={pageUrl(page + 1)}>
                下一頁
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </JarPanel>
  );
}
