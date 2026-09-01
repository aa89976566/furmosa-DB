import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { JarPanel } from '@/components/jar-exchange/jar-shell';
import { Badge } from '@/components/ui/badge';
import { formatDateTime, formatNumber } from '@/lib/format';
import { ledgerSourceLabel } from '@/lib/jar-exchange/labels';

export async function LedgerAdmin({ member }: { member?: string }) {
  const customerQ = (member ?? '').trim();

  const entries = await prisma.memberPointsLedger.findMany({
    where: customerQ
      ? {
          customer: {
            OR: [
              { name: { contains: customerQ, mode: 'insensitive' } },
              { customerId: { contains: customerQ, mode: 'insensitive' } },
            ],
          },
        }
      : undefined,
    include: { customer: { select: { id: true, name: true, customerId: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <JarPanel>
        <div className="border-b border-border/60 p-4">
          <h3 className="text-sm font-semibold text-navy">點數帳本</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            此頁僅供查詢。若要人工調整，請先開啟正確會員，再從「點數摘要」進入調整頁。
          </p>
        </div>
        <form className="border-b border-border/60 p-4" method="get">
          <input type="hidden" name="tab" value="ledger" />
          <input
            name="member"
            defaultValue={customerQ}
            placeholder="搜尋會員姓名或編號…"
            className="h-9 max-w-xs rounded-xl border border-input bg-card px-3 text-sm"
          />
        </form>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-3">時間</th>
                <th className="px-4 py-3">會員</th>
                <th className="px-4 py-3">來源</th>
                <th className="px-4 py-3 text-right">變動</th>
                <th className="px-4 py-3 text-right">餘額</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center">
                    <p className="font-medium text-navy">找不到點數流水</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      請改用會員姓名或會員編號搜尋；新會員也可能尚未有流水。
                    </p>
                  </td>
                </tr>
              ) : (
                entries.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDateTime(e.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      {e.customer?.id ? (
                        <Link
                          href={`/customers/${e.customer.id}`}
                          className="group block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                        >
                          <div className="font-medium text-navy group-hover:underline">
                            {e.customer.name}
                          </div>
                          <div className="font-mono text-[10px] text-muted-foreground">
                            {e.customer.customerId}
                          </div>
                        </Link>
                      ) : (
                        <>
                          <div className="font-medium">{e.customer?.name ?? '—'}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">
                            {e.customer?.customerId ?? '—'}
                          </div>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">
                        {ledgerSourceLabel[e.sourceType] ?? e.sourceType}
                      </Badge>
                    </td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums font-medium ${e.pointsChange >= 0 ? 'text-success' : 'text-info'}`}
                    >
                      {e.pointsChange > 0 ? '+' : ''}
                      {formatNumber(e.pointsChange)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatNumber(e.balanceAfter)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </JarPanel>
    </div>
  );
}
