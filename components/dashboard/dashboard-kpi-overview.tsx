import Link from 'next/link';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';

export type DashboardKpis = {
  todayOrderCount: number;
  monthRevenue: number;
  inventoryValue: number;
  lowStockCount: number;
  merchantsCount: number;
  pendingSettlementAmount: number;
  activeSubscriptionsCount: number;
  repurchaseRate: number;
  newCustomersThisMonth: number;
  monthJarPointsIssued: number;
  monthGroomingCouponCost: number;
  weekJarPointsEarnedMemberCount: number;
  weekJarPointsRedeemedMemberCount: number;
  weekJarRedeemCount: number;
};

function DarkKpi({
  label,
  value,
  href,
  hint,
}: {
  label: string;
  value: string;
  href?: string;
  hint?: string;
}) {
  const body = (
    <div className="bento-kpi space-y-3 transition-opacity hover:opacity-90">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-white/55">{label}</p>
      <p className="font-display text-3xl font-semibold tracking-tight tabular-nums text-white md:text-4xl">
        {value}
      </p>
      {hint ? <p className="text-xs text-white/45">{hint}</p> : null}
    </div>
  );
  if (!href) return body;
  return (
    <Link href={href} className="block outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {body}
    </Link>
  );
}

function StatRow({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  const row = (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-3 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="shrink-0 font-medium tabular-nums text-ink">{value}</span>
    </div>
  );
  if (!href) return row;
  return (
    <Link href={href} className="block transition-opacity hover:opacity-80">
      {row}
    </Link>
  );
}

function StatColumn({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('min-w-0', className)}>
      <h3 className="mb-1 text-sm font-semibold text-ink">{title}</h3>
      <div>{children}</div>
    </section>
  );
}

/** 主數字橫排：全寬三卡，避免直欄造成版面空洞 */
export function DashboardHeroKpis({ kpis }: { kpis: DashboardKpis }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <DarkKpi
        label="本月營收"
        value={formatCurrency(kpis.monthRevenue)}
        href="/orders"
        hint="不含已取消"
      />
      <DarkKpi
        label="今日訂單"
        value={formatNumber(kpis.todayOrderCount)}
        href="/orders"
      />
      <DarkKpi
        label="本週換罐"
        value={formatNumber(kpis.weekJarRedeemCount)}
        href="/jar-exchange/manage?tab=codes"
      />
    </div>
  );
}

/**
 * 營運概覽次級數字：白卡內清單，訂閱置底。
 */
export function DashboardKpiOverview({ kpis }: { kpis: DashboardKpis }) {
  return (
    <div className="space-y-8">
      <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
        <StatColumn title="客戶">
          <StatRow
            label="本月新增"
            value={formatNumber(kpis.newCustomersThisMonth)}
            href="/customers"
          />
          <StatRow label="本月回購率" value={formatPercent(kpis.repurchaseRate)} />
        </StatColumn>

        <StatColumn title="換罐">
          <StatRow
            label="近 7 天入帳人數"
            value={formatNumber(kpis.weekJarPointsEarnedMemberCount)}
            href="/jar-exchange/manage?tab=ledger"
          />
          <StatRow
            label="近 7 天兌換人數"
            value={formatNumber(kpis.weekJarPointsRedeemedMemberCount)}
            href="/jar-exchange/manage?tab=rewards"
          />
          <StatRow
            label="本月點數發放"
            value={formatNumber(kpis.monthJarPointsIssued)}
            href="/jar-exchange/manage?tab=ledger"
          />
          <StatRow
            label="本月美容券成本"
            value={formatCurrency(kpis.monthGroomingCouponCost)}
            href="/jar-exchange/manage?tab=rewards"
          />
        </StatColumn>

        <StatColumn title="庫存與結算">
          <StatRow
            label="庫存總值"
            value={formatCurrency(kpis.inventoryValue)}
            href="/inventory"
          />
          <StatRow
            label="低庫存品項"
            value={formatNumber(kpis.lowStockCount)}
            href="/inventory"
          />
          <StatRow
            label="寄賣店數"
            value={formatNumber(kpis.merchantsCount)}
            href="/merchants"
          />
          <StatRow
            label="待結算金額"
            value={formatCurrency(kpis.pendingSettlementAmount)}
            href="/merchants/settlements"
          />
        </StatColumn>
      </div>

      <section className="border-t border-border/60 pt-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-ink">訂閱</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">較低頻，置於概覽底部</p>
          </div>
          <Link
            href="/subscriptions"
            className="font-display text-3xl font-semibold tabular-nums text-ink transition-opacity hover:opacity-80"
          >
            {formatNumber(kpis.activeSubscriptionsCount)}
            <span className="ml-2 text-sm font-sans font-normal text-muted-foreground">
              活躍約
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}
