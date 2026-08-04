import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { JarPanel } from '@/components/jar-exchange/jar-shell';
import {
  JarMemberRedeemMenu,
  type RedeemRewardOption,
} from '@/components/jar-exchange/jar-member-redeem-menu';
import { formatDateTime, formatNumber } from '@/lib/format';
import { formatGroomingCouponDiscountForStore } from '@/lib/coupons/constants';
import { customerServiceTypeLabel } from '@/lib/jar-exchange/labels';
import { resolveSignupStoreLabel } from '@/lib/line/line-copy';

export type JarMemberRow = {
  id: string;
  name: string;
  customerId: string;
  phone: string | null;
  signupStore: string | null;
  storeId: string | null;
  storeName: string | null;
  points: number;
  services: { id: string; serviceType: string }[];
  pointsLedger: { createdAt: Date }[];
  _count: {
    jarCodesRedeemed: number;
    rewardRedemptions: number;
  };
};

function storeLabel(c: JarMemberRow) {
  if (!c.signupStore && !c.storeId) return null;
  return resolveSignupStoreLabel(c.signupStore ?? c.storeId) ?? null;
}

function couponLabel(c: JarMemberRow) {
  if (!c.signupStore && !c.storeId) return null;
  return formatGroomingCouponDiscountForStore(
    c.storeId ?? c.signupStore ?? '',
    c.storeName ?? resolveSignupStoreLabel(c.signupStore ?? c.storeId),
  );
}

function ServiceBadges({ services }: { services: JarMemberRow['services'] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {services.map((s) => (
        <Badge key={s.id} variant="secondary" className="text-[10px]">
          {customerServiceTypeLabel[s.serviceType] ?? s.serviceType}
        </Badge>
      ))}
    </div>
  );
}

function MemberActions({
  member,
  rewards,
}: {
  member: JarMemberRow;
  rewards: RedeemRewardOption[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <JarMemberRedeemMenu
        customerId={member.id}
        customerName={member.name}
        pointsBalance={member.points}
        rewards={rewards}
      />
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/customers/${member.id}`}>詳情</Link>
      </Button>
    </div>
  );
}

function MemberCard({
  member,
  rewards,
}: {
  member: JarMemberRow;
  rewards: RedeemRewardOption[];
}) {
  const store = storeLabel(member);
  const coupon = couponLabel(member);
  const lastAt = member.pointsLedger[0]
    ? formatDateTime(member.pointsLedger[0].createdAt)
    : null;

  return (
    <article className="space-y-3 border-b border-border/70 px-4 py-4 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-medium text-ink">{member.name}</h3>
          <p className="font-mono text-xs text-muted-foreground">{member.customerId}</p>
        </div>
        <p className="shrink-0 text-right">
          <span className="block text-[11px] text-muted-foreground">點數</span>
          <span className="text-lg font-semibold tabular-nums text-ink">
            {formatNumber(member.points)}
          </span>
        </p>
      </div>

      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[11px] text-muted-foreground">聯絡</dt>
          <dd className="break-all text-foreground">{member.phone ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted-foreground">開戶店家</dt>
          <dd className="break-words text-foreground">{store ?? '—'}</dd>
          {coupon ? (
            <dd className="mt-0.5 text-xs tabular-nums text-muted-foreground">{coupon}</dd>
          ) : null}
        </div>
        <div>
          <dt className="text-[11px] text-muted-foreground">服務類型</dt>
          <dd className="mt-1">
            <ServiceBadges services={member.services} />
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted-foreground">兌換紀錄</dt>
          <dd className="tabular-nums text-foreground">
            序號 {member._count.jarCodesRedeemed} · 獎勵 {member._count.rewardRedemptions}
          </dd>
          {lastAt ? (
            <dd className="mt-0.5 text-xs text-muted-foreground">最近 {lastAt}</dd>
          ) : null}
        </div>
      </dl>

      <div className="flex justify-end border-t border-border/50 pt-3">
        <MemberActions member={member} rewards={rewards} />
      </div>
    </article>
  );
}

export function JarMembersList({
  rows,
  rewards,
}: {
  rows: JarMemberRow[];
  rewards: RedeemRewardOption[];
}) {
  if (rows.length === 0) {
    return (
      <JarPanel>
        <p className="px-4 py-12 text-center text-sm text-muted-foreground">
          尚無換罐會員，請使用上方「新增換罐會員」加入
        </p>
      </JarPanel>
    );
  }

  return (
    <JarPanel>
      {/* 窄螢幕：卡片，避免欄位被擠成直排字 */}
      <div className="lg:hidden">
        {rows.map((member) => (
          <MemberCard key={member.id} member={member} rewards={rewards} />
        ))}
      </div>

      {/* 寬螢幕：表格，店家欄給最小寬度並允許換行 */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="whitespace-nowrap px-4 py-3 font-medium">會員</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">聯絡</th>
              <th className="min-w-[11rem] px-4 py-3 font-medium">開戶店家 · 折價券</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">服務類型</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-medium">點數</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-medium">已兌序號</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-medium">已兌獎勵</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">最近活動</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((c) => {
              const store = storeLabel(c);
              const coupon = couponLabel(c);
              return (
                <tr key={c.id} className="align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium">{c.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{c.customerId}</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {c.phone ?? '—'}
                  </td>
                  <td className="min-w-[11rem] max-w-[16rem] px-4 py-3 text-muted-foreground">
                    {store ? (
                      <div className="space-y-0.5">
                        <div className="break-words leading-snug">{store}</div>
                        {coupon ? (
                          <div className="text-xs tabular-nums">{coupon}</div>
                        ) : null}
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ServiceBadges services={c.services} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums">
                    {formatNumber(c.points)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                    {c._count.jarCodesRedeemed}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                    {c._count.rewardRedemptions}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                    {c.pointsLedger[0]
                      ? formatDateTime(c.pointsLedger[0].createdAt)
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <MemberActions member={c} rewards={rewards} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </JarPanel>
  );
}
