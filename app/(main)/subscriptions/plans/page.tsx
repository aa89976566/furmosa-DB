import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { parsePlanContents, parsePlanBonus, parseShipDays } from '@/lib/subscription';
import { PlanEditCard } from '@/components/subscriptions/plan-edit-card';

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
        description="點各方案右上角「編輯」即可調整內容物、贈品、價格與出貨日"
      />
      <div className="space-y-6 p-6">
        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((p) => (
            <PlanEditCard
              key={p.id}
              plan={{
                id: p.id,
                planCode: p.planCode,
                name: p.name,
                tagline: p.tagline,
                monthlyPrice: Number(p.monthlyPrice),
                halfYearPrice: p.halfYearPrice == null ? null : Number(p.halfYearPrice),
                halfYearSavings: p.halfYearSavings == null ? null : Number(p.halfYearSavings),
                shipmentsPerMonth: p.shipmentsPerMonth,
                shipDays: parseShipDays(p.shipDays),
                contents: parsePlanContents(p.contents),
                bonus: parsePlanBonus(p.bonusItems),
                recommendedFor: p.recommendedFor,
                isActive: p.isActive,
                subscriberCount: p._count.subscriptions,
              }}
            />
          ))}
        </div>
      </div>
    </>
  );
}
