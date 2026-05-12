import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { merchantTypeLabel } from '@/lib/labels';
import { formatPercent } from '@/lib/format';
import { Plus } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function MerchantsPage() {
  const merchants = await prisma.merchant.findMany({
    include: {
      _count: { select: { orders: true, settlements: true } },
    },
    orderBy: { merchantId: 'asc' },
  });

  return (
    <>
      <PageHeader
        title="寄賣店家 Merchants"
        description="寄賣 / 快閃 / 旗艦 / 合作夥伴 通路管理"
        actions={
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" />
            新增店家
          </Button>
        }
      />
      <div className="p-6">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>編號</TableHead>
                <TableHead>店家名稱</TableHead>
                <TableHead>類型</TableHead>
                <TableHead>城市</TableHead>
                <TableHead>聯絡電話</TableHead>
                <TableHead className="text-right">分潤</TableHead>
                <TableHead className="text-right">訂單</TableHead>
                <TableHead className="text-right">結算</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {merchants.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-xs">{m.merchantId}</TableCell>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{merchantTypeLabel[m.type]}</Badge>
                  </TableCell>
                  <TableCell>{m.city ?? '-'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.phone ?? '-'}</TableCell>
                  <TableCell className="text-right text-sm">
                    {formatPercent(Number(m.commissionRate), 0)}
                  </TableCell>
                  <TableCell className="text-right">{m._count.orders}</TableCell>
                  <TableCell className="text-right">{m._count.settlements}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/merchants/${m.id}`}>查看</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  );
}
