import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';
import { CustomerForm } from '@/components/customers/customer-form';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function NewCustomerPage() {
  return (
    <>
      <PageHeader
        title="新增客戶"
        description="建立後會出現在客戶列表，並可於新增訂單時選取"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/customers">
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回列表
            </Link>
          </Button>
        }
      />
      <div className="p-6">
        <SectionCard title="基本資料">
          <CustomerForm />
          <p className="mt-4 text-[11px] text-muted-foreground">
            客戶編號（CUST-XXXX）會在儲存時自動產生。
          </p>
        </SectionCard>
      </div>
    </>
  );
}
