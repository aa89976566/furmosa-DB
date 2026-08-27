import Link from 'next/link';
import { requireMerchantSession } from '@/lib/merchant-auth';
import { prisma } from '@/lib/prisma';
import { isNextRedirect } from '@/lib/is-next-redirect';
import { PosShell } from '@/components/pos/pos-shell';
import { HomeTaskCardLink } from '@/components/pos/home-task-card';
import { loadHomeTasks } from '@/lib/pos/load-today-dashboard';
import { loadPosAccount } from '@/lib/pos/account';
import { storeHeading } from '@/lib/pos/store-display';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const metadata = {
  title: '店家 · Furmosa',
};

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function HomeFallback({ message }: { message: string }) {
  return (
    <PosShell>
      <div className="space-y-4 px-4 py-10">
        <h1 className="text-lg font-semibold text-navy">首頁暫時無法載入</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button asChild className="min-h-[48px] w-full">
          <Link href="/pos/settle">去結帳</Link>
        </Button>
      </div>
    </PosShell>
  );
}

export default async function PosHomePage() {
  try {
    const session = await requireMerchantSession();
    let merchant: { id: string; name: string; city: string | null } | null = null;
    try {
      merchant = await prisma.merchant.findFirst({
        where: { id: session.merchantId },
        select: { id: true, name: true, city: true },
      });
    } catch (err) {
      console.error('[pos] home merchant lookup', err);
      return <HomeFallback message="資料暫時載不進來。" />;
    }

    if (!merchant || merchant.id !== session.merchantId) {
      return <HomeFallback message="找不到店家資料，請重新登入。" />;
    }

    const [account, tasks] = await Promise.all([
      loadPosAccount(session.merchantId, session.username),
      loadHomeTasks(session.merchantId),
    ]);
    const heading = storeHeading({ name: merchant.name, city: merchant.city });

    return (
      <PosShell storeName={merchant.name} account={account}>
        <div className="px-4 py-6 pr-16">
          <header className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-navy">{heading.brandLine}</h1>
            {heading.branchLine ? (
              <p className="mt-1 text-base text-muted-foreground">{heading.branchLine}</p>
            ) : null}
          </header>

          {tasks.warning ? (
            <Card className="mb-3 border-amber-200 bg-amber-50">
              <CardContent className="p-4 text-sm text-amber-950">{tasks.warning}</CardContent>
            </Card>
          ) : null}

          {tasks.cards.length === 0 && !tasks.warning ? (
            <Card className="shadow-card">
              <CardContent className="space-y-2 p-5">
                <p className="font-medium text-foreground">目前沒有要處理的事。</p>
                <p className="text-sm text-muted-foreground">需要時用下面的庫存、換罐、查詢或結帳就好。</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {tasks.cards.map((card) => (
                <HomeTaskCardLink key={`${card.kind}-${card.href}`} card={card} />
              ))}
            </div>
          )}
        </div>
      </PosShell>
    );
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    console.error('[pos] home render', err);
    return <HomeFallback message="伺服器渲染時發生錯誤。" />;
  }
}
