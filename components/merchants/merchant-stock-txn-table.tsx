import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatCurrency, formatDateTime } from '@/lib/format';

export type MerchantStockTxnRow = {
  id: string;
  txnNumber: string;
  type: string;
  quantity: number;
  balanceAfter: number;
  companyRevenue: number | null;
  settlementId: string | null;
  note: string | null;
  createdAt: Date;
  merchant: { id: string; name: string; merchantId: string };
  product: { id: string; name: string; sku: string };
  order: { id: string; orderNumber: string } | null;
  settlement: { id: string; settlementId: string } | null;
};

export function MerchantStockTxnTable({
  txns,
  showMerchant = false,
}: {
  txns: MerchantStockTxnRow[];
  showMerchant?: boolean;
}) {
  if (txns.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">尚無紀錄</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>時間</TableHead>
          <TableHead>單號</TableHead>
          {showMerchant && <TableHead>店家</TableHead>}
          <TableHead>類型</TableHead>
          <TableHead>商品</TableHead>
          <TableHead className="text-right">數量</TableHead>
          <TableHead className="text-right">異動後庫存</TableHead>
          <TableHead className="text-right">公司實收</TableHead>
          <TableHead>結算</TableHead>
          <TableHead>備註 / 訂單</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {txns.map((t) => (
          <TableRow key={t.id}>
            <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
              {formatDateTime(t.createdAt)}
            </TableCell>
            <TableCell>
              <Link
                href={
                  t.order
                    ? `/orders/${t.order.id}`
                    : `/merchants/stock-txn/${t.id}`
                }
                className="font-mono text-xs text-primary hover:underline"
                title={t.order ? `訂單 ${t.order.orderNumber}` : `銷售流水 ${t.txnNumber}`}
              >
                {t.txnNumber}
              </Link>
            </TableCell>
            {showMerchant && (
              <TableCell>
                <Link href={`/merchants/${t.merchant.id}`} className="font-medium hover:underline">
                  {t.merchant.name}
                </Link>
                <div className="font-mono text-xs text-muted-foreground">{t.merchant.merchantId}</div>
              </TableCell>
            )}
            <TableCell>
              <StatusBadge kind="merchantStock" value={t.type} />
            </TableCell>
            <TableCell>
              <Link href={`/products/${t.product.id}`} className="hover:underline">
                {t.product.name}
              </Link>
              <div className="font-mono text-xs text-muted-foreground">{t.product.sku}</div>
            </TableCell>
            <TableCell
              className={
                t.quantity > 0
                  ? 'text-right font-mono font-semibold text-success'
                  : t.quantity < 0
                    ? 'text-right font-mono font-semibold text-destructive'
                    : 'text-right font-mono'
              }
            >
              {t.quantity > 0 ? '+' : ''}
              {t.quantity}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">{t.balanceAfter}</TableCell>
            <TableCell className="text-right tabular-nums">
              {t.companyRevenue != null ? formatCurrency(Number(t.companyRevenue)) : '—'}
            </TableCell>
            <TableCell className="text-xs">
              {t.settlement ? (
                <Link
                  href={`/merchants/settlements/${t.settlement.id}`}
                  className="font-mono hover:underline"
                >
                  {t.settlement.settlementId}
                </Link>
              ) : (
                <span className="text-muted-foreground">未結清</span>
              )}
            </TableCell>
            <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
              {t.order ? (
                <Link href={`/orders/${t.order.id}`} className="hover:underline">
                  {t.order.orderNumber}
                </Link>
              ) : (
                (t.note ?? '—')
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
