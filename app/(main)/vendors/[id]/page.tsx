import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { productCategoryLabel } from '@/lib/labels';
import { ArrowLeft } from 'lucide-react';
import { VendorForm } from './vendor-form';
import { updateVendor, deleteVendor } from '../actions';

export const dynamic = 'force-dynamic';

export default async function VendorDetailPage({ params }: { params: { id: string } }) {
  const vendor = await prisma.vendor.findUnique({
    where: { id: params.id },
    include: {
      products: { orderBy: { productId: 'asc' } },
    },
  });
  if (!vendor) notFound();

  return (
    <>
      <PageHeader
        title={vendor.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{vendor.vendorId}</span>
            <span>·</span>
            <span>{vendor.products.length} 個商品</span>
            <Badge variant={vendor.status === 'active' ? 'success' : 'muted'}>
              {vendor.status === 'active' ? '啟用' : '停用'}
            </Badge>
          </span>
        }
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/vendors">
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回列表
            </Link>
          </Button>
        }
      />
      <div className="grid gap-6 p-6 lg:grid-cols-3">
        <SectionCard title="基本資料" className="lg:col-span-1">
          <VendorForm
            vendor={{
              id: vendor.id,
              vendorId: vendor.vendorId,
              name: vendor.name,
              contactName: vendor.contactName,
              phone: vendor.phone,
              email: vendor.email,
              address: vendor.address,
              paymentTerms: vendor.paymentTerms,
              notes: vendor.notes,
              status: vendor.status,
            }}
            saveAction={updateVendor}
            deleteAction={deleteVendor}
          />
          <p className="mt-4 text-[11px] text-muted-foreground">
            建立於 {formatDateTime(vendor.createdAt)}
          </p>
        </SectionCard>

        <SectionCard title="廠商商品" className="lg:col-span-2">
          {vendor.products.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">尚未綁定任何商品</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>商品編號</TableHead>
                  <TableHead>名稱</TableHead>
                  <TableHead>分類</TableHead>
                  <TableHead className="text-right">售價</TableHead>
                  <TableHead className="text-right">成本</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendor.products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.productId}</TableCell>
                    <TableCell>
                      <Link
                        href={`/products/${p.id}`}
                        className="font-medium hover:underline"
                      >
                        {p.name}
                      </Link>
                    </TableCell>
                    <TableCell>{productCategoryLabel[p.category]}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(Number(p.price))}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(Number(p.cost))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>
      </div>
    </>
  );
}
