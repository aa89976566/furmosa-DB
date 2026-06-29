'use client';

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
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
import type { MerchantProductTierOption } from '@/lib/merchant-product-tier';
import { ScanLine, ShoppingBag } from 'lucide-react';

type MerchantOption = { id: string; name: string; merchantId: string };

type UnpostedRestock = {
  id: string;
  shipmentNumber: string;
  status: string;
};

type ProductOption = {
  id: string;
  name: string;
  sku: string;
  isConsigned: boolean;
  currentStock: number;
  suggestedPrice: number | null;
  commissionMode: string | null;
  commissionValue: number | null;
  weightLabel?: string | null;
  priceTiers?: MerchantProductTierOption[];
};

type RowPanel = { rowKey: string; mode: 'sale' | 'count' };

export function MerchantAdjustWorkspace({
  merchants,
  selectedMerchantId,
  selectedMerchantLabel,
  stockRows,
  unpostedRestocks = [],
  products,
  countReturnTo,
}: {
  merchants: MerchantOption[];
  selectedMerchantId: string;
  selectedMerchantLabel?: string;
  stockRows: MerchantStockSnapshotRow[];
  unpostedRestocks?: UnpostedRestock[];
  products: ProductOption[];
  /** 盤點完成後導回此路徑（清點 hub 用） */
  countReturnTo?: string;
}) {
  const [panel, setPanel] = useState<RowPanel | null>(null);
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const totalQty = stockRows.reduce((sum, r) => sum + r.quantity, 0);

  const togglePanel = (rowKey: string, mode: 'sale' | 'count') => {
    setPanel((prev) =>
      prev?.rowKey === rowKey && prev.mode === mode ? null : { rowKey, mode },
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
        <div className="space-y-3 rounded-lg border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
          <p>此店尚無進貨庫存。請先新增進貨，並在出貨隊列標記「已寄出」後才會出現在此。</p>
          {unpostedRestocks.length > 0 ? (
            <div className="rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-left text-xs text-foreground">
              <p className="font-medium text-warning">有 {unpostedRestocks.length} 筆進貨出貨尚未入庫</p>
              <ul className="mt-1 space-y-1">
                {unpostedRestocks.map((s) => (
                  <li key={s.id}>
                    <Link href={`/shipments?s=${s.id}`} className="text-info hover:underline">
                      {s.shipmentNumber}
                    </Link>
                    <span className="text-muted-foreground"> · {s.status === 'shipped' ? '已寄出' : '已送達'}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p>
            <Link href={`/merchants/${selectedMerchantId}/restock`} className="text-info hover:underline">
              前往進貨入庫
            </Link>
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-navy">目前庫存（進貨後）</p>
            <p className="text-xs text-muted-foreground">
              共 {stockRows.length} 列 · 合計 {totalQty} 件
            </p>
          </div>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>商品</TableHead>
                  <TableHead>規格</TableHead>
                  <TableHead className="text-right">系統庫存</TableHead>
                  <TableHead>最近進貨</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockRows.map((row) => {
                  const product = productById.get(row.productId);
                  const activePanel =
                    panel?.rowKey === row.rowKey ? panel.mode : null;
                  const canSell = row.quantity > 0 && !!product;
                  return (
                    <Fragment key={row.rowKey}>
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
                        <TableCell>
                          {row.tierLabel ? (
                            <Badge variant="outline" className="text-xs font-semibold">
                              {row.tierLabel}
                            </Badge>
                          ) : product?.weightLabel ? (
                            <span className="text-sm text-navy/80">{product.weightLabel}</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
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
                              onClick={() => togglePanel(row.rowKey, 'sale')}
                            >
                              <ShoppingBag className="mr-1 h-3.5 w-3.5" />
                              賣出
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={activePanel === 'count' ? 'secondary' : 'outline'}
                              disabled={!product}
                              onClick={() => togglePanel(row.rowKey, 'count')}
                            >
                              <ScanLine className="mr-1 h-3.5 w-3.5" />
                              盤點
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {activePanel === 'sale' && product ? (
                        <TableRow>
                          <TableCell colSpan={5} className="bg-primary/5 pt-0">
                            <MerchantStockInlineSale
                              merchantId={selectedMerchantId}
                              product={{ ...product, currentStock: row.quantity }}
                              initialTierId={row.tierId}
                              tierLabel={row.tierLabel}
                              onCancel={() => setPanel(null)}
                            />
                          </TableCell>
                        </TableRow>
                      ) : null}
                      {activePanel === 'count' && product ? (
                        <TableRow>
                          <TableCell colSpan={5} className="bg-primary/5 pt-0">
                            <MerchantStockInlineCount
                              merchantId={selectedMerchantId}
                              product={{ ...product, currentStock: row.quantity }}
                              initialTierId={row.tierId}
                              tierLabel={row.tierLabel}
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
            多規格商品會拆成各克數一列。點「賣出」或「盤點」只影響該規格的庫存。
          </p>
        </div>
      )}
    </div>
  );
}
