import Link from 'next/link';
import { loadOrderFormOptions } from '@/lib/order-form-options';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { OrderForm } from './order-form';

export const dynamic = 'force-dynamic';

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams?: { merchantId?: string };
}) {
  const [merchants, customers, products] = await loadOrderFormOptions();
  const initialMerchantId = merchants.some((merchant) => merchant.id === searchParams?.merchantId)
    ? searchParams?.merchantId
    : undefined;

  return (
    <>
      <PageHeader
        title="建立訂單"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/orders">
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回列表
            </Link>
          </Button>
        }
      />
      <div className="min-h-[calc(100vh-8rem)] bg-[#f4f4f1] p-4 sm:p-6 dark:bg-neutral-950">
        <SectionCard title="訂單" className="mx-auto max-w-4xl border-neutral-200 shadow-none dark:border-neutral-800">
          <OrderForm
            merchants={merchants}
            customers={customers}
            products={products}
            initialMerchantId={initialMerchantId}
          />
        </SectionCard>
      </div>
    </>
  );
}
