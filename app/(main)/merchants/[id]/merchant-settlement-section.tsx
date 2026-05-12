'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/shared/section-card';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import {
  Calculator,
  ChevronDown,
  ChevronRight,
  Receipt,
  FileCheck2,
  AlertCircle,
} from 'lucide-react';

type Line = {
  txnId: string;
  txnNumber: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  grossSales: number;
  commissionAmount: number;
  companyRevenue: number;
  createdAt: string; // ISO
};

type Summary = {
  totalQuantity: number;
  cashCollected: number;
  commissionAmount: number;
  effectiveCommissionRate: number;
  lines: Line[];
};

type PastSettlement = {
  id: string;
  settlementId: string;
  periodStart: string;
  periodEnd: string;
  grossSales: number;
  commissionAmount: number;
  shippingFee: number;
  merchantOwesUs: number;
  payable: number;
  status: string;
  createdAt: string;
};

export function MerchantSettlementSection({
  merchantId,
  defaultFrom,
  defaultTo,
  currentFrom,
  currentTo,
  shippingFee,
  preview,
  pastSettlements,
  createSettlementAction,
  hasPreviewQuery,
}: {
  merchantId: string;
  defaultFrom: string;
  defaultTo: string;
  currentFrom: string | null;
  currentTo: string | null;
  shippingFee: number;
  preview: Summary | null;
  pastSettlements: PastSettlement[];
  createSettlementAction: (formData: FormData) => void | Promise<void>;
  hasPreviewQuery: boolean;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const merchantOwesUs = preview
    ? preview.cashCollected - preview.commissionAmount - shippingFee
    : 0;

  return (
    <SectionCard
      id="settlement"
      title={
        <span className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-primary" />
          期間結算
        </span>
      }
    >
      {/* 篩選表單（GET，會帶到 merchant page 自己的 search params） */}
      <form
        method="get"
        className="grid gap-3 rounded-lg border bg-muted/20 p-4 md:grid-cols-[1fr_1fr_1fr_auto]"
      >
        {/* 保留店家頁可能會用到的其他 query 參數 */}
        <input type="hidden" name="tab" value="settlement" />
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">期間起</label>
          <input
            type="date"
            name="settle_from"
            defaultValue={currentFrom ?? defaultFrom}
            required
            className="block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">期間迄</label>
          <input
            type="date"
            name="settle_to"
            defaultValue={currentTo ?? defaultTo}
            required
            className="block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">運費（公司補店家／可填）</label>
          <input
            type="number"
            name="settle_shipping"
            defaultValue={shippingFee}
            min={0}
            step="1"
            className="block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" className="w-full md:w-auto">
            <Calculator className="mr-1 h-4 w-4" />
            試算
          </Button>
        </div>
      </form>

      {/* 試算結果 */}
      {hasPreviewQuery && preview && preview.lines.length === 0 && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          這段期間沒有「未結清」的銷售紀錄
        </div>
      )}

      {hasPreviewQuery && preview && preview.lines.length > 0 && (
        <div className="mt-4 space-y-4">
          {/* KPIs */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Kpi label="銷售筆數" value={`${preview.lines.length}`} suffix="筆" />
            <Kpi label="賣出件數" value={`${preview.totalQuantity}`} suffix="件" />
            <Kpi
              label="店家收現金"
              value={formatCurrency(preview.cashCollected)}
              tone="info"
            />
            <Kpi
              label="店家分潤"
              value={formatCurrency(preview.commissionAmount)}
              hint={`抽成率 ${(preview.effectiveCommissionRate * 100).toFixed(1)}%`}
              tone="warning"
            />
            <Kpi
              label="店家應返公司"
              value={formatCurrency(merchantOwesUs)}
              hint={
                shippingFee > 0
                  ? `已扣運費 ${formatCurrency(shippingFee)}`
                  : '收現金 - 分潤 - 運費'
              }
              tone="success"
            />
          </div>

          {/* 展開明細 */}
          <button
            type="button"
            onClick={() => setShowDetail(!showDetail)}
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            {showDetail ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            {showDetail ? '收起' : '展開'}銷售明細（{preview.lines.length} 筆）
          </button>

          {showDetail && (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>時間</TableHead>
                    <TableHead>單號</TableHead>
                    <TableHead>商品</TableHead>
                    <TableHead className="text-right">數量</TableHead>
                    <TableHead className="text-right">單價</TableHead>
                    <TableHead className="text-right">店家收</TableHead>
                    <TableHead className="text-right">店家分潤</TableHead>
                    <TableHead className="text-right">公司實收</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.lines.map((l) => (
                    <TableRow key={l.txnId}>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(new Date(l.createdAt))}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{l.txnNumber}</TableCell>
                      <TableCell>
                        <Link
                          href={`/products/${l.productId}`}
                          className="font-medium hover:underline"
                        >
                          {l.productName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right font-mono">{l.quantity}</TableCell>
                      <TableCell className="text-right text-sm">
                        {formatCurrency(l.unitPrice)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(l.grossSales)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-warning">
                        {formatCurrency(l.commissionAmount)}
                      </TableCell>
                      <TableCell className="text-right text-success">
                        {formatCurrency(l.companyRevenue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* 結清按鈕 */}
          <form
            action={createSettlementAction}
            className="flex flex-wrap items-end gap-3 rounded-lg border bg-success/[0.04] p-4"
          >
            <input type="hidden" name="merchantId" value={merchantId} />
            <input type="hidden" name="periodStart" value={currentFrom ?? defaultFrom} />
            <input type="hidden" name="periodEnd" value={currentTo ?? defaultTo} />
            <input type="hidden" name="shippingFee" value={shippingFee} />

            <div className="flex-1 space-y-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground">備註（選填）</label>
              <input
                type="text"
                name="note"
                placeholder="例如：店家匯款於 5/15..."
                className="block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <Button type="submit" className="bg-success hover:bg-success/90">
              <FileCheck2 className="mr-1 h-4 w-4" />
              結清此期間（{preview.lines.length} 筆 · 應返{' '}
              {formatCurrency(merchantOwesUs)}）
            </Button>
          </form>

          <p className="text-xs text-muted-foreground">
            ✓ 結清後，這 {preview.lines.length} 筆銷售會被鎖到本張結算單上，下次試算時不會再出現。
          </p>
        </div>
      )}

      {/* 過往結算清單 */}
      {pastSettlements.length > 0 && (
        <div className="mt-6 space-y-2">
          <h4 className="text-sm font-medium">過往結算（{pastSettlements.length}）</h4>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>編號</TableHead>
                  <TableHead>期間</TableHead>
                  <TableHead className="text-right">店家收</TableHead>
                  <TableHead className="text-right">店家分潤</TableHead>
                  <TableHead className="text-right">運費</TableHead>
                  <TableHead className="text-right">店家應返</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pastSettlements.map((s) => (
                  <TableRow key={s.id} id={`settlement-${s.id}`}>
                    <TableCell className="font-mono text-xs">{s.settlementId}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(new Date(s.periodStart))} ~ {formatDate(new Date(s.periodEnd))}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(s.grossSales)}
                    </TableCell>
                    <TableCell className="text-right text-warning">
                      {formatCurrency(s.commissionAmount)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {s.shippingFee > 0 ? formatCurrency(s.shippingFee) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-success">
                      {formatCurrency(s.merchantOwesUs)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge kind="settlement" value={s.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/settlements/${s.id}`}>查看</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {!hasPreviewQuery && pastSettlements.length === 0 && (
        <div className="mt-4 rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          尚無結算紀錄。選擇期間後點「試算」即可開始
        </div>
      )}
    </SectionCard>
  );
}

function Kpi({
  label,
  value,
  suffix,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  suffix?: string;
  hint?: string;
  tone?: 'default' | 'success' | 'info' | 'warning';
}) {
  const cls =
    tone === 'success'
      ? 'border-success/30 bg-success/5'
      : tone === 'info'
        ? 'border-info/30 bg-info/5'
        : tone === 'warning'
          ? 'border-warning/30 bg-warning/5'
          : '';
  return (
    <div className={`rounded-lg border p-3 ${cls}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">
        {value}
        {suffix && (
          <span className="ml-1 text-xs font-normal text-muted-foreground">{suffix}</span>
        )}
      </div>
      {hint && <div className="mt-1 text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
