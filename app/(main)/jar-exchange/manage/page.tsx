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

export const dynamic = 'force-dynamic';

const TABS = ['codes', 'ledger', 'rewards'] as const;

export default async function JarExchangeManagePage({
  searchParams,
}: {
  searchParams?: { tab?: string; q?: string; member?: string; page?: string };
}) {
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
        <CodesTab q={q} page={page} pageSize={pageSize} />
      ) : null}
      {tab === 'ledger' ? <LedgerAdmin member={member} /> : null}
      {tab === 'rewards' ? <RewardCatalogAdmin /> : null}
    </JarShell>
  );
}

async function CodesTab({
  q,
  page,
  pageSize,
}: {
  q: string;
  page: number;
  pageSize: number;
}) {
  const products = await prisma.product.findMany({
    where: { status: 'active', productCategory: 'JAR_EXCHANGE' },
    select: { id: true, name: true, sku: true },
    orderBy: { name: 'asc' },
  });
  return (
    <>
      <CodesAdminTools products={products} />
      <CodesTable q={q} page={page} pageSize={pageSize} />
    </>
  );
}

async function CodesTable({
  q,
  page,
  pageSize,
}: {
  q: string;
  page: number;
  pageSize: number;
}) {
  const where = {
    ...(q ? { code: { contains: q, mode: 'insensitive' as const } } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.jarCode.findMany({
      where,
      include: {
        redeemedByCustomer: { select: { id: true, name: true, customerId: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.jarCode.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <JarPanel>
      <form className="border-b border-border/60 p-4" method="get">
        <input type="hidden" name="tab" value="codes" />
        <input
          name="q"
          defaultValue={q}
          placeholder="搜尋序號…"
          className="h-9 max-w-xs rounded-xl border border-input bg-card px-3 text-sm"
        />
      </form>
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
                <td className="px-4 py-3 font-mono text-xs">{row.code}</td>
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
                  <JarCodeDeleteButton id={row.id} code={row.code} used={row.status === 'used'} />
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
              <Link href={`/jar-exchange/manage?tab=codes&page=${page - 1}${q ? `&q=${q}` : ''}`}>
                上一頁
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link href={`/jar-exchange/manage?tab=codes&page=${page + 1}${q ? `&q=${q}` : ''}`}>
                下一頁
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </JarPanel>
  );
}
