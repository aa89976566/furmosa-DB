import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatNumber } from '@/lib/format';
import { Gift, Plus } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function RewardsPage() {
  const rewards = await prisma.reward.findMany({
    include: { _count: { select: { redemptions: true } } },
    orderBy: { pointsCost: 'asc' },
  });

  return (
    <>
      <PageHeader
        title="兌換商品 Rewards"
        description="會員可使用點數兌換的贈品（多由寄賣店家代為履約）"
        actions={
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" />
            新增贈品
          </Button>
        }
      />
      <div className="grid gap-4 p-6 md:grid-cols-2 lg:grid-cols-3">
        {rewards.map((r) => (
          <Card key={r.id}>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">{r.rewardId}</p>
                  <h3 className="text-lg font-semibold">{r.name}</h3>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-warning/10 text-warning">
                  <Gift className="h-5 w-5" />
                </div>
              </div>
              {r.description ? (
                <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>
              ) : null}
              <div className="grid grid-cols-3 gap-2 border-t pt-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">所需點數</p>
                  <p className="font-semibold">{formatNumber(r.pointsCost)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">公司成本</p>
                  <p className="font-semibold">{formatCurrency(Number(r.cashCost))}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">已兌換</p>
                  <p className="font-semibold">{r._count.redemptions}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Badge variant={r.status === 'active' ? 'success' : 'muted'}>
                  {r.status === 'active' ? '可兌換' : '停用'}
                </Badge>
                <span className="text-xs text-muted-foreground">庫存 {r.stock}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
