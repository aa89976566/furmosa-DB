import Link from 'next/link';
import type { JarPlanOverview } from '@/lib/jar-exchange/plan-overview';
import { formatCurrency, formatNumber, formatRelative } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { JarPanel } from '@/components/jar-exchange/jar-shell';
import { cn } from '@/lib/utils';
import {
  Activity,
  BarChart3,
  Link2,
  Package,
  Store,
  Users,
} from 'lucide-react';

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-canvas/60 px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-navy">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function PipelineChip({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: 'warning' | 'info' | 'success' | 'secondary';
}) {
  const toneClass =
    tone === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-950'
      : tone === 'info'
        ? 'border-sky-200 bg-sky-50 text-sky-950'
        : tone === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
          : 'border-border bg-muted/40 text-foreground';
  return (
    <div className={cn('rounded-xl border px-3 py-2.5', toneClass)}>
      <p className="text-xs font-medium opacity-80">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{formatNumber(count)}</p>
    </div>
  );
}

function connectionTone(row: JarPlanOverview['posConnections'][number]) {
  if (row.userCount === 0) return { label: '未開 POS', variant: 'secondary' as const };
  if (!row.lastLoginAt) return { label: '從未登入', variant: 'warning' as const };
  const days =
    (Date.now() - new Date(row.lastLoginAt).getTime()) / (1000 * 60 * 60 * 24);
  if (days <= 7) return { label: '近 7 日有登入', variant: 'success' as const };
  if (days <= 30) return { label: '本月有登入', variant: 'info' as const };
  return { label: '久未登入', variant: 'warning' as const };
}

export function JarPlanReportSection({ data }: { data: JarPlanOverview }) {
  const { kpis, refill } = data;
  return (
    <JarPanel>
      <div className="flex flex-col gap-3 border-b border-border/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-navy">
            <BarChart3 className="h-4 w-4 text-primary" />
            換罐報告
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            序號／點數／待到店換罐流水；美容券金額另見核銷報表
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/store-report">店家核銷報表</Link>
        </Button>
      </div>

      <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="本週序號兌換"
          value={formatNumber(kpis.weekJarRedeemCount)}
          hint="已使用換罐序號"
        />
        <KpiCard
          label="本月點數發放"
          value={formatNumber(kpis.monthJarPointsIssued)}
          hint="jar_code_redeem"
        />
        <KpiCard
          label="近 7 日點數進出會員"
          value={`${formatNumber(kpis.weekJarPointsEarnedMemberCount)} / ${formatNumber(kpis.weekJarPointsRedeemedMemberCount)}`}
          hint="獲得／消耗人數"
        />
        <KpiCard
          label="本月美容券成本"
          value={formatCurrency(kpis.monthGroomingCouponCost)}
          hint="jar_return_program"
        />
      </div>

      <div className="border-t border-border/60 px-5 py-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-navy">待處理換罐訂單</h3>
            <p className="text-xs text-muted-foreground">
              進行中共 {formatNumber(refill.openTotal)} 筆 · 本週完成{' '}
              {formatNumber(refill.completedThisWeek)} · 近 7 日完成{' '}
              {formatNumber(refill.completedLast7Days)}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <PipelineChip label="待付款" count={refill.paymentPending} tone="secondary" />
          <PipelineChip label="待收空罐" count={refill.waitingReturn} tone="warning" />
          <PipelineChip label="已驗罐待交付" count={refill.verified} tone="info" />
          <PipelineChip label="待補差額" count={refill.awaitingExtra} tone="warning" />
        </div>
      </div>
    </JarPanel>
  );
}

export function JarPlanPosSection({ data }: { data: JarPlanOverview }) {
  const { summary, posConnections } = data;
  return (
    <JarPanel>
      <div className="flex flex-col gap-3 border-b border-border/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-navy">
            <Link2 className="h-4 w-4 text-primary" />
            POS 店家連線
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            換罐計畫店家 {formatNumber(summary.jarMerchantCount)} 家 · 已開帳號{' '}
            {formatNumber(summary.posLinkedCount)} · 近 7 日有登入{' '}
            {formatNumber(summary.posActiveIn7dCount)}
            {summary.neverLoggedInCount > 0
              ? ` · 從未登入 ${formatNumber(summary.neverLoggedInCount)}`
              : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/jar-exchange/stores">合作店家</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/merchants">寄賣總覽</Link>
          </Button>
        </div>
      </div>

      {posConnections.length === 0 ? (
        <p className="px-5 py-8 text-sm text-muted-foreground">
          尚無換罐店家或 POS 帳號。請先在合作店家標記「換罐」類型並建立店家帳號。
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-border/60 bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">店家</th>
                <th className="px-3 py-3 font-medium">POS 帳號</th>
                <th className="px-3 py-3 font-medium">連線狀態</th>
                <th className="px-3 py-3 font-medium">最近登入</th>
                <th className="px-5 py-3 font-medium">待換罐</th>
              </tr>
            </thead>
            <tbody>
              {posConnections.map((row) => {
                const tone = connectionTone(row);
                return (
                  <tr
                    key={row.merchantId}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/merchants/${row.merchantId}`}
                        className="font-medium text-navy hover:underline"
                      >
                        {row.name}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {row.merchantCode}
                        </span>
                        {row.city ? (
                          <span className="text-[10px] text-muted-foreground">{row.city}</span>
                        ) : null}
                        {row.isJarExchange ? (
                          <Badge variant="outline" className="h-4 px-1 text-[9px]">
                            換罐
                          </Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {row.userCount === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span>
                          {row.activeUserCount}
                          <span className="text-muted-foreground"> / {row.userCount}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={tone.variant}>{tone.label}</Badge>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {row.lastLoginAt ? formatRelative(row.lastLoginAt) : '—'}
                    </td>
                    <td className="px-5 py-3">
                      {row.openRefillCount > 0 ? (
                        <span className="font-semibold tabular-nums text-primary">
                          {row.openRefillCount}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </JarPanel>
  );
}

export function JarPlanQuickLinks() {
  const links = [
    { href: '/jar-exchange/members', label: '會員列表', icon: Users },
    { href: '/jar-exchange/stores', label: '合作店家', icon: Store },
    { href: '/jar-exchange/flavours', label: '口味與庫存', icon: Package },
    { href: '/jar-exchange/manage?tab=codes', label: '序號管理', icon: Activity },
    { href: '/admin/store-report', label: '核銷報表', icon: BarChart3 },
  ] as const;

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      {links.map((link) => {
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card px-4 py-3 text-sm font-medium text-navy shadow-card transition hover:border-primary/35"
          >
            <Icon className="h-4 w-4 text-primary" />
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
