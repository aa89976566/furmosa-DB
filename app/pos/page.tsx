import { requireMerchantSession } from '@/lib/merchant-auth';
import { prisma } from '@/lib/prisma';
import { isNextRedirect } from '@/lib/is-next-redirect';
import { posLogoutAction } from './actions';
import { PosShell } from '@/components/pos/pos-shell';
import { CounterApp } from '@/components/pos/counter-app';
import { loadCounterCatalog } from '@/lib/pos/counter-catalog';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const metadata = {
  title: '收銀 · Furmosa 店家',
};

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function CounterFallback({
  message,
  showRetryHint = true,
}: {
  message: string;
  showRetryHint?: boolean;
}) {
  return (
    <PosShell wide>
      <div className="space-y-4 px-4 py-10">
        <h1 className="text-lg font-semibold text-navy">收銀暫時無法載入</h1>
        <p className="text-sm text-muted-foreground">
          {message}
          {showRetryHint ? ' 請稍後再試，或先前往叫貨。' : null}
        </p>
        <div className="flex flex-col gap-2">
          <Button asChild className="min-h-[44px] w-full">
            <Link href="/pos/restock">前往叫貨</Link>
          </Button>
          <form action={posLogoutAction}>
            <Button type="submit" variant="outline" className="min-h-[44px] w-full">
              登出並重試
            </Button>
          </form>
        </div>
      </div>
    </PosShell>
  );
}

export default async function PosCounterPage() {
  try {
    const session = await requireMerchantSession();
    let merchant: { id: string; name: string } | null = null;
    try {
      merchant = await prisma.merchant.findFirst({
        where: { id: session.merchantId },
        select: { id: true, name: true },
      });
    } catch (err) {
      console.error('[pos] counter merchant lookup', err);
      return <CounterFallback message="資料暫時載不進來。" />;
    }

    if (!merchant || merchant.id !== session.merchantId) {
      return (
        <CounterFallback message="找不到店家資料，請重新登入。" showRetryHint={false} />
      );
    }

    const catalog = await loadCounterCatalog(session.merchantId);
    if (!catalog) {
      return <CounterFallback message="找不到店家商品。" />;
    }

    return (
      <PosShell storeName={merchant.name} wide>
        <CounterApp
          storeName={catalog.merchantName}
          items={catalog.items}
          categories={catalog.categories}
        />
      </PosShell>
    );
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    console.error('[pos] counter render', err);
    return <CounterFallback message="伺服器渲染時發生錯誤。" />;
  }
}
