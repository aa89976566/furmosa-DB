import Link from 'next/link';
import { requireMerchantSession } from '@/lib/merchant-auth';
import { prisma } from '@/lib/prisma';
import { isNextRedirect } from '@/lib/is-next-redirect';
import { PosShell } from '@/components/pos/pos-shell';
import { HomeTaskCardLink } from '@/components/pos/home-task-card';
import { loadHomeTasks } from '@/lib/pos/load-today-dashboard';
import { loadPosAccount } from '@/lib/pos/account';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { InventoryBottomNav, InventorySideNav } from '@/components/pos/inventory-nav';
import { RestockCartProvider } from '@/components/pos/restock-cart-provider';
import { PosAccountMenu } from '@/components/pos/account-menu';

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
    return (
      <RestockCartProvider>
        <div className="min-h-screen bg-neutral-100 text-zinc-900 md:h-screen md:overflow-hidden">
          <div className="md:flex md:h-full">
            <InventorySideNav account={account} />

            <main className="min-w-0 flex-1 md:h-full md:overflow-y-auto">
              <header className="flex items-center justify-between px-4 pb-3 pt-5 md:px-6">
                <div>
                  <h1 className="text-2xl font-semibold">首頁</h1>
                  <p className="mt-1 text-sm text-zinc-500">今天需要處理的工作</p>
                </div>
                <div className="md:hidden">
                  <PosAccountMenu account={account} />
                </div>
              </header>

              <div className="mx-auto w-full max-w-5xl px-4 pb-28 pt-2 md:mx-0 md:px-6 md:pb-8">
                {tasks.warning ? (
                  <Card className="mb-3 border-amber-200 bg-amber-50 shadow-sm">
                    <CardContent className="p-4 text-sm text-amber-950">{tasks.warning}</CardContent>
                  </Card>
                ) : null}

                {tasks.cards.length === 0 && !tasks.warning ? (
                  <Card className="border-neutral-200 bg-white shadow-sm">
                    <CardContent className="space-y-2 p-5">
                      <p className="font-medium text-zinc-900">目前沒有要處理的事。</p>
                      <p className="text-sm text-zinc-500">需要時使用庫存、換罐、查詢或結帳即可。</p>
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
            </main>
          </div>
          <InventoryBottomNav />
        </div>
      </RestockCartProvider>
    );
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    console.error('[pos] home render', err);
    return <HomeFallback message="伺服器渲染時發生錯誤。" />;
  }
}
