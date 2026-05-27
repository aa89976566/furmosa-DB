import { prisma } from '@/lib/prisma';
import { JarPanel } from '@/components/jar-exchange/jar-shell';
import { RewardCatalogForm } from '@/components/jar-exchange/reward-catalog-form';
import { formatCurrency } from '@/lib/format';
import { rewardActiveLabel } from '@/lib/jar-exchange/labels';
import { Badge } from '@/components/ui/badge';

export async function RewardCatalogAdmin() {
  const [rewards, merchants] = await Promise.all([
    prisma.rewardCatalog.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { partnerMerchant: { select: { name: true } } },
    }),
    prisma.merchant.findMany({
      where: { status: 'active' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <div className="space-y-4">
      <JarPanel>
        <div className="border-b border-border/60 p-4">
          <h3 className="mb-3 text-sm font-medium">新增美容券獎勵</h3>
          <RewardCatalogForm merchants={merchants} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-3">獎勵名稱</th>
                <th className="px-4 py-3 text-right">所需點數</th>
                <th className="px-4 py-3 text-right">券面額</th>
                <th className="px-4 py-3 text-right">公司成本</th>
                <th className="px-4 py-3">合作店家</th>
                <th className="px-4 py-3">狀態</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rewards.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium">{r.rewardName}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.pointsRequired} 點</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(r.couponFaceValue)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(r.internalCost)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.partnerMerchant?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={r.activeStatus === 'active' ? 'success' : 'muted'}>
                      {rewardActiveLabel[r.activeStatus] ?? r.activeStatus}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </JarPanel>
    </div>
  );
}
