import { posSearchQuery } from '@/lib/pos/search-query';
import { requireMerchantSession } from '@/lib/merchant-auth';
import { PosShell } from '@/components/pos/pos-shell';
import { QueryBoard } from '@/components/pos/query-board';
import { loadPosAccount } from '@/lib/pos/account';
import { loadQueryFeed } from '@/lib/pos/load-query-feed';

export const metadata = { title: '紀錄 · Furmosa 店家' };
export const dynamic = 'force-dynamic';

export default async function PosRecordsPage({ searchParams }: { searchParams?: { q?: string | string[] } }) {
  const session = await requireMerchantSession();
  const query = posSearchQuery(searchParams?.q);
  const [account, items] = await Promise.all([
    loadPosAccount(session.merchantId, session.username),
    loadQueryFeed(session.merchantId),
  ]);

  return (
    <PosShell storeName={account.storeName} account={account}>
      <div className="px-4 py-6">
        <h1 className="mb-4 text-xl font-semibold text-navy">紀錄</h1>
        <QueryBoard key={query} items={items} initialQuery={query} />
      </div>
    </PosShell>
  );
}
