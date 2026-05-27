import { prisma } from '@/lib/prisma';
import { JarPanel } from '@/components/jar-exchange/jar-shell';
import { Badge } from '@/components/ui/badge';
import { formatDateTime, formatNumber } from '@/lib/format';
import { ledgerSourceLabel } from '@/lib/jar-exchange/labels';
import { ManualPointsForm } from '@/components/jar-exchange/manual-points-form';

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
    include: { customer: { select: { name: true, customerId: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const customers = await prisma.customer.findMany({
    select: { id: true, name: true, customerId: true },
    orderBy: { name: 'asc' },
    take: 500,
  });

  return (
    <div className="space-y-4">
      <JarPanel>
        <div className="border-b border-border/60 p-4">
          <h3 className="text-sm font-medium">人工調整點數</h3>
          <ManualPointsForm customers={customers} />
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
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateTime(e.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{e.customer.name}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">
                      {e.customer.customerId}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{ledgerSourceLabel[e.sourceType] ?? e.sourceType}</Badge>
                  </td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums font-medium ${e.pointsChange >= 0 ? 'text-success' : 'text-info'}`}
                  >
                    {e.pointsChange > 0 ? '+' : ''}
                    {formatNumber(e.pointsChange)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatNumber(e.balanceAfter)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </JarPanel>
    </div>
  );
}
