import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SectionCard } from '@/components/shared/section-card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { GROOMING_COUPON_DISCOUNT } from '@/lib/coupons/constants';
import type {
  StoreRedemptionDetailRow,
  StoreRedemptionReportRow,
} from '@/lib/coupons/service';
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/lib/format';
import {
  buildStoreReportHref,
  storeReportQuickPresets,
} from '@/lib/store-redemption-report-query';
import { buildUnifiedStoreRedeemUrl } from '@/lib/stores/redeem-url';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  CalendarRange,
  CircleDollarSign,
  ExternalLink,
  Link2,
  ListOrdered,
  Receipt,
  Store,
  Ticket,
} from 'lucide-react';

const fieldSelectCls =
  'flex h-10 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

type PartnerStoreOption = {
  slug: string;
  name: string;
};

export function StoreRedemptionFilterPanel({
  from,
  to,
  storeSlug,
  storeLabel,
  stores,
}: {
  from: string;
  to: string;
  storeSlug: string | null;
  storeLabel: string | null;
  stores: PartnerStoreOption[];
}) {
  const presets = storeReportQuickPresets(storeSlug);
  const resetHref = buildStoreReportHref({
    from: presets[0].from,
    to: presets[0].to,
  });

  return (
    <SectionCard
      tone="supply"
      icon={CalendarRange}
      title="結帳查詢"
      description="選擇店家與期間，統計應付金額以便與合作店家對帳"
      contentClassName="pt-6"
    >
      <form
        method="get"
        className="space-y-4 rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-muted/20 p-4 sm:p-5"
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))_auto] lg:items-end">
          <div className="space-y-1.5">
            <label htmlFor="store" className="text-xs font-medium text-muted-foreground">
              合作店家
            </label>
            <select
              id="store"
              name="store"
              defaultValue={storeSlug ?? ''}
              className={fieldSelectCls}
            >
              <option value="">全部店家</option>
              {stores.map((store) => (
                <option key={store.slug} value={store.slug}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="from" className="text-xs font-medium text-muted-foreground">
              期間起
            </label>
            <Input id="from" type="date" name="from" defaultValue={from} required />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="to" className="text-xs font-medium text-muted-foreground">
              期間迄
            </label>
            <Input id="to" type="date" name="to" defaultValue={to} required />
          </div>
          <div className="flex flex-wrap gap-2 lg:flex-col lg:justify-end">
            <Button type="submit" className="w-full lg:w-auto">
              查詢報表
            </Button>
            <Button type="button" variant="outline" className="w-full lg:w-auto" asChild>
              <Link href={resetHref}>重設</Link>
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
          <span className="text-xs font-medium text-muted-foreground">快速期間</span>
          {presets.map((preset) => (
            <Link
              key={preset.key}
              href={preset.href}
              className={cn(
                'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                from === preset.from && to === preset.to
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-border/70 bg-background text-muted-foreground hover:border-primary/20 hover:text-foreground',
              )}
            >
              {preset.label}
            </Link>
          ))}
        </div>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant="outline">
          {formatDate(from)} ～ {formatDate(to)}
        </Badge>
        <Badge variant={storeSlug ? 'info' : 'muted'}>
          {storeLabel ? storeLabel : '全部店家'}
        </Badge>
        <Badge variant="success">每張 {formatCurrency(GROOMING_COUPON_DISCOUNT)}</Badge>
      </div>
    </SectionCard>
  );
}

export function StoreRedemptionKpiStrip({
  totalCount,
  totalPayable,
  storeCount,
  storeLabel,
}: {
  totalCount: number;
  totalPayable: number;
  storeCount: number;
  storeLabel: string | null;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
      <HeroKpi
        title={storeLabel ? `${storeLabel} · 應付總額` : '應付店家總額'}
        value={formatCurrency(totalPayable)}
        description={
          totalCount > 0
            ? `共 ${formatNumber(totalCount)} 張 · 單價 ${formatCurrency(GROOMING_COUPON_DISCOUNT)}`
            : '此期間尚無核銷，無需結帳'
        }
        icon={CircleDollarSign}
        accent="success"
      />
      <MetricKpi
        title="核銷張數"
        value={formatNumber(totalCount)}
        description="期間內已核銷折價券"
        icon={Ticket}
        accent="primary"
      />
      <MetricKpi
        title="單張應付"
        value={formatCurrency(GROOMING_COUPON_DISCOUNT)}
        description="固定結算單價"
        icon={Receipt}
        accent="info"
      />
      <MetricKpi
        title={storeLabel ? '查詢店家' : '合作店家數'}
        value={storeLabel ? '1 家' : formatNumber(storeCount)}
        description={storeLabel ? storeLabel : '期間內有核銷紀錄的店家'}
        icon={Store}
        accent="warning"
      />
    </div>
  );
}

export function StoreRedemptionSummaryTable({
  rows,
  showStoreColumn,
}: {
  rows: StoreRedemptionReportRow[];
  showStoreColumn: boolean;
}) {
  if (!showStoreColumn) return null;

  return (
    <SectionCard
      tone="supply"
      icon={BarChart3}
      title="各店結算摘要"
      description="依店家彙總期間內核銷張數與應付金額"
      contentClassName="pt-6"
    >
      <div className="overflow-hidden rounded-2xl border border-border/70">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead>店家</TableHead>
              <TableHead>代碼</TableHead>
              <TableHead className="text-right">核銷數量</TableHead>
              <TableHead className="text-right">應付金額</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-12 text-center">
                  <EmptyState
                    title="此期間尚無核銷紀錄"
                    description="請調整日期或店家條件後再查詢"
                  />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.storeId} className="hover:bg-muted/20">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <StoreAvatar name={row.storeName} />
                      <div>
                        <p className="font-medium">{row.storeName}</p>
                        <p className="text-xs text-muted-foreground">
                          每張 {formatCurrency(GROOMING_COUPON_DISCOUNT)}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="rounded-md bg-muted px-2 py-1 text-xs">{row.storeId}</code>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(row.redeemedCount)} 張
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-success">
                    {formatCurrency(row.totalPayable)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  );
}

