import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatDate, formatDateTime, formatPercent } from '@/lib/format';
import { calcSettlement } from '@/lib/settlement-calc';
import { ArrowLeft, CheckCircle2, Send, FileCheck2, DollarSign, Trash2 } from 'lucide-react';
import { updateSettlementStatus, deleteSettlement } from '../actions';

export const dynamic = 'force-dynamic';

const NEXT_STATUS: Record<string, { value: string; label: string; icon: typeof Send } | null> = {
  draft: { value: 'reviewing', label: '送出審核', icon: Send },
  reviewing: { value: 'approved', label: '核准', icon: FileCheck2 },
  approved: { value: 'paid', label: '標記已撥款', icon: DollarSign },
  paid: null,
};

export default async function SettlementDetailPage({ params }: { params: { id: string } }) {
  const settlement = await prisma.settlement.findUnique({
    where: { id: params.id },
    include: { merchant: true },
  });
  if (!settlement) notFound();

  // 重新計算當期銷售明細：要把「自己鎖住」的也納進來，否則扣掉後就找不到了
  const summary = await calcSettlement({
    merchantId: settlement.merchantId,
    periodStart: settlement.periodStart,
    periodEnd: settlement.periodEnd,
    rewardPayout: Number(settlement.rewardPayout),
    shippingFee: Number(settlement.shippingFee),
    includeSettlementId: settlement.id,
  });

  // 偵測差異：只計算「鎖在這張結算」的部分跟存的金額是否一致；其他「未結清」的銷售屬於下一張結算
  const lockedLines = summary.lines.filter((l) => l.settlementId === settlement.id);
  const lockedGross = lockedLines.reduce((s, l) => s + l.grossSales, 0);
  const lockedCommission = lockedLines.reduce((s, l) => s + l.commissionAmount, 0);
  const drift =
    Math.abs(lockedGross - Number(settlement.grossSales)) > 0.01 ||
    Math.abs(lockedCommission - Number(settlement.commissionAmount)) > 0.01;
  const unlockedCount = summary.lines.length - lockedLines.length;

  const next = NEXT_STATUS[settlement.status];

  return (
    <>
      <PageHeader
        title={settlement.settlementId}
        description={`${settlement.merchant.name} · ${formatDate(settlement.periodStart)} ~ ${formatDate(settlement.periodEnd)}`}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/settlements">
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回列表
            </Link>
          </Button>
        }
      />
      <div className="grid gap-6 p-6 lg:grid-cols-3">
        <SectionCard title="結算摘要" className="lg:col-span-1">
          <dl className="space-y-2 text-sm">
            <Row label="編號" value={settlement.settlementId} />
            <Row
              label="店家"
              value={
                <Link
                  href={`/merchants/${settlement.merchant.id}`}
                  className="hover:underline"
                >
                  {settlement.merchant.name}
                </Link>
              }
            />
            <Row
              label="期間"
              value={`${formatDate(settlement.periodStart)} ~ ${formatDate(settlement.periodEnd)}`}
            />
            <Row label="店家收現金" value={formatCurrency(Number(settlement.grossSales))} />
            <Row
              label="實際抽成率"
              value={formatPercent(Number(settlement.commissionRate), 1)}
            />
            <Row label="店家分潤" value={formatCurrency(Number(settlement.commissionAmount))} />
            <Row label="換罐補貼" value={formatCurrency(Number(settlement.rewardPayout))} />
            <Row label="運費" value={formatCurrency(Number(settlement.shippingFee))} />
            <Row
              label="店家應返公司"
              value={
                <span className="text-base font-semibold text-success">
                  {formatCurrency(Number(settlement.merchantOwesUs))}
                </span>
              }
            />
            <Row
              label="（公司應付店家）"
              value={
                <span className="text-xs text-muted-foreground">
                  {formatCurrency(Number(settlement.payable))}
                </span>
              }
            />
            <Row
              label="狀態"
              value={<StatusBadge kind="settlement" value={settlement.status} />}
            />
            {settlement.paidAt ? (
              <Row label="撥款時間" value={formatDateTime(settlement.paidAt)} />
            ) : null}
            {settlement.note ? <Row label="備註" value={settlement.note} /> : null}
          </dl>
        </SectionCard>

        <div className="space-y-6 lg:col-span-2">
          {drift && (
            <div className="rounded-lg border border-warning/40 bg-warning/5 p-4 text-sm">
              <div className="font-medium text-warning">⚠ 鎖定的銷售與結算金額不符</div>
              <div className="mt-1 text-xs text-muted-foreground">
                這張結算鎖住的流水有變更（可能被改／刪）。鎖定加總：銷售{' '}
                {formatCurrency(lockedGross)} · 店家分潤{' '}
                {formatCurrency(lockedCommission)}。建議刪除後重建。
              </div>
            </div>
          )}
          {unlockedCount > 0 && (
            <div className="rounded-lg border border-info/30 bg-info/5 p-4 text-sm">
              <div className="font-medium text-info">期間內還有 {unlockedCount} 筆未結清銷售</div>
              <div className="mt-1 text-xs text-muted-foreground">
                這些是建立此結算之後才登記的銷售；它們會出現在店家頁的下一次結算試算中。
              </div>
            </div>
          )}

          <SectionCard
            title="狀態流程"
            description="draft → reviewing → approved → paid"
          >
            <div className="flex flex-wrap items-center gap-3">
              {(['draft', 'reviewing', 'approved', 'paid'] as const).map((s, i, arr) => {
                const idx = arr.indexOf(settlement.status as never);
                const cur = i === idx;
                const done = i < idx;
                return (
                  <div key={s} className="flex items-center gap-2">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs ${
                        done
                          ? 'bg-success text-success-foreground'
                          : cur
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                    </div>
                    <StatusBadge kind="settlement" value={s} />
                    {i < arr.length - 1 && (
                      <div className="h-px w-6 bg-border" aria-hidden />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {next && (
                <form action={updateSettlementStatus}>
                  <input type="hidden" name="id" value={settlement.id} />
                  <input type="hidden" name="next" value={next.value} />
                  <Button size="sm">
                    <next.icon className="mr-1 h-4 w-4" />
                    {next.label}
                  </Button>
                </form>
              )}
              {settlement.status !== 'paid' && (
                <form action={deleteSettlement}>
                  <input type="hidden" name="id" value={settlement.id} />
                  <Button size="sm" variant="outline" className="text-destructive">
                    <Trash2 className="mr-1 h-4 w-4" />
                    刪除結算
                  </Button>
                </form>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title={`銷售明細（${summary.lines.length}）`}
            description="本結算單的金額來源 — 期間內所有「賣出」流水"
          >
            {summary.lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">期間內沒有銷售紀錄</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>時間</TableHead>
                    <TableHead>單號</TableHead>
                    <TableHead>商品</TableHead>
                    <TableHead className="text-right">數量</TableHead>
                    <TableHead className="text-right">單價</TableHead>
                    <TableHead className="text-right">小計</TableHead>
                    <TableHead className="text-right">店家分潤</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.lines.map((l) => {
                    const locked = l.settlementId === settlement.id;
                    return (
                      <TableRow key={l.txnId} className={locked ? '' : 'bg-muted/40'}>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDateTime(l.createdAt)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{l.txnNumber}</TableCell>
                        <TableCell>
                          <Link
                            href={`/products/${l.productId}`}
                            className="font-medium hover:underline"
                          >
                            {l.productName}
                          </Link>
                          {!locked && (
                            <span className="ml-2 text-[10px] text-muted-foreground">
                              （未結清，屬下次結算）
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">{l.quantity}</TableCell>
                        <TableCell className="text-right text-sm">
                          {formatCurrency(l.unitPrice)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(l.grossSales)}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-success">
                          {formatCurrency(l.commissionAmount)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </SectionCard>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b pb-2 last:border-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
