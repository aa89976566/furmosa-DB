import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { VendorForm } from '../[id]/vendor-form';
import { createVendor } from '../actions';

export const dynamic = 'force-dynamic';

export default function NewVendorPage() {
  return (
    <>
      <PageHeader
        title="新增廠商"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/vendors">
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回列表
            </Link>
          </Button>
        }
      />
      <div className="p-6">
        <SectionCard title="基本資料" className="max-w-2xl">
          <VendorForm
            vendor={{
              name: '',
              contactName: null,
              phone: null,
              email: null,
              address: null,
              paymentTerms: null,
              notes: null,
              status: 'active',
            }}
            saveAction={createVendor}
            submitLabel="建立廠商"
          />
          <p className="mt-4 text-[11px] text-muted-foreground">
            廠商編號（VEND-XXXX）會在儲存時自動產生。
          </p>
        </SectionCard>
      </div>
    </>
  );
}
