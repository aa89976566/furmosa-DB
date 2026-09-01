import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SectionCard } from '@/components/shared/section-card';
import { DetailNavLink } from '@/components/customers/customer-detail-ui';
import { formatDateTime, formatNumber } from '@/lib/format';
import type { CustomerDetailData } from '@/lib/customers/load-customer-detail';

export function CustomerJarOverview({ data }: { data: CustomerDetailData }) {
  if (!data.hasJar || !data.jar) return null;

  const latestLedger = data.recentPointsLedger[0];
  const base = `/customers/${data.customer.id}`;

  return (
    <SectionCard
      title="換罐會員"
      description="點數、持有罐與兌換紀錄"
      tone="supply"
      action={
        <Button size="sm" variant="outline" asChild>
          <Link href={`${base}/jar-exchange/actions`}>換罐操作</Link>
        </Button>
      }
    >
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border py-5">
        <div>
          <p className="text-xs font-medium text-muted-foreground">可用點數</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-navy">
            {formatNumber(data.pointsBalance)}
            <span className="ml-1 text-sm font-normal text-muted-foreground">點</span>
          </p>
        </div>
        <Badge variant={data.jar.stats.jarServiceStatus === 'active' ? 'success' : 'muted'}>
          {data.jar.stats.jarServiceStatus === 'active' ? '服務中' : '未啟用'}
        </Badge>
      </div>
      <div className="grid gap-2 py-5 sm:grid-cols-3">
        <DetailNavLink href={`${base}/jar-ledger`} label="點數帳本" count={data.jar.ledgerCount} />
        <DetailNavLink href={`${base}/jar-rewards`} label="兌換獎勵" count={data.jar.redemptionCount} />
        <DetailNavLink href={`${base}/jar-codes`} label="返航序號" count={data.jar.jarCodesCount} />
      </div>
      <p className="border-t border-border pt-4 text-xs text-muted-foreground">
        {latestLedger
          ? `最近點數異動：${latestLedger.pointsChange > 0 ? '+' : ''}${latestLedger.pointsChange} 點 · ${formatDateTime(latestLedger.createdAt)}`
          : '尚無點數異動紀錄'}
      </p>
    </SectionCard>
  );
}
