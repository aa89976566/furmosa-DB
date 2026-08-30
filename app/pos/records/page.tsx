import { QueryBoard } from '@/components/pos/query-board';
import { RecordsPageFrame } from '@/components/pos/records-page-frame';
import { loadPosAccount } from '@/lib/pos/account';
import { loadQueryFeed } from '@/lib/pos/load-query-feed';
import { requireMerchantSession } from '@/lib/merchant-auth';
import { QUERY_RECORDS_TITLE } from '@/lib/pos/query-records-view';

export const metadata = { title: `${QUERY_RECORDS_TITLE} · Furmosa 店家` };
export const dynamic = 'force-dynamic';

export default async function PosRecordsPage() {
  const session = await requireMerchantSession();
  const [account, items] = await Promise.all([
    loadPosAccount(session.merchantId, session.username),
    loadQueryFeed(session.merchantId),
  ]);

  return (
    <RecordsPageFrame account={account}>
      <QueryBoard items={items} />
    </RecordsPageFrame>
  );
}
