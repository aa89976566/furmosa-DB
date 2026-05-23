import Link from 'next/link';
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

export function MerchantStockSnapshotTable({
  rows,
  merchantId,
  selectedProductId,
  basePath = '/merchants/adjust',
  mode,
  merchantIdInQuery = true,
}: {
  rows: MerchantStockSnapshotRow[];
  merchantId: string;
  selectedProductId?: string;
  basePath?: string;
  mode?: string;
  /** 單店清點頁網址已含店家，不需再帶 merchantId */
  merchantIdInQuery?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
        此店尚無進貨庫存紀錄。請先至{' '}
        <Link href={`/merchants/restock?merchantId=${merchantId}`} className="font-medium text-primary hover:underline">
          新增進貨
        </Link>{' '}
        建立庫存後再清點。
      </div>
    );
  }

  const totalQty = rows.reduce((sum, r) => sum + r.quantity, 0);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-navy">目前庫存（進貨後）</p>
        <p className="text-xs text-muted-foreground">
          共 {rows.length} 品項 · 合計 {totalQty} 件
        </p>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>商品</TableHead>
              <TableHead className="text-right">系統庫存</TableHead>
              <TableHead>最近進貨</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const params = new URLSearchParams({ productId: row.productId });
              if (merchantIdInQuery) params.set('merchantId', merchantId);
              params.set('mode', 'sold');
              const href = `${basePath}?${params.toString()}`;
              const active = selectedProductId === row.productId;
              const canSell = row.quantity > 0;
              return (
                <TableRow
                  key={row.productId}
                  className={active ? 'bg-primary/5' : undefined}
                >
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
                    {canSell ? (
                      <Link
                        href={href}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        {active ? '賣出中' : '登記賣出'}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">無庫存</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">點「登記賣出」帶入下方表單，輸入件數後即時結算並扣庫存。</p>
    </div>
  );
}
