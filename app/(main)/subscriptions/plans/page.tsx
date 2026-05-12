import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/format';
import { parsePlanContents, parsePlanBonus, parseShipDays } from '@/lib/subscription';
import { Check, Gift, Truck, Users } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function SubscriptionPlansPage() {
  const plans = await prisma.subscriptionPlan.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { subscriptions: true } } },
  });

  return (
    <>
      <PageHeader
        title="訂閱方案 Subscription Plans"
        description="官網主推的 3 個訂閱方案 — 小食組 / 標準組 / 豪華組"
      />
      <div className="space-y-6 p-6">
        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((p) => {
            const contents = parsePlanContents(p.contents);
            const bonus = parsePlanBonus(p.bonusItems);
            const shipDays = parseShipDays(p.shipDays);
            const isHot = p.planCode === 'PLAN-STANDARD';
            return (
              <Card
                key={p.id}
                className={`relative overflow-hidden ${isHot ? 'border-amber-500/60 shadow-md' : ''}`}
              >
                {isHot && (
                  <div className="absolute right-0 top-0 rounded-bl-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-white">
                    嚐鮮首選
                  </div>
                )}
                <CardContent className="space-y-5 p-6">
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">{p.planCode}</p>
                    <h2 className="mt-1 text-2xl font-bold">{p.name}</h2>
                    {p.tagline && (
                      <p className="text-sm text-muted-foreground">{p.tagline}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <p className="text-3xl font-bold text-primary">
                      {formatCurrency(Number(p.monthlyPrice))}
                      <span className="ml-1 text-sm font-normal text-muted-foreground">/ 月</span>
                    </p>
                    {p.halfYearPrice && (
                      <p className="text-xs text-muted-foreground">
                        半年付清：{formatCurrency(Number(p.halfYearPrice))}
                        {p.halfYearSavings && (
                          <Badge variant="success" className="ml-2">
                            現省 {formatCurrency(Number(p.halfYearSavings))}
                          </Badge>
                        )}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <Truck className="h-4 w-4 text-info" />
                    <span>
                      每月 {p.shipmentsPerMonth} 次（
                      {shipDays.map((d) => `${d}日`).join(' / ')}）
                    </span>
                  </div>

                  <div className="space-y-2 border-t pt-4">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">內容物</p>
                    <ul className="space-y-1.5 text-sm">
                      {contents.map((c, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                          <span>
                            <span className="font-medium">{c.name}</span>
                            {c.weight && (
                              <span className="ml-1 text-xs text-muted-foreground">
                                ({c.weight})
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {bonus.length > 0 && (
                    <div className="space-y-2 border-t pt-4">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">
                        贈品
                      </p>
                      <ul className="space-y-1.5 text-sm">
                        {bonus.map((b, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <Gift className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                            <span>{b.name}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
                    <span>{p.recommendedFor}</span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {p._count.subscriptions} 位訂閱中
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
