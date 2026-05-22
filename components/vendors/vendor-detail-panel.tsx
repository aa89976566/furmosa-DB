'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchVendorPanel, type VendorPanelData } from '@/app/(main)/vendors/actions';
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
import { Building2, Loader2 } from 'lucide-react';

export function VendorDetailPanel({ vendorId }: { vendorId: string }) {
  const [data, setData] = useState<VendorPanelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchVendorPanel(vendorId)
      .then((panel) => {
        if (cancelled) return;
        if (!panel) {
          setError('找不到這家廠商');
          setData(null);
          return;
        }
        setData(panel);
      })
      .catch(() => {
        if (!cancelled) setError('載入失敗，請稍後再試');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 p-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        載入廠商資料…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 p-12 text-center text-sm text-muted-foreground">
        {error ?? '找不到這家廠商'}
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="font-mono text-sm text-muted-foreground">{data.vendorId}</div>
            <div className="text-lg font-semibold">{data.name}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant={data.status === 'active' ? 'success' : 'muted'}>
                {data.status === 'active' ? '啟用' : '停用'}
              </Badge>
              <span className="text-xs text-muted-foreground">
                建立於 {formatDateTime(data.createdAt)}
              </span>
            </div>
          </div>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href={`/vendors/${data.id}`}>開啟完整頁面</Link>
        </Button>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <section className="min-w-0 rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold">聯絡與付款</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <PanelRow label="聯絡人" value={data.contactName ?? '-'} />
            <PanelRow label="電話" value={data.phone ?? '-'} />
            <PanelRow label="Email" value={data.email ?? '-'} />
            <PanelRow label="地址" value={data.address ?? '-'} />
            <PanelRow label="付款條件" value={data.paymentTerms ?? '-'} />
          </dl>
        </section>

        <section className="min-w-0 rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold">備註</h3>
          <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">
            {data.notes?.trim() ? data.notes : '尚無備註'}
          </p>
        </section>
      </div>

      <section className="min-w-0 rounded-lg border bg-card p-4">
        <h3 className="text-sm font-semibold">
          廠商商品
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {data.products.length} 項
          </span>
        </h3>
        {data.products.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">尚未綁定任何商品</p>
        ) : (
          <Table className="mt-4">
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
              {data.products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-mono text-xs">{product.productId}</TableCell>
                  <TableCell>
                    <Link href={`/products/${product.id}`} className="font-medium hover:underline">
                      {product.name}
                    </Link>
                  </TableCell>
                  <TableCell>{productCategoryLabel[product.category]}</TableCell>
                  <TableCell className="text-right">{formatCurrency(product.price)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatCurrency(product.cost)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}

function PanelRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-4 border-b border-border/60 pb-2 last:border-0 last:pb-0">
      <dt className="w-16 shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 text-right text-sm font-medium break-words [overflow-wrap:anywhere]">
        {value}
      </dd>
    </div>
  );
}
