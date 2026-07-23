import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { SubscriptionCreateForm } from '@/components/subscriptions/subscription-create-form';
import { MerchantWorkspace } from '@/components/merchants/merchant-ui';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function NewSubscriptionPage() {
  const [customers, plans] = await Promise.all([
    prisma.customer.findMany({
      orderBy: [{ hasActiveSubscription: 'desc' }, { lastOrderAt: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        customerId: true,
        phone: true,
        address: true,
        preferredShippingMethod: true,
        preferredCvsBrand: true,
        preferredCvsStoreName: true,
      },
      take: 40,
    }),
    prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        planCode: true,
        name: true,
        monthlyPrice: true,
        halfYearPrice: true,
        shipmentsPerMonth: true,
      },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="新增訂閱"
        description="建立客戶訂閱合約，並自動排定近兩個月的出貨日程"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/subscriptions">
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回列表
            </Link>
          </Button>
        }
      />
      <MerchantWorkspace narrow>
        {plans.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            尚無啟用中的訂閱方案，請先到
            <Link href="/subscriptions/plans" className="text-primary hover:underline">
              訂閱方案
            </Link>
            設定。
          </p>
        ) : customers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            尚無客戶資料，請先到
            <Link href="/customers" className="text-primary hover:underline">
              客戶
            </Link>
            建立。
          </p>
        ) : (
          <SubscriptionCreateForm customers={customers} plans={plans} />
        )}
      </MerchantWorkspace>
    </>
  );
}
