import { requireMerchantSession } from '@/lib/merchant-auth';
import { prisma } from '@/lib/prisma';
import { PosShell } from '@/components/pos/pos-shell';
import { StockList } from '@/components/pos/stock-list';
import { loadPosAccount } from '@/lib/pos/account';

export const metadata = { title: '庫存 · Furmosa 店家' };
export const dynamic = 'force-dynamic';

export default async function PosStockPage({
  searchParams,
}: {
  searchParams?: { filter?: string };
}) {
  const session = await requireMerchantSession();
  const [account, stocks] = await Promise.all([
    loadPosAccount(session.merchantId, session.username),
    prisma.merchantStock.findMany({
      where: { merchantId: session.merchantId },
      select: {
        productId: true,
        quantity: true,
        product: { select: { name: true, status: true } },
      },
      take: 500,
    }),
  ]);

  const byProduct = new Map<string, { productId: string; name: string; quantity: number }>();
  for (const row of stocks) {
    if (!row.product || row.product.status !== 'active') continue;
    const current = byProduct.get(row.productId);
    if (current) {
      current.quantity += row.quantity;
    } else {
      byProduct.set(row.productId, {
        productId: row.productId,
        name: row.product.name,
        quantity: row.quantity,
      });
    }
  }
  const items = [...byProduct.values()].sort((a, b) => a.quantity - b.quantity || a.name.localeCompare(b.name, 'zh-Hant'));

  return (
    <PosShell storeName={account.storeName} account={account}>
      <div className="px-4 py-6 pr-16">
        <h1 className="mb-4 text-xl font-semibold text-navy">庫存</h1>
        <StockList items={items} initialFilter={searchParams?.filter === 'low' ? 'low' : 'all'} />
      </div>
    </PosShell>
  );
}
