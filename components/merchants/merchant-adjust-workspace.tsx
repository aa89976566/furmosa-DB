'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { MerchantSelect } from '@/components/merchants/merchant-select';
import { MerchantStockInlineMovement } from '@/components/merchants/merchant-stock-inline-movement';
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
import { removeMerchantStockRow } from '@/app/(main)/merchants/[id]/actions';
import { isNextRedirect } from '@/lib/is-next-redirect';

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

function RemoveZeroStockButton({
  merchantId,
  productId,
  productName,
  tierId,
  tierLabel,
}: {
  merchantId: string;
  productId: string;
  productName: string;
  tierId: string;
  tierLabel: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const label = tierLabel ? `${productName}（${tierLabel}）` : productName;

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={pending}
      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
      onClick={() => {
        if (
          !confirm(
            `確定將「${label}」移出清點列表？\n銷售／進貨紀錄會保留在「動作流水」與「訂單」歷史中。`,
          )
        ) {
          return;
        }
        const fd = new FormData();
        fd.set('merchantId', merchantId);
        fd.set('productId', productId);
        fd.set('tierId', tierId);
        fd.set('softRefresh', '1');
        startTransition(async () => {
          try {
            await removeMerchantStockRow(fd);
            router.refresh();
          } catch (e) {
            if (isNextRedirect(e)) throw e;
            alert(e instanceof Error ? e.message : '移出失敗');
          }
        });
      }}
    >
      <Trash2 className="mr-1 h-3.5 w-3.5" />
      {pending ? '處理中…' : '移出列表'}
    </Button>
  );
}

function ActiveStockRow({
  row,
  product,
  merchantId,
  compact,
}: {
  row: MerchantStockSnapshotRow;
  product?: ProductOption;
  merchantId: string;
  compact?: boolean;
}) {
  return (
    <MerchantStockInlineMovement
      merchantId={merchantId}
      productId={row.productId}
      productName={row.name}
      tierId={row.tierId}
      tierLabel={row.tierLabel}
      quantity={row.quantity}
      unitPrice={product?.suggestedPrice ?? null}
      commissionPercent={
        product?.commissionMode === 'percent' ? product.commissionValue : null
      }
      compact={compact}
    />
  );
}

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
  const [showHistory, setShowHistory] = useState(false);

  const activeRows = useMemo(
    () => stockRows.filter((r) => r.quantity > 0),
    [stockRows],
  );
  const historyRows = useMemo(
    () => stockRows.filter((r) => r.quantity <= 0),
    [stockRows],
  );
  const totalQty = activeRows.reduce((sum, r) => sum + r.quantity, 0);

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
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-navy">目前庫存</p>
              <p className="text-xs text-muted-foreground">
                共 {activeRows.length} 列 · 合計 {totalQty} 件
              </p>
            </div>

            {activeRows.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                目前沒有庫存。已售完的品項在下方「歷史／已無貨」。
              </div>
            ) : (
              <>
                {/* 手機：卡片列表 */}
                <div className="space-y-3 md:hidden">
                  {activeRows.map((row) => {
                    const product = productById.get(row.productId);
                    return (
                      <div key={row.rowKey} className="rounded-lg border bg-background p-3">
                        <div className="mb-2">
                          <div className="font-medium">{row.name}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-xs text-muted-foreground">
                              {row.sku}
                            </span>
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
                        <ActiveStockRow
                          row={row}
                          product={product}
                          merchantId={selectedMerchantId}
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
                      {activeRows.map((row) => {
                        const product = productById.get(row.productId);
                        return (
                          <TableRow key={row.rowKey}>
                            <TableCell>
                              <div className="font-medium">{row.name}</div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-mono text-xs text-muted-foreground">
                                  {row.sku}
                                </span>
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
                              <ActiveStockRow
                                row={row}
                                product={product}
                                merchantId={selectedMerchantId}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
            <p className="text-xs text-muted-foreground">
              點庫存數字清點：變少預設記現場售出，變多預設記補登進貨；完成後 5
              秒內可撤銷。售完的品項會移到下方歷史區。
            </p>
          </div>

          {historyRows.length > 0 ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                className="flex w-full items-center justify-between rounded-lg border bg-muted/20 px-3 py-2 text-left text-sm hover:bg-muted/30"
              >
                <span className="flex items-center gap-2 font-medium">
                  {showHistory ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  歷史／已無貨
                  <Badge variant="secondary" className="font-mono text-xs">
                    {historyRows.length}
                  </Badge>
                </span>
                <span className="text-xs text-muted-foreground">
                  可移出列表；紀錄仍在動作流水／訂單
                </span>
              </button>

              {showHistory ? (
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>商品</TableHead>
                        <TableHead>規格</TableHead>
                        <TableHead>最近進貨</TableHead>
                        <TableHead className="text-right">庫存</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyRows.map((row) => (
                        <TableRow key={row.rowKey} className="text-muted-foreground">
                          <TableCell>
                            <div className="font-medium text-foreground">{row.name}</div>
                            <div className="font-mono text-xs">{row.sku}</div>
                          </TableCell>
                          <TableCell>
                            {row.tierLabel ? (
                              <Badge variant="outline" className="text-xs">
                                {row.tierLabel}
                              </Badge>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(row.lastRestockAt)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-destructive">
                            0
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap items-center justify-end gap-1">
                              <Button size="sm" variant="outline" asChild>
                                <Link href={`/merchants/${selectedMerchantId}/ledger`}>
                                  看流水
                                </Link>
                              </Button>
                              <RemoveZeroStockButton
                                merchantId={selectedMerchantId}
                                productId={row.productId}
                                productName={row.name}
                                tierId={row.tierId}
                                tierLabel={row.tierLabel}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                    「移出列表」只清除此店的庫存列／分潤規則；過去的銷售與進貨仍可在{' '}
                    <Link
                      href={`/merchants/${selectedMerchantId}/ledger`}
                      className="text-primary hover:underline"
                    >
                      動作流水
                    </Link>
                    、
                    <Link
                      href={`/merchants/${selectedMerchantId}/sales`}
                      className="text-primary hover:underline"
                    >
                      訂單
                    </Link>{' '}
                    查閱。
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
