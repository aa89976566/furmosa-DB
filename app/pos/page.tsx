import { requireMerchantSession } from '@/lib/merchant-auth';
import { prisma } from '@/lib/prisma';
import { isNextRedirect } from '@/lib/is-next-redirect';
import { PosShell } from '@/components/pos/pos-shell';
import { HomeTaskCardLink } from '@/components/pos/home-task-card';
import { HomeActionCard } from '@/components/pos/home-action-card';
import { loadHomeTasks } from '@/lib/pos/load-today-dashboard';
import { loadPosAccount } from '@/lib/pos/account';
import { storeHeading } from '@/lib/pos/store-display';
import { POS_HOME_ACTIONS } from '@/lib/pos/pos-nav';

export const metadata = {
  title: '首頁 · Furmosa 店家',
};

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function HomeFallback({ message }: { message: string }) {
  return (
    <PosShell>
      <div className="space-y-4 px-4 py-8">
        <h1 className="text-2xl font-semibold text-zinc-900">首頁暫時無法載入</h1>
        <p className="text-base text-zinc-600">{message}</p>
        <div className="grid gap-3">
          {POS_HOME_ACTIONS.map((action) => (
            <HomeActionCard key={action.navId} action={action} />
          ))}
        </div>
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
      return <HomeFallback message="資料暫時載不進來，請稍後再試。" />;
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
        <div className="px-4 py-6 md:px-6">
          <header className="mb-6">
            <p className="text-sm font-medium text-zinc-500">首頁</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
              {heading.combined}
            </h1>
            {heading.branchLine ? (
              <p className="mt-1 text-base text-zinc-500">{heading.brandLine}</p>
            ) : null}
            <p className="mt-2 text-lg text-zinc-600">今天要處理什麼？</p>
          </header>

          {tasks.warning ? (
            <div
              role="status"
              className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-base text-zinc-900"
            >
              <p className="font-medium">部分資料暫時讀不到</p>
              <p className="mt-1 text-zinc-700">{tasks.warning}</p>
            </div>
          ) : null}

          {tasks.cards.length > 0 ? (
            <section className="mb-8" aria-labelledby="home-notices">
              <h2 id="home-notices" className="mb-3 text-base font-semibold text-zinc-900">
                需要注意
              </h2>
              <div className="grid gap-3">
                {tasks.cards.map((card) => (
                  <HomeTaskCardLink key={`${card.kind}-${card.href}`} card={card} />
                ))}
              </div>
            </section>
          ) : null}

          <section aria-labelledby="home-actions">
            <h2 id="home-actions" className="mb-3 text-base font-semibold text-zinc-900">
              開始工作
            </h2>
            <div className="grid gap-3">
              {POS_HOME_ACTIONS.map((action) => (
                <HomeActionCard key={action.navId} action={action} />
              ))}
            </div>
          </section>
        </div>
      </PosShell>
    );
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    console.error('[pos] home render', err);
    return <HomeFallback message="頁面暫時無法顯示，請稍後再試。" />;
  }
}
