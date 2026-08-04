import Link from 'next/link';
import { Repeat } from 'lucide-react';
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
import { customerTypeLabel } from '@/lib/labels';
import { formatCurrency, formatDate } from '@/lib/format';

export type CustomerListRow = {
  id: string;
  customerId: string;
  name: string;
  phone: string | null;
  type: string;
  lineUserId: string | null;
  lineDisplay: string | null;
  totalSpent: unknown;
  lastOrderAt: Date | null;
  hasActiveSubscription: boolean;
  _count: { orders: number; subscriptions: number };
  subscriptions: { id: string; plan: { name: string } }[];
};

function IdentityBadge({ customer }: { customer: CustomerListRow }) {
  if (customer.subscriptions[0]) {
    return (
      <Badge variant="info" className="gap-1">
        <Repeat className="h-3 w-3" />
        {customer.subscriptions[0].plan.name}
      </Badge>
    );
  }
  return <span className="text-xs text-muted-foreground">一般</span>;
}

function CustomerCard({ customer }: { customer: CustomerListRow }) {
  return (
    <article className="space-y-3 border-b border-border/70 px-4 py-4 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-medium text-ink">{customer.name}</h3>
          <p className="font-mono text-xs text-muted-foreground">{customer.customerId}</p>
          {customer.lineUserId ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              LINE: {customer.lineDisplay ?? customer.lineUserId}
            </p>
          ) : null}
        </div>
        <p className="shrink-0 text-right">
          <span className="block text-[11px] text-muted-foreground">累計</span>
          <span className="text-sm font-semibold tabular-nums text-ink">
            {formatCurrency(Number(customer.totalSpent))}
          </span>
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-[11px] text-muted-foreground">類型</dt>
          <dd className="mt-1">
            <Badge variant={customer.type === 'business' ? 'info' : 'secondary'}>
              {customerTypeLabel[customer.type] ?? customer.type}
            </Badge>
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted-foreground">身份</dt>
          <dd className="mt-1">
            <IdentityBadge customer={customer} />
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted-foreground">電話</dt>
          <dd className="break-all text-foreground">{customer.phone ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted-foreground">訂單／最近</dt>
          <dd className="tabular-nums text-foreground">
            {customer._count.orders} 筆
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {customer.lastOrderAt ? formatDate(customer.lastOrderAt) : '尚無'}
            </span>
          </dd>
        </div>
      </dl>

      <div className="flex justify-end border-t border-border/50 pt-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/customers/${customer.id}`}>查看</Link>
        </Button>
      </div>
    </article>
  );
}

export function CustomersList({
  customers,
  emptyLabel,
}: {
  customers: CustomerListRow[];
  emptyLabel: string;
}) {
  if (customers.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>
    );
  }

  return (
    <>
      <div className="lg:hidden">
        {customers.map((c) => (
          <CustomerCard key={c.id} customer={c} />
        ))}
      </div>

      <div className="hidden lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">編號</TableHead>
              <TableHead className="min-w-[10rem]">姓名 / LINE</TableHead>
              <TableHead className="whitespace-nowrap">類型</TableHead>
              <TableHead className="min-w-[7rem]">身份</TableHead>
              <TableHead className="whitespace-nowrap">電話</TableHead>
              <TableHead className="whitespace-nowrap text-right">訂單</TableHead>
              <TableHead className="whitespace-nowrap text-right">累計消費</TableHead>
              <TableHead className="whitespace-nowrap">最近下單</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((c) => (
              <TableRow key={c.id} className="align-top">
                <TableCell className="whitespace-nowrap font-mono text-xs">
                  {c.customerId}
                </TableCell>
                <TableCell className="max-w-[14rem]">
                  <div className="font-medium">{c.name}</div>
                  {c.lineUserId ? (
                    <div className="break-all text-xs text-muted-foreground">
                      LINE: {c.lineDisplay ?? c.lineUserId}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell>
                  <Badge variant={c.type === 'business' ? 'info' : 'secondary'}>
                    {customerTypeLabel[c.type] ?? c.type}
                  </Badge>
                </TableCell>
                <TableCell>
                  <IdentityBadge customer={c} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {c.phone ?? '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums">{c._count.orders}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(Number(c.totalSpent))}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {c.lastOrderAt ? formatDate(c.lastOrderAt) : '-'}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/customers/${c.id}`}>查看</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
