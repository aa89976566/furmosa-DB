'use client';

import Link from 'next/link';
import { Gift, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/format';
import { JarExchangeAdminTools } from '@/components/customers/jar-exchange-admin-tools';
import { JarMemberRedeemMenu, type RedeemRewardOption } from '@/components/jar-exchange/jar-member-redeem-menu';
import { DetailNavLink } from '@/components/customers/customer-detail-ui';

type Redemption = {
  redemptionCode: string;
  rewardName: string;
  pointsSpent: number;
  couponCode: string | null;
  couponFaceValue: number;
  issuedAt: Date;
  couponStatus: string;
};

export function CustomerJarExchangePanel({
  customerId,
  customerName,
  pointsBalance,
  codesRedeemed,
  rewardsRedeemed,
  jarServiceStatus,
  lastActivityAt,
  ledgerCount,
  redemptionCount,
  jarCodesCount,
  redemptions,
  rewardOptions,
}: {
  customerId: string;
  customerName: string;
  pointsBalance: number;
  codesRedeemed: number;
  rewardsRedeemed: number;
  jarServiceStatus: string | null;
  lastActivityAt: Date | null;
  ledgerCount: number;
  redemptionCount: number;
  jarCodesCount: number;
  redemptions: Redemption[];
  rewardOptions: RedeemRewardOption[];
}) {
  const base = `/customers/${customerId}`;
  const latest = redemptions[0];
  const isActive = jarServiceStatus === 'active';

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Sparkles className="h-7 w-7" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              換罐會員
            </p>
            <p className="mt-0.5 text-3xl font-bold tabular-nums tracking-tight text-navy">
              {formatNumber(pointsBalance)}
              <span className="ml-1 text-base font-medium text-muted-foreground">點</span>
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant={isActive ? 'success' : 'muted'}>
                {isActive ? '進行中' : '未開通'}
              </Badge>
              <span>已兌序號 {codesRedeemed}</span>
              <span>·</span>
              <span>已兌禮品 {rewardsRedeemed}</span>
              {lastActivityAt ? (
                <>
                  <span>·</span>
                  <span>最近 {formatDateTime(lastActivityAt)}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <JarMemberRedeemMenu
            customerId={customerId}
            customerName={customerName}
            pointsBalance={pointsBalance}
            rewards={rewardOptions}
          />
          <Button variant="outline" size="sm" asChild>
            <Link href="/jar-exchange/manage?tab=codes">序號管理</Link>
          </Button>
        </div>
      </div>

      {latest ? (
        <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-primary">
            <Gift className="h-3.5 w-3.5" />
            最近兌換禮品
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lg font-semibold text-foreground">{latest.rewardName}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                券面額 {formatCurrency(latest.couponFaceValue)} · 扣除 {latest.pointsSpent} 點 ·{' '}
                {formatDateTime(latest.issuedAt)}
              </p>
            </div>
            {latest.couponCode ? (
              <code className="shrink-0 rounded-xl border border-primary/25 bg-card px-4 py-2 font-mono text-sm font-semibold tracking-wide text-navy shadow-sm">
                {latest.couponCode}
              </code>
            ) : null}
          </div>
          {redemptionCount > 1 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              <Link href={`${base}/jar-rewards`} className="text-primary hover:underline">
                另有 {redemptionCount - 1} 筆歷史紀錄
              </Link>
            </p>
          ) : null}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border/60 bg-muted/10 px-4 py-5 text-center text-sm text-muted-foreground">
          尚無兌換禮品紀錄
        </p>
      )}

      <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 px-3 py-3">
        <JarExchangeAdminTools customerId={customerId} />
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <DetailNavLink href={`${base}/jar-ledger`} label="點數帳本" count={ledgerCount} />
        <DetailNavLink href={`${base}/jar-rewards`} label="兌換獎勵歷史" count={redemptionCount} />
        <DetailNavLink href={`${base}/jar-codes`} label="返航序號" count={jarCodesCount} />
      </div>
    </div>
  );
}
