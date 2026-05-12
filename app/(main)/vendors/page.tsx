import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/shared/empty-state';
import { Building2, Plus } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function VendorsPage() {
  const vendors = await prisma.vendor.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { vendorId: 'asc' },
  });

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
        <Card>
          {vendors.length === 0 ? (
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>廠商編號</TableHead>
                  <TableHead>名稱</TableHead>
                  <TableHead>聯絡人</TableHead>
                  <TableHead>電話</TableHead>
                  <TableHead>付款條件</TableHead>
                  <TableHead className="text-right">商品數</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendors.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono text-xs">{v.vendorId}</TableCell>
                    <TableCell className="font-medium">{v.name}</TableCell>
                    <TableCell>{v.contactName ?? '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{v.phone ?? '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {v.paymentTerms ?? '-'}
                    </TableCell>
                    <TableCell className="text-right">{v._count.products}</TableCell>
                    <TableCell>
                      <Badge variant={v.status === 'active' ? 'success' : 'muted'}>
                        {v.status === 'active' ? '啟用' : '停用'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/vendors/${v.id}`}>查看</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
