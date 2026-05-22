import Link from 'next/link';
import { loadOrderFormOptions } from '@/lib/order-form-options';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { OrderForm } from './order-form';

export const dynamic = 'force-dynamic';

export default async function NewOrderPage() {
  const [merchants, customers, products] = await loadOrderFormOptions();

  return (
    <>
      <PageHeader
        title="新增訂單"
        description="支援寄賣店家進貨／代收 與 客戶訂單（社群、LINE、寄賣）"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/orders">
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回列表
            </Link>
          </Button>
        }
      />
      <div className="p-6">
        <SectionCard title="訂單資訊" className="max-w-5xl">
          <OrderForm merchants={merchants} customers={customers} products={products} />
          <p className="mt-4 text-[11px] text-muted-foreground">
            訂單編號（ORD-YYYYMM-XXX）會在儲存時自動產生。
          </p>
        </SectionCard>
      </div>
    </>
  );
}
