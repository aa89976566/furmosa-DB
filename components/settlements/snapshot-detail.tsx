import Link from 'next/link';
import { CheckCircle2, DollarSign, FileCheck2, Send } from 'lucide-react';
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
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import { updateSettlementStatus } from '@/app/(main)/settlements/actions';
import {
  formatSourceAmount,
  type SettlementSnapshotView,
} from '@/lib/settlements/read-snapshot';

const SOURCE_KIND_LABEL: Record<string, string> = {
  consignment_sale: '寄賣銷售',
  store_collection: '店家代收現金',
  coupon_subsidy: '優惠券補貼',
};

const NEXT_STATUS: Record<string, { value: string; label: string; icon: typeof Send } | null> = {
  draft: { value: 'reviewing', label: '送出審核', icon: Send },
  reviewing: { value: 'approved', label: '核准', icon: FileCheck2 },
  approved: { value: 'paid', label: '標記已撥款', icon: DollarSign },
  paid: null,
  // 已撤回是稽核殘留，不得從這裡推回流程。
  cancelled: null,
};

/**
 * 新版結算的快照顯示。
 *
 * 讀的是送出當時存下的來源明細與淨額，**不呼叫 `calcSettlement`、不重算**，
 * 所以商品主檔或映射規則之後變更都不會改寫這張的歷史金額。
 * 也不提供刪除：帶有來源明細的結算必須保留稽核。
 */
export function SnapshotDetail({
  view,
  merchantId,
  merchantName,
}: {
  view: SettlementSnapshotView;
  merchantId: string;
  merchantName: string;
}) {
  const { header } = view;
  const next = NEXT_STATUS[header.status];
  const owedByStore = view.netPayableTwd > 0;

  return (
    <div className="grid gap-6 p-6 lg:grid-cols-3">
      <SectionCard title="結算摘要" className="lg:col-span-1">
        <dl className="space-y-2 text-sm">
          <Row label="編號" value={header.settlementId} />
          <Row
            label="店家"
            value={
              <Link href={`/merchants/${merchantId}`} className="hover:underline">
                {merchantName}
              </Link>
            }
          />
          <Row
            label="期間"
            value={`${formatDate(header.periodStart)} ~ ${formatDate(header.periodEnd)}`}
          />
          {/* 這四個是 legacy Float 口徑，必須顯示原始小數；下面兩個是整數口徑。 */}
          <Row label="寄賣銷售額" value={formatSourceAmount(header.grossSales)} />
          <Row label="店家分潤" value={formatSourceAmount(header.commissionAmount)} />
          <Row label="優惠券補貼" value={formatSourceAmount(header.rewardPayout)} />
          <Row label="運費" value={formatSourceAmount(header.shippingFee)} />
          <Row label="店家代收現金" value={formatCurrency(header.storeCollected ?? 0)} />
          <Row
            label={owedByStore ? '店家應匯回公司' : '公司應匯給店家'}
            value={
              <span className="text-base font-semibold text-success">
                {formatCurrency(Math.abs(view.netPayableTwd))}
              </span>
            }
          />
          <Row label="狀態" value={<StatusBadge kind="settlement" value={header.status} />} />
          <Row label="結算版本" value={header.rulesVersion ?? '—'} />
          {header.intendedPaymentMethod ? (
            <Row label="預定付款方式" value={header.intendedPaymentMethod} />
          ) : null}
          {header.paidAt && header.status === 'paid' ? (
            <Row label="撥款時間" value={formatDateTime(header.paidAt)} />
          ) : null}
          {header.note ? <Row label="備註" value={header.note} /> : null}
        </dl>
      </SectionCard>

      <div className="space-y-6 lg:col-span-2">
        {view.withdrawn ? (
          <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
            <div className="font-medium">這張結算已被店家撤回</div>
            <div className="mt-1 text-xs text-muted-foreground">
              金額與來源明細保留為稽核紀錄，不計入有效統計。店家可用新的操作重新送出。
            </div>
          </div>
        ) : null}

        <SectionCard title="狀態流程" description="draft → reviewing → approved → paid">
          <div className="flex flex-wrap items-center gap-3">
            {(['draft', 'reviewing', 'approved', 'paid'] as const).map((s, i, arr) => {
              const idx = arr.indexOf(header.status as never);
              const cur = i === idx;
              const done = idx >= 0 && i < idx;
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
                  {i < arr.length - 1 && <div className="h-px w-6 bg-border" aria-hidden />}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {next ? (
              <form action={updateSettlementStatus}>
                <input type="hidden" name="id" value={header.id} />
                <input type="hidden" name="next" value={next.value} />
                <Button size="sm">
                  <next.icon className="mr-1 h-4 w-4" />
                  {next.label}
                </Button>
              </form>
            ) : null}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            這張結算帶有來源明細，為了保留稽核紀錄不提供刪除。需要作廢請由店家撤回，或另建沖銷。
          </p>
        </SectionCard>

        <SectionCard
          title={`來源明細（${view.auditSources.length}）`}
          description="送出當時存下的逐筆來源快照，不重算；金額顯示原始小數"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>時間</TableHead>
                <TableHead>種類</TableHead>
                <TableHead>來源鍵</TableHead>
                <TableHead className="text-right">數量</TableHead>
                <TableHead className="text-right">單價</TableHead>
                <TableHead className="text-right">原值</TableHead>
                <TableHead className="text-right">店家分潤</TableHead>
                <TableHead>狀態</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.auditSources.map((row) => (
                <TableRow key={row.id} className={row.voidedAt ? 'bg-muted/40' : ''}>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(row.occurredAt)}
                  </TableCell>
                  <TableCell>{SOURCE_KIND_LABEL[row.sourceKind] ?? row.sourceKind}</TableCell>
                  <TableCell className="font-mono text-xs">{row.sourceKey}</TableCell>
                  <TableCell className="text-right font-mono">{row.quantity ?? '—'}</TableCell>
                  <TableCell className="text-right text-sm">
                    {row.unitPrice == null ? '—' : formatSourceAmount(row.unitPrice)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatSourceAmount(row.originalAmount)}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-success">
                    {row.commissionAmount == null ? '—' : formatSourceAmount(row.commissionAmount)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.voidedAt ? '已作廢（保留稽核）' : '認列中'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>
      </div>
    </div>
  );
}

/** 讀不到或無法安全解讀時的可讀畫面。不得 fallback 成舊公式，也不得 500。 */
export function SnapshotUnavailable({ error }: { error: string }) {
  return (
    <div className="p-6">
      <SectionCard title="這張結算暫時無法顯示">
        <p className="text-sm text-muted-foreground">{error}</p>
      </SectionCard>
    </div>
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
