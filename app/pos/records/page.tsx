import { requireMerchantSession } from '@/lib/merchant-auth';
import { PosShell } from '@/components/pos/pos-shell';
import { QueryBoard } from '@/components/pos/query-board';
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
    <PosShell storeName={account.storeName} account={account}>
      <div className="px-4 py-6 pr-16">
        <h1 className="mb-4 text-xl font-semibold text-navy">查詢</h1>
        <QueryBoard items={items} />
      </div>
    </PosShell>
  );
}
