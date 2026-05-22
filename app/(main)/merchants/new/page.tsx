import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { MerchantCreateForm } from '@/components/merchants/merchant-create-form';
import { MerchantWorkspace } from '@/components/merchants/merchant-ui';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function NewMerchantPage() {
  return (
    <>
      <PageHeader
        title="新增店家"
        description="建立寄賣／快閃／旗艦等通路店家"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/merchants">
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回列表
            </Link>
          </Button>
        }
      />
      <MerchantWorkspace narrow>
        <MerchantCreateForm />
      </MerchantWorkspace>
    </>
  );
}
