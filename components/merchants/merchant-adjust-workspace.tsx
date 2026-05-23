'use client';

import { Fragment, useMemo, useState } from 'react';
import { MerchantSelect } from '@/components/merchants/merchant-select';
import { MerchantStockInlineCount } from '@/components/merchants/merchant-stock-inline-count';
import { MerchantStockInlineSale } from '@/components/merchants/merchant-stock-inline-sale';
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
import { formatDate } from '@/lib/format';
import type { MerchantStockSnapshotRow } from '@/lib/merchant-operation-options';
import { ScanLine, ShoppingBag } from 'lucide-react';

type MerchantOption = { id: string; name: string; merchantId: string };

type ProductOption = {
  id: string;
  name: string;
  sku: string;
  isConsigned: boolean;
  currentStock: number;
  suggestedPrice: number | null;
  commissionMode: string | null;
  commissionValue: number | null;
};

type RowPanel = { productId: string; mode: 'sale' | 'count' };

export function MerchantAdjustWorkspace({
  merchants,
  selectedMerchantId,
  selectedMerchantLabel,
  stockRows,
  products,
  countReturnTo,
}: {
  merchants: MerchantOption[];
  selectedMerchantId: string;
  selectedMerchantLabel?: string;
  stockRows: MerchantStockSnapshotRow[];
  products: ProductOption[];
  /** 盤點完成後導回此路徑（清點 hub 用） */
  countReturnTo?: string;
}) {
  const [panel, setPanel] = useState<RowPanel | null>(null);
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const totalQty = stockRows.reduce((sum, r) => sum + r.quantity, 0);

  const togglePanel = (productId: string, mode: 'sale' | 'count') => {
    setPanel((prev) =>
      prev?.productId === productId && prev.mode === mode ? null : { productId, mode },
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="merchantId" className="text-sm font-medium">
          店家
        </label>
        <MerchantSelect merchants={merchants} value={selectedMerchantId} />
      </div>
      {selectedMerchantLabel && (
        <p className="text-xs text-muted-foreground">目前選擇：{selectedMerchantLabel}</p>
      )}

      {stockRows.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
          此店尚無進貨庫存。請先新增進貨後再登記賣出。
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-navy">目前庫存（進貨後）</p>
            <p className="text-xs text-muted-foreground">
              共 {stockRows.length} 品項 · 合計 {totalQty} 件
            </p>
          </div>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>商品</TableHead>
                  <TableHead className="text-right">系統庫存</TableHead>
                  <TableHead>最近進貨</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockRows.map((row) => {
                  const product = productById.get(row.productId);
                  const activePanel =
                    panel?.productId === row.productId ? panel.mode : null;
                  const canSell = row.quantity > 0 && !!product;
                  return (
                    <Fragment key={row.productId}>
                      <TableRow className={activePanel ? 'bg-primary/5' : undefined}>
                        <TableCell>
                          <div className="font-medium">{row.name}</div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-xs text-muted-foreground">{row.sku}</span>
                            {row.isConsigned ? (
                              <Badge variant="secondary" className="text-[10px]">
                                寄賣
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={
                              row.quantity > 0
                                ? 'font-mono text-base font-semibold tabular-nums'
                                : 'font-mono tabular-nums text-muted-foreground'
                            }
                          >
                            {row.quantity}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(row.lastRestockAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant={activePanel === 'sale' ? 'default' : 'outline'}
                              disabled={!canSell}
                              onClick={() => togglePanel(row.productId, 'sale')}
                            >
                              <ShoppingBag className="mr-1 h-3.5 w-3.5" />
                              賣出
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={activePanel === 'count' ? 'secondary' : 'outline'}
                              disabled={!product}
                              onClick={() => togglePanel(row.productId, 'count')}
                            >
                              <ScanLine className="mr-1 h-3.5 w-3.5" />
                              盤點
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {activePanel === 'sale' && product ? (
                        <TableRow>
                          <TableCell colSpan={4} className="bg-primary/5 pt-0">
                            <MerchantStockInlineSale
                              merchantId={selectedMerchantId}
                              product={product}
                              onCancel={() => setPanel(null)}
                            />
                          </TableCell>
                        </TableRow>
                      ) : null}
                      {activePanel === 'count' && product ? (
                        <TableRow>
                          <TableCell colSpan={4} className="bg-primary/5 pt-0">
                            <MerchantStockInlineCount
                              merchantId={selectedMerchantId}
                              product={product}
                              returnTo={countReturnTo}
                              onCancel={() => setPanel(null)}
                            />
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">
            點「賣出」登記銷售；點「盤點」填現場實際數量。兩者都在該列直接操作。
          </p>
        </div>
      )}
    </div>
  );
}
