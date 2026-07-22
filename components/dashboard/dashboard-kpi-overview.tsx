import Link from 'next/link';
import {
  AlertTriangle,
  CalendarRange,
  CircleDollarSign,
  PackageSearch,
  Repeat,
  ShoppingBag,
  Store,
  UserPlus,
  Wallet,
  Sparkles,
  Gift,
  Recycle,
  type LucideIcon,
} from 'lucide-react';
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

const accentStyles = {
  primary: {
    bar: 'bg-primary',
    icon: 'bg-primary/10 text-primary ring-primary/20',
  },
  success: {
    bar: 'bg-success',
    icon: 'bg-success/10 text-success ring-success/20',
  },
  warning: {
    bar: 'bg-warning',
    icon: 'bg-warning/10 text-warning ring-warning/20',
  },
  info: {
    bar: 'bg-info',
    icon: 'bg-info/10 text-info ring-info/20',
  },
  destructive: {
    bar: 'bg-destructive',
    icon: 'bg-destructive/10 text-destructive ring-destructive/20',
  },
} as const;

type Accent = keyof typeof accentStyles;

function KpiGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="border-b border-border/60 pb-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {title}
        </h3>
        {description ? (
          <p className="mt-0.5 text-[11px] text-muted-foreground/90">{description}</p>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function HeroKpi({
  title,
  value,
  description,
  icon: Icon,
  accent,
  href,
  className,
}: {
  title: string;
  value: string;
  description?: string;
  icon: LucideIcon;
  accent: Accent;
  href?: string;
  className?: string;
}) {
  const styles = accentStyles[accent];
  const inner = (
    <div
      className={cn(
        'relative overflow-hidden rounded-md border border-border/80 bg-card p-4 shadow-xs transition-linear',
        href && 'hover:border-primary/30 hover:shadow-sm',
        className,
      )}
    >
      <div className={cn('absolute inset-y-0 left-0 w-0.5', styles.bar)} />
      <div className="flex items-start justify-between gap-4 pl-2.5">
        <div className="min-w-0 space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {title}
          </p>
          <p className="font-mono text-3xl font-semibold tracking-tight text-navy tabular-nums md:text-[2.1rem]">
            {value}
          </p>
          {description ? (
            <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-md ring-1 ring-inset',
            styles.icon,
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {inner}
      </Link>
    );
  }
  return inner;
}

function MetricKpi({
  title,
  value,
  description,
  icon: Icon,
  accent,
  href,
}: {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  accent: Accent;
  href?: string;
}) {
  const styles = accentStyles[accent];
  const inner = (
    <div
      className={cn(
        'group relative flex h-full min-h-[5.25rem] flex-col justify-between overflow-hidden rounded-md border border-border/70 bg-card p-3.5 shadow-xs transition-linear',
        href && 'hover:border-primary/25 hover:bg-accent/40',
      )}
    >
      <div className={cn('absolute inset-y-2.5 left-0 w-0.5 opacity-90', styles.bar)} />
      <div className="flex items-start justify-between gap-2 pl-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {title}
        </p>
        <div
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-md ring-1 ring-inset',
            styles.icon,
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <div className="space-y-0.5 pl-2 pt-2">
        <p className="font-mono text-xl font-semibold tracking-tight text-navy tabular-nums">
          {value}
        </p>
        {description ? (
          <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {inner}
      </Link>
    );
  }
  return inner;
}

export function DashboardKpiOverview({ kpis }: { kpis: DashboardKpis }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <HeroKpi
          title="本月營收"
          value={formatCurrency(kpis.monthRevenue)}
          description="本月有效銷售合計 · 不含取消／草稿／寄賣進貨"
          icon={CircleDollarSign}
          accent="success"
          href="/orders"
        />
        <HeroKpi
          title="今日訂單"
          value={formatNumber(kpis.todayOrderCount)}
          description="今日成立銷售單 · 不含取消／草稿／寄賣進貨"
          icon={ShoppingBag}
          accent="info"
          href="/orders"
        />
        <HeroKpi
          title="本週換罐"
          value={formatNumber(kpis.weekJarRedeemCount)}
          description="本週序號返航 · 已兌換罐數（台北週日起算）"
          icon={Recycle}
          accent="primary"
          href="/jar-exchange/manage?tab=codes"
        />
      </div>

      <div className="grid gap-8 rounded-md border border-border/70 bg-card p-4 shadow-xs md:p-5 lg:grid-cols-3">
        <KpiGroup title="客戶與會員" description="成長與回購表現">
          <MetricKpi
            title="本月新增客戶"
            value={formatNumber(kpis.newCustomersThisMonth)}
            description="本月建立的客戶主檔"
            icon={UserPlus}
            accent="success"
            href="/customers"
          />
          <MetricKpi
            title="本月回購率"
            value={formatPercent(kpis.repurchaseRate)}
            description="本月下單客戶中曾有訂單占比"
            icon={CalendarRange}
            accent="info"
          />
          <MetricKpi
            title="訂閱中合約"
            value={formatNumber(kpis.activeSubscriptionsCount)}
            description="status = active"
            icon={Repeat}
            accent="info"
            href="/subscriptions"
          />
        </KpiGroup>

        <KpiGroup title="換罐會員" description="近 7 天活躍與本月成本">
          <MetricKpi
            title="近 7 天入帳人數"
            value={formatNumber(kpis.weekJarPointsEarnedMemberCount)}
            description="有正點數流水的不重複會員（序號返航、人工調整等）"
            icon={UserPlus}
            accent="success"
            href="/jar-exchange/manage?tab=ledger"
          />
          <MetricKpi
            title="近 7 天兌換人數"
            value={formatNumber(kpis.weekJarPointsRedeemedMemberCount)}
            description="有扣點流水的不重複會員（獎勵／美容券兌換）"
            icon={Gift}
            accent="info"
            href="/jar-exchange/manage?tab=rewards"
          />
          <MetricKpi
            title="本月換罐點數發放"
            value={formatNumber(kpis.monthJarPointsIssued)}
            description="序號返航入帳點數合計"
            icon={Sparkles}
            accent="info"
            href="/jar-exchange/manage?tab=ledger"
          />
          <MetricKpi
            title="本月美容券成本"
            value={formatCurrency(kpis.monthGroomingCouponCost)}
            description="行銷成本 · 非銷售收入"
            icon={Wallet}
            accent="warning"
            href="/jar-exchange/manage?tab=rewards"
          />
        </KpiGroup>

        <KpiGroup title="庫存與通路" description="倉儲與寄賣網絡">
          <MetricKpi
            title="庫存總值"
            value={formatCurrency(kpis.inventoryValue)}
            description="成本 × 全倉庫在庫"
            icon={PackageSearch}
            accent="primary"
            href="/inventory"
          />
          <MetricKpi
            title="低庫存品項"
            value={formatNumber(kpis.lowStockCount)}
            description="已達或低於補貨點"
            icon={AlertTriangle}
            accent="warning"
            href="/inventory"
          />
          <MetricKpi
            title="寄賣"
            value={formatNumber(kpis.merchantsCount)}
            icon={Store}
            accent="info"
            href="/merchants"
          />
        </KpiGroup>

        <KpiGroup title="財務結算" description="待處理款項">
          <MetricKpi
            title="待結算金額"
            value={formatCurrency(kpis.pendingSettlementAmount)}
            description="draft · reviewing · approved"
            icon={Wallet}
            accent="warning"
            href="/merchants/settlements"
          />
        </KpiGroup>
      </div>
    </div>
  );
}
