import { requireMerchantSession } from '@/lib/merchant-auth';
import { loadPosAccount } from '@/lib/pos/account';
import { loadStoreLedgerPageData } from '@/lib/pos/load-store-ledger';
import { defaultTaipeiMonthToTodayInputs, parseTaipeiDateRange } from '@/lib/taipei-date';
import { SettleWorkspaceV2 } from '@/components/pos/settle-workspace-v2';

export const metadata = { title: '結帳 · Furmosa 店家' };
export const dynamic = 'force-dynamic';

type SearchParams = {
  from?: string;
  to?: string;
};

export default async function PosSettlePage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const session = await requireMerchantSession();
  const fallback = defaultTaipeiMonthToTodayInputs();
  const from = searchParams?.from || fallback.from;
  const to = searchParams?.to || fallback.to;
  const range = parseTaipeiDateRange(from, to) ?? parseTaipeiDateRange(fallback.from, fallback.to)!;

  const [account, ledger] = await Promise.all([
    loadPosAccount(session.merchantId, session.username),
    loadStoreLedgerPageData({
      merchantId: session.merchantId,
      periodStart: range.start,
      periodEnd: range.end,
    }),
  ]);

  return <SettleWorkspaceV2 account={account} ledger={ledger} />;
}
