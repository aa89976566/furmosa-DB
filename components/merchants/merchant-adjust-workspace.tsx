'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { MerchantSelect } from '@/components/merchants/merchant-select';
import { MerchantStockInlineMovement } from '@/components/merchants/merchant-stock-inline-movement';
import { Badge } from '@/components/ui/badge';
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

export function MerchantAdjustWorkspace({
  merchants,
  selectedMerchantId,
  selectedMerchantLabel,
  stockRows,
  unpostedRestocks = [],
  products,
}: {
  merchants: MerchantOption[];
  selectedMerchantId: string;
  selectedMerchantLabel?: string;
  stockRows: MerchantStockSnapshotRow[];
  unpostedRestocks?: UnpostedRestock[];
  products: ProductOption[];
  /** @deprecated 就地清點不再需導回路徑 */
  countReturnTo?: string;
}) {
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const totalQty = stockRows.reduce((sum, r) => sum + r.quantity, 0);

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
              <p className="font-medium text-warning">
                有 {unpostedRestocks.length} 筆進貨出貨尚未入庫
              </p>
              <ul className="mt-1 space-y-1">
                {unpostedRestocks.map((s) => (
                  <li key={s.id}>
                    <Link href={`/shipments?s=${s.id}`} className="text-info hover:underline">
                      {s.shipmentNumber}
                    </Link>
                    <span className="text-muted-foreground">
                      {' '}
                      · {s.status === 'shipped' ? '已寄出' : '已送達'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p>
            <Link
              href={`/merchants/${selectedMerchantId}/restock`}
              className="text-info hover:underline"
            >
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

          {/* 手機：卡片列表 */}
          <div className="space-y-3 md:hidden">
            {stockRows.map((row) => {
              const product = productById.get(row.productId);
              return (
                <div key={row.rowKey} className="rounded-lg border bg-background p-3">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{row.name}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs text-muted-foreground">{row.sku}</span>
                        {row.tierLabel ? (
                          <Badge variant="outline" className="text-[10px] font-semibold">
                            {row.tierLabel}
                          </Badge>
                        ) : null}
                        {row.isConsigned ? (
                          <Badge variant="secondary" className="text-[10px]">
                            寄賣
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        最近進貨 {formatDate(row.lastRestockAt)}
                      </p>
                    </div>
                  </div>
                  <MerchantStockInlineMovement
                    merchantId={selectedMerchantId}
                    productId={row.productId}
                    productName={row.name}
                    tierId={row.tierId}
                    tierLabel={row.tierLabel}
                    quantity={row.quantity}
                    unitPrice={product?.suggestedPrice ?? null}
                    commissionPercent={
                      product?.commissionMode === 'percent' ? product.commissionValue : null
                    }
                    compact
                  />
                </div>
              );
            })}
          </div>

          {/* 桌面：表格 */}
          <div className="hidden overflow-hidden rounded-lg border md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>商品</TableHead>
                  <TableHead>規格</TableHead>
                  <TableHead>最近進貨</TableHead>
                  <TableHead className="text-right">清點</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockRows.map((row) => {
                  const product = productById.get(row.productId);
                  return (
                    <TableRow key={row.rowKey}>
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
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(row.lastRestockAt)}
                      </TableCell>
                      <TableCell className="text-right align-top">
                        <MerchantStockInlineMovement
                          merchantId={selectedMerchantId}
                          productId={row.productId}
                          productName={row.name}
                          tierId={row.tierId}
                          tierLabel={row.tierLabel}
                          quantity={row.quantity}
                          unitPrice={product?.suggestedPrice ?? null}
                          commissionPercent={
                            product?.commissionMode === 'percent'
                              ? product.commissionValue
                              : null
                          }
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">
            點庫存數字清點：變少預設記現場售出，變多預設記補登進貨；完成後 5
            秒內可撤銷。
          </p>
        </div>
      )}
    </div>
  );
}
