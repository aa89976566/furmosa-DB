import { posSearchQuery } from '@/lib/pos/search-query';
import { requireMerchantSession } from '@/lib/merchant-auth';
import { PosShell } from '@/components/pos/pos-shell';
import { QueryBoard } from '@/components/pos/query-board';
import { loadPosAccount } from '@/lib/pos/account';
import { loadQueryFeed } from '@/lib/pos/load-query-feed';

export const metadata = { title: '紀錄 · Furmosa 店家' };
export const dynamic = 'force-dynamic';

export default async function PosRecordsPage(props: { searchParams?: Promise<{ q?: string | string[] }> }) {
  const searchParams = await props.searchParams;
  const session = await requireMerchantSession();
  const query = posSearchQuery(searchParams?.q);
  const [account, items] = await Promise.all([
    loadPosAccount(session.merchantId, session.username),
    loadQueryFeed(session.merchantId),
  ]);

  return (
    <PosShell storeName={account.storeName} account={account}>
      <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6">
        <QueryBoard key={query} items={items} initialQuery={query} />
      </div>
    </PosShell>
  );
}
