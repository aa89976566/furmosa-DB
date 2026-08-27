import { requireMerchantSession } from '@/lib/merchant-auth';
import { PosShell } from '@/components/pos/pos-shell';
import { RestockPicker } from '@/components/pos/restock-picker';
import { listMerchantRestockCatalog } from '@/lib/restock-request/service';
import { loadPosAccount } from '@/lib/pos/account';

export const metadata = { title: '補貨 · Furmosa 店家' };
export const dynamic = 'force-dynamic';

export default async function PosRestockPage() {
  const session = await requireMerchantSession();
  const [account, products] = await Promise.all([
    loadPosAccount(session.merchantId, session.username),
    listMerchantRestockCatalog(session.merchantId),
  ]);

  return (
    <PosShell storeName={account.storeName} account={account}>
      <div className="px-4 py-6 pr-16">
        <h1 className="mb-1 text-xl font-semibold text-navy">補貨</h1>
        <p className="mb-5 text-sm text-muted-foreground">選要補的數量，再送出給匠寵。</p>
        <RestockPicker products={products} />
      </div>
    </PosShell>
  );
}
