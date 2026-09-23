import { requireMerchantSession } from '@/lib/merchant-auth';
import { isNextRedirect } from '@/lib/is-next-redirect';
import { posLogoutAction } from '../actions';
import { PosShell } from '@/components/pos/pos-shell';
import { CounterApp } from '@/components/pos/counter-app';
import { loadCounterCatalog } from '@/lib/pos/counter-catalog';
import { loadPosAccount } from '@/lib/pos/account';
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
          {showRetryHint ? ' 請稍後再試，或先去看庫存。' : null}
        </p>
        <div className="flex flex-col gap-2">
          <Button asChild className="min-h-[48px] w-full">
            <Link href="/pos/stock">看庫存</Link>
          </Button>
          <form action={posLogoutAction}>
            <Button type="submit" variant="outline" className="min-h-[48px] w-full">
              登出並重試
            </Button>
          </form>
        </div>
      </div>
    </PosShell>
  );
}

export default async function PosSellPage() {
  try {
    const session = await requireMerchantSession();
    const [catalog, account] = await Promise.all([
      loadCounterCatalog(session.merchantId),
      loadPosAccount(session.merchantId, session.username),
    ]);
    if (!catalog) {
      return <CounterFallback message="找不到店家商品。" />;
    }

    return (
      <PosShell storeName={catalog.merchantName} account={account} wide showShipmentAlert>
        <CounterApp
          storeName={catalog.merchantName}
          items={catalog.items}
          categories={catalog.categories}
        />
      </PosShell>
    );
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    console.error('[pos] sell render', err);
    return <CounterFallback message="伺服器渲染時發生錯誤。" />;
  }
}
