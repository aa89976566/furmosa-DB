import Link from 'next/link';
import { Suspense } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/empty-state';
import { VendorListWorkspace } from '@/components/vendors/vendor-list-workspace';
import { getVendorsList } from '@/lib/hot-path-reads';
import { Building2, Plus } from 'lucide-react';

export const revalidate = 60;

export default async function VendorsPage({
  searchParams,
}: {
  searchParams?: { v?: string };
}) {
  const rows = await getVendorsList();

  return (
    <>
      <PageHeader
        title="廠商 Vendors"
        description="管理供應商資料：聯絡資訊、付款條件、出貨產品"
        actions={
          <Button size="sm" asChild>
            <Link href="/vendors/new">
              <Plus className="mr-1 h-4 w-4" />
              新增廠商
            </Link>
          </Button>
        }
      />
      <div className="p-6">
        <Card className="p-0">
          {rows.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<Building2 className="h-5 w-5" />}
                title="尚無廠商"
                action={
                  <Button size="sm" asChild>
                    <Link href="/vendors/new">
                      <Plus className="mr-1 h-4 w-4" />
                      新增第一筆廠商
                    </Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="p-4">
              <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">載入廠商列表…</div>}>
                <VendorListWorkspace vendors={rows} initialVendorId={searchParams?.v} />
              </Suspense>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
