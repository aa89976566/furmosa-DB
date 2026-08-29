import { requireMerchantSession } from '@/lib/merchant-auth';
import { QueryBoard } from '@/components/pos/query-board';
import { InventoryBottomNav, InventorySideNav } from '@/components/pos/inventory-nav';
import { RestockCartProvider } from '@/components/pos/restock-cart-provider';
import { PosPageHeader } from '@/components/pos/pos-page-header';
import { loadPosAccount } from '@/lib/pos/account';
import { loadQueryFeed } from '@/lib/pos/load-query-feed';

export const metadata = { title: '查詢 · Furmosa 店家' };
export const dynamic = 'force-dynamic';

export default async function PosRecordsPage() {
  const session = await requireMerchantSession();
  const [account, items] = await Promise.all([
    loadPosAccount(session.merchantId, session.username),
    loadQueryFeed(session.merchantId),
  ]);

  return (
    <RestockCartProvider>
      <div className="min-h-screen bg-neutral-100 text-zinc-900 md:flex md:h-screen md:overflow-hidden">
        <InventorySideNav account={account} />
        <main className="min-w-0 flex-1 md:flex md:h-full md:flex-col md:overflow-hidden">
          <PosPageHeader
            title="查詢"
            description="查找換罐、補貨和庫存異動。"
            account={account}
          />
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-28 md:px-6 md:pb-8">
            <QueryBoard items={items} />
          </div>
        </main>
        <InventoryBottomNav />
      </div>
    </RestockCartProvider>
  );
}