export function StoreRedemptionDetailTable({
  details,
  storeLabel,
}: {
  details: StoreRedemptionDetailRow[];
  storeLabel: string | null;
}) {
  return (
    <SectionCard
      tone="supply"
      icon={ListOrdered}
      title="核銷明細"
      description={
        storeLabel
          ? `${storeLabel} · 逐筆核對後即可結帳`
          : '逐筆列出優惠碼、核銷時間與應付金額'
      }
      contentClassName="pt-6"
    >
      <div className="overflow-hidden rounded-2xl border border-border/70">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead>核銷時間</TableHead>
              <TableHead>優惠碼</TableHead>
              {!storeLabel ? <TableHead>店家</TableHead> : null}
              <TableHead>核銷人員</TableHead>
              <TableHead className="text-right">應付金額</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {details.length === 0 ? (
              <TableRow>
                <TableCell colSpan={storeLabel ? 4 : 5} className="py-12 text-center">
                  <EmptyState
                    title="此期間尚無核銷明細"
                    description="核銷完成後會自動出現在此列表"
                  />
                </TableCell>
              </TableRow>
            ) : (
              details.map((detail) => (
                <TableRow key={detail.couponCode} className="hover:bg-muted/20">
                  <TableCell className="whitespace-nowrap text-sm tabular-nums">
                    {formatDateTime(detail.redeemedAt)}
                  </TableCell>
                  <TableCell>
                    <code className="rounded-md bg-muted px-2 py-1 text-xs">{detail.couponCode}</code>
                  </TableCell>
                  {!storeLabel ? <TableCell>{detail.storeName}</TableCell> : null}
                  <TableCell className="text-muted-foreground">
                    {detail.redeemedBy ?? '—'}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-success">
                    {formatCurrency(detail.discountAmount)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  );
}

export function StoreRedemptionLinkPanel({ storeSlug }: { storeSlug: string | null }) {
  const unifiedUrl = buildUnifiedStoreRedeemUrl();
  const storeUrl = storeSlug ? buildUnifiedStoreRedeemUrl(storeSlug) : null;

  return (
    <SectionCard
      tone="supply"
      icon={Link2}
      title="店家核銷入口"
      description="提供給合作店家的統一核銷網址"
      contentClassName="pt-6"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <LinkCard
          label="統一入口"
          hint="所有店家共用，店員自行選擇分店"
          url={unifiedUrl}
        />
        {storeUrl ? (
          <LinkCard
            label="目前店家專用"
            hint="開啟後自動帶入所選分店"
            url={storeUrl}
            highlighted
          />
        ) : null}
      </div>
    </SectionCard>
  );
}

function LinkCard({
  label,
  hint,
  url,
  highlighted = false,
}: {
  label: string;
  hint: string;
  url: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-4',
        highlighted
          ? 'border-primary/25 bg-primary/[0.04]'
          : 'border-border/70 bg-muted/20',
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
      <p className="break-all font-mono text-xs leading-relaxed text-foreground/90">{url}</p>
      <Button variant="outline" size="sm" className="mt-3" asChild>
        <a href={url} target="_blank" rel="noreferrer">
          開啟核銷頁
        </a>
      </Button>
    </div>
  );
}

function StoreAvatar({ name }: { name: string }) {
  const initial = name.trim().charAt(0) || '店';
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-sm font-semibold text-primary ring-1 ring-inset ring-primary/15">
      {initial}
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-auto max-w-sm space-y-1">
      <p className="font-medium text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function HeroKpi({
  title,
  value,
  description,
  icon: Icon,
  accent,
}: {
  title: string;
  value: string;
  description?: string;
  icon: typeof CircleDollarSign;
  accent: 'success' | 'primary' | 'info' | 'warning';
}) {
  const styles = {
    success: {
      bar: 'bg-success',
      icon: 'bg-success/10 text-success ring-success/20',
    },
    primary: {
      bar: 'bg-primary',
      icon: 'bg-primary/10 text-primary ring-primary/20',
    },
    info: {
      bar: 'bg-info',
      icon: 'bg-info/10 text-info ring-info/20',
    },
    warning: {
      bar: 'bg-warning',
      icon: 'bg-warning/10 text-warning ring-warning/20',
    },
  }[accent];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-muted/20 p-5 shadow-card lg:row-span-1">
      <div className={cn('absolute inset-y-0 left-0 w-1', styles.bar)} />
      <div className="flex items-start justify-between gap-4 pl-2">
        <div className="min-w-0 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {title}
          </p>
          <p className="font-mono text-3xl font-semibold tracking-tight text-navy tabular-nums">
            {value}
          </p>
          {description ? (
            <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <div
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset',
            styles.icon,
          )}
        >
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

function MetricKpi({
  title,
  value,
  description,
  icon: Icon,
  accent,
}: {
  title: string;
  value: string;
  description?: string;
  icon: typeof Ticket;
  accent: 'success' | 'primary' | 'info' | 'warning';
}) {
  const styles = {
    success: { icon: 'bg-success/10 text-success ring-success/20' },
    primary: { icon: 'bg-primary/10 text-primary ring-primary/20' },
    info: { icon: 'bg-info/10 text-info ring-info/20' },
    warning: { icon: 'bg-warning/10 text-warning ring-warning/20' },
  }[accent];

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {title}
          </p>
          <p className="text-2xl font-semibold tabular-nums text-navy">{value}</p>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset',
            styles.icon,
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
