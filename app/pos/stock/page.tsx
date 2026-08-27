import { requireMerchantSession } from '@/lib/merchant-auth';
import { loadPosAccount } from '@/lib/pos/account';
import { loadMerchantInventory } from '@/lib/pos/load-inventory';
import { InventoryWorkspace } from '@/components/pos/inventory-workspace';

export const metadata = { title: '庫存 · Furmosa 店家' };
export const dynamic = 'force-dynamic';

export default async function PosStockPage({
  searchParams,
}: {
  searchParams?: { filter?: string };
}) {
  const session = await requireMerchantSession();
  const [account, items] = await Promise.all([
    loadPosAccount(session.merchantId, session.username),
    loadMerchantInventory(session.merchantId),
  ]);

  return (
    <InventoryWorkspace
      account={account}
      initialItems={items}
      initialLowStock={searchParams?.filter === 'low'}
    />
  );
}
