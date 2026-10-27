'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Loader2, ReceiptText } from 'lucide-react';
import {
  createVendorSettlementAction,
  type VendorSettlementActionState,
} from '@/app/(main)/vendors/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatDate } from '@/lib/format';

const initialState: VendorSettlementActionState = { ok: false, message: '' };

type SettlementRow = {
  id: string;
  settlementNumber: string;
  periodStart: string;
  periodEnd: string;
  grossCollectedTwd: number;
  furmosaShareTwd: number;
  vendorPayableTwd: number;
  status: string;
  itemCount: number;
};

const statusLabel: Record<string, string> = {
  draft: '草稿',
  reviewing: '核對中',
  approved: '已確認',
  paid: '已付款',
  cancelled: '已取消',
};

export function VendorSettlementSection({
  vendorId,
  furmosaShareBps,
  currentMonth,
  settlements,
}: {
  vendorId: string;
  furmosaShareBps: number;
  currentMonth: string;
  settlements: SettlementRow[];
}) {
  const [state, action, pending] = useActionState(createVendorSettlementAction, initialState);
  const furmosaPercent = furmosaShareBps / 100;
  const vendorPercent = 100 - furmosaPercent;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="匠寵分潤" value={`${furmosaPercent}%`} />
        <Metric label="供應商應付比例" value={`${vendorPercent}%`} />
        <Metric label="計算基準" value="實收扣除退款" />
      </div>

      <form action={action} className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-end">
        <input type="hidden" name="vendorId" value={vendorId} />
        <label className="grid flex-1 gap-1.5 text-sm font-medium">
          對帳月份
          <Input name="month" type="month" defaultValue={currentMonth} required className="max-w-56" />
        </label>
        <Button type="submit" disabled={pending} className="sm:self-end">
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ReceiptText className="mr-2 h-4 w-4" />}
          建立對帳草稿
        </Button>
      </form>
      {state.message ? (
        <div className={`rounded-lg border px-3 py-2 text-sm ${state.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
          {state.message}
          {state.settlementNumber ? `（${state.settlementNumber}）` : ''}
        </div>
      ) : null}

      {settlements.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          尚未建立供應商對帳。選擇月份後，系統會先檢查付款、退款、折扣與重複結算。
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>對帳單</TableHead>
              <TableHead>期間</TableHead>
              <TableHead className="text-right">銷售筆數</TableHead>
              <TableHead className="text-right">淨實收</TableHead>
              <TableHead className="text-right">匠寵分潤</TableHead>
              <TableHead className="text-right">應付供應商</TableHead>
              <TableHead>狀態</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {settlements.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-xs">
                  <Link href={`/vendors/${vendorId}/settlements/${row.id}`} className="font-medium hover:underline">
                    {row.settlementNumber}
                  </Link>
                </TableCell>
                <TableCell>
                  {formatDate(row.periodStart)}–{formatDate(new Date(new Date(row.periodEnd).getTime() - 1))}
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.itemCount}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(row.grossCollectedTwd)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(row.furmosaShareTwd)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(row.vendorPayableTwd)}</TableCell>
                <TableCell><Badge variant="muted">{statusLabel[row.status] ?? row.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
