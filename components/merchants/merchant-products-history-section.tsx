'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, Package, Pencil } from 'lucide-react';
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
import { formatCurrency, formatDate } from '@/lib/format';
import { commissionBadgeLabel } from '@/lib/merchant-stock-movement';
import { MerchantProductDeleteButton } from '@/components/merchants/merchant-product-delete-button';
import type { MerchantProductListRow } from '@/lib/merchants/load-merchant-products';

export function MerchantProductsHistorySection({
  merchantId,
  rows,
}: {
  merchantId: string;
  rows: MerchantProductListRow[];
}) {
  const [open, setOpen] = useState(false);

  if (rows.length === 0) return null;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg border bg-muted/20 px-3 py-2 text-left text-sm hover:bg-muted/30"
      >
        <span className="flex items-center gap-2 font-medium">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          歷史／已無貨
          <Badge variant="secondary" className="font-mono text-xs">
            {rows.length}
          </Badge>
        </span>
        <span className="text-xs text-muted-foreground">可移出列表；紀錄仍在動作流水／訂單</span>
      </button>

      {open ? (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>商品</TableHead>
                <TableHead className="text-right">庫存</TableHead>
                <TableHead className="text-center">分潤</TableHead>
                <TableHead className="text-right">最近進貨</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const badge = commissionBadgeLabel(r.commissionMode, r.commissionValue);
                return (
                  <TableRow key={r.productInternalId} className="text-muted-foreground">
                    <TableCell>
                      <Link
                        href={`/products/${r.productInternalId}`}
                        className="flex items-center gap-2 font-medium text-foreground hover:underline"
                      >
                        <Package className="h-4 w-4" />
                        {r.productName}
                      </Link>
                      <div className="ml-6 font-mono text-xs">{r.sku}</div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-destructive">0</TableCell>
                    <TableCell className="text-center">
                      {badge ? <Badge variant="secondary">{badge}</Badge> : '—'}
                      {r.suggestedPrice != null ? (
                        <div className="text-[10px]">
                          售價 {formatCurrency(r.suggestedPrice)}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {r.lastRestockAt ? formatDate(r.lastRestockAt) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/merchants/${merchantId}/ledger`}>看流水</Link>
                        </Button>
                        <Button asChild variant="ghost" size="sm">
                          <Link
                            href={`/merchants/${merchantId}/rule?productId=${r.productInternalId}`}
                          >
                            <Pencil className="mr-1 h-3 w-3" />
                            分潤
                          </Link>
                        </Button>
                        <MerchantProductDeleteButton
                          merchantId={merchantId}
                          productId={r.productInternalId}
                          productName={r.productName}
                          quantity={0}
                          redirectTo={`/merchants/${merchantId}/products`}
                          label="移出列表"
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <p className="border-t px-3 py-2 text-xs text-muted-foreground">
            「移出列表」清除此店寄賣庫存與分潤規則；過去銷售仍可在{' '}
            <Link href={`/merchants/${merchantId}/ledger`} className="text-primary hover:underline">
              動作流水
            </Link>
            、
            <Link href={`/merchants/${merchantId}/sales`} className="text-primary hover:underline">
              訂單
            </Link>{' '}
            查閱。
          </p>
        </div>
      ) : null}
    </div>
  );
}
