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
        description="店家只需建立一次，之後下單、補貨與對帳都直接選用。"
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
