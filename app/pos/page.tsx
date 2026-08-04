import Link from 'next/link';
import { requireMerchantSession } from '@/lib/merchant-auth';
import { prisma } from '@/lib/prisma';
import { isNextRedirect } from '@/lib/is-next-redirect';
import { posLogoutAction } from './actions';
import { PosShell } from '@/components/pos/pos-shell';
import { TodayTaskRowLink } from '@/components/pos/today-task-row';
import {
  PosEmptyToday,
  PosHomeHeader,
  PosPage,
  PosSectionLabel,
  PosWarningBanner,
} from '@/components/pos/pos-ui';
import { Button } from '@/components/ui/button';
import { loadTodayDashboard } from '@/lib/pos/load-today-dashboard';

export const metadata = {
  title: '今天 · Furmosa 店家',
};

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function PosHomeFallback({
  message,
  showRetryHint = true,
}: {
  message: string;
  showRetryHint?: boolean;
}) {
  return (
    <PosShell>
      <PosPage>
        <h1 className="font-pos text-xl font-semibold text-navy">今天暫時無法載入</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {message}
          {showRetryHint ? ' 請稍後再試，或先前往叫貨。' : null}
        </p>
        <div className="flex flex-col gap-2 pt-1">
          <Button asChild className="min-h-[48px] w-full rounded-2xl text-base font-semibold">
            <Link href="/pos/restock">前往叫貨</Link>
          </Button>
          <form action={posLogoutAction}>
            <Button
              type="submit"
              variant="outline"
              className="min-h-[48px] w-full rounded-2xl text-base font-semibold"
            >
              登出並重試
            </Button>
          </form>
        </div>
      </PosPage>
    </PosShell>
  );
}

export default async function PosHomePage() {
  try {
    const session = await requireMerchantSession();

    let merchant: { id: string; name: string; merchantId: string } | null = null;
    try {
      merchant = await prisma.merchant.findFirst({
        where: { id: session.merchantId },
        select: { id: true, name: true, merchantId: true },
      });
    } catch (err) {
      console.error('[pos] merchant lookup', err);
      return <PosHomeFallback message="資料暫時載不進來。" />;
    }

    if (!merchant || merchant.id !== session.merchantId) {
      return (
        <PosHomeFallback
          message="找不到店家資料，請重新登入。"
          showRetryHint={false}
        />
      );
    }

    const { rows, warning } = await loadTodayDashboard(session.merchantId);
    const empty = rows.length === 0 && !warning;

    return (
      <PosShell>
        <PosPage>
          <PosHomeHeader merchantName={merchant.name} logoutAction={posLogoutAction} />

          {warning ? <PosWarningBanner>{warning}</PosWarningBanner> : null}

          {empty ? (
            <PosEmptyToday />
          ) : (
            <section className="space-y-2.5">
              <PosSectionLabel>待辦</PosSectionLabel>
              <div className="grid gap-2.5">
                {rows.map((row, index) => (
                  <TodayTaskRowLink
                    key={`${row.kind}-${row.href}`}
                    row={row}
                    index={index}
                  />
                ))}
              </div>
            </section>
          )}

          {warning ? (
            <Button
              asChild
              variant="outline"
              className="min-h-[48px] w-full rounded-2xl text-base font-semibold"
            >
              <Link href="/pos/restock">前往叫貨</Link>
            </Button>
          ) : null}
        </PosPage>
      </PosShell>
    );
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    console.error('[pos] home render', err);
    return <PosHomeFallback message="伺服器渲染時發生錯誤。" />;
  }
}
