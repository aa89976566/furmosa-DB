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
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import { SettlementTxnLink } from '@/components/settlements/settlement-txn-link';
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
  orderId?: string | null;
  orderNumber?: string | null;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  grossSales: number;
  commissionAmount: number;
  companyRevenue: number;
  createdAt: string; // ISO
  lineSource?: 'sale' | 'stocktake';
};

type Summary = {
  totalQuantity: number;
  cashCollected: number;
  commissionAmount: number;
  rewardPayout: number;
  shippingFee: number;
  merchantOwesUs: number;
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
  rewardPayout,
  preview,
  pastSettlements,
  createSettlementAction,
  hasPreviewQuery,
  previewBasePath,
  showPastSettlements = true,
}: {
  merchantId: string;
  defaultFrom: string;
  defaultTo: string;
  currentFrom: string | null;
  currentTo: string | null;
  shippingFee: number;
  rewardPayout: number;
  preview: Summary | null;
  pastSettlements: PastSettlement[];
  createSettlementAction: (formData: FormData) => void | Promise<void>;
  hasPreviewQuery: boolean;
  /** 試算 GET 表單送出網址，預設為單店結算頁 */
  previewBasePath?: string;
  showPastSettlements?: boolean;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const formAction = previewBasePath ?? `/merchants/${merchantId}/settlement`;
  const merchantOwesUs = preview?.merchantOwesUs ?? 0;

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
        action={formAction}
        className="grid gap-3 rounded-lg border bg-muted/20 p-4 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]"
      >
        {previewBasePath ? <input type="hidden" name="view" value="create" /> : null}
        {previewBasePath ? <input type="hidden" name="merchantId" value={merchantId} /> : null}
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
          <label className="text-xs text-muted-foreground">換罐補貼（公司付店家）</label>
          <input
            type="number"
            name="settle_reward"
            defaultValue={rewardPayout}
            min={0}
            step="1"
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
        <div className="flex items-end md:col-span-2 lg:col-span-1">
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
          這段期間沒有「未結清」的銷售或清點減量紀錄
        </div>
      )}

      {hasPreviewQuery && preview && preview.lines.length > 0 && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              label="毛銷售額（店家收的現金）"
              value={formatCurrency(preview.cashCollected)}
              hint={`${preview.totalQuantity} 件／${preview.lines.length} 筆`}
              tone="info"
            />
            <Kpi
              label="店家應得分潤"
              value={formatCurrency(preview.commissionAmount)}
              hint={`加總後約 ${(preview.effectiveCommissionRate * 100).toFixed(1)}%（肉乾20%／凍乾30%混算）`}
              tone="warning"
            />
            <Kpi
              label="換罐補貼＋運費"
              value={formatCurrency(rewardPayout + shippingFee)}
              hint={`換罐 ${formatCurrency(rewardPayout)} · 運費 ${formatCurrency(shippingFee)}`}
              tone="info"
            />
            <Kpi
              label="公司應付店家（撥款）"
              value={formatCurrency(
                preview.commissionAmount + rewardPayout + shippingFee,
              )}
              hint="= 分潤 + 換罐補貼 + 運費"
              tone="success"
              emphasize
            />
          </div>

          <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground">公司應付店家</p>
              <p className="mt-1 text-2xl font-semibold text-success">
                {formatCurrency(preview.commissionAmount + rewardPayout + shippingFee)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                結算後公司要撥給店家的分潤與補貼。
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">店家應返還公司</p>
              <p className="mt-1 text-2xl font-semibold">
                {formatCurrency(merchantOwesUs)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                店家跟客人收的錢，扣掉自己該留的分潤與補貼後，要匯回公司的金額。
              </p>
            </div>
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
                      <TableCell>
                        <SettlementTxnLink
                          txnId={l.txnId}
                          txnNumber={l.txnNumber}
                          orderId={l.orderId}
                          orderNumber={l.orderNumber}
                        />
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/products/${l.productId}`}
                          className="font-medium hover:underline"
                        >
                          {l.productName}
                        </Link>
                        {l.lineSource === 'stocktake' && (
                          <Badge variant="secondary" className="ml-1 text-[10px]">
                            清點減量
                          </Badge>
                        )}
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
            <input type="hidden" name="rewardPayout" value={rewardPayout} />

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
      {showPastSettlements && pastSettlements.length > 0 && (
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
                        <Link href={`/merchants/settlements/${s.id}`}>查看</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {!hasPreviewQuery && (!showPastSettlements || pastSettlements.length === 0) && (
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
  emphasize = false,
}: {
  label: string;
  value: string;
  suffix?: string;
  hint?: string;
  tone?: 'default' | 'success' | 'info' | 'warning';
  emphasize?: boolean;
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
    <div className={`rounded-lg border p-3 ${cls} ${emphasize ? 'ring-1 ring-success/40' : ''}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`mt-1 font-semibold tabular-nums ${emphasize ? 'text-2xl text-success' : 'text-xl'}`}
      >
        {value}
        {suffix && (
          <span className="ml-1 text-xs font-normal text-muted-foreground">{suffix}</span>
        )}
      </div>
      {hint && <div className="mt-1 text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
