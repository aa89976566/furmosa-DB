import { requireMerchantSession } from '@/lib/merchant-auth';
import { loadPosAccount } from '@/lib/pos/account';
import { prisma } from '@/lib/prisma';
import { PosShell } from '@/components/pos/pos-shell';
import { formatCurrency } from '@/lib/format';

export const metadata = { title: '活動／團購 · Furmosa 店家' };
export const dynamic = 'force-dynamic';

export default async function PosGroupBuyPage({ searchParams }: { searchParams?: { q?: string } }) {
  const session = await requireMerchantSession();
  const query = searchParams?.q?.trim() ?? '';
  const [account, prices] = await Promise.all([
    loadPosAccount(session.merchantId, session.username),
    prisma.merchantWholesalePrice.findMany({
      where: { merchantId: session.merchantId, product: { status: 'active' } },
      select: { id: true, variantKey: true, unitPrice: true, product: { select: { name: true, sku: true, priceTiers: { select: { id: true, weightGrams: true, unit: true, unitQty: true } } } } },
      orderBy: [{ productId: 'asc' }, { variantKey: 'asc' }],
    }),
  ]);
  const visible = prices.filter(({ product }) => `${product.name} ${product.sku}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <PosShell account={account}>
    <main className="space-y-5 px-4 py-6 md:px-6">
      <header><h1 className="text-2xl font-semibold">活動／團購</h1><p className="mt-2 text-sm text-muted-foreground">店家專屬進貨價。活動期間、數量與訂單請向 HQ 確認。</p></header>
      <form role="search" className="flex gap-2">
        <input name="q" type="search" defaultValue={query} aria-label="搜尋團購商品" placeholder="搜尋商品或 SKU" className="h-11 min-w-0 flex-1 rounded-xl border px-3" />
        <button className="min-h-11 rounded-xl bg-zinc-900 px-4 text-white">搜尋</button>
      </form>
      {prices.length === 0 ? <p className="rounded-2xl border bg-white p-5">尚未設定專屬進貨價，請聯繫 HQ 確認活動方案。</p> : visible.length === 0 ? <p>沒有符合的商品。</p> : <ul className="divide-y rounded-2xl border bg-white">
        {visible.map((price) => {
          const tier = price.product.priceTiers.find((item) => item.id === price.variantKey);
          return <li key={price.id} className="flex items-start justify-between gap-3 p-4">
            <div><h2 className="font-medium">{price.product.name}</h2><p className="mt-1 text-sm text-muted-foreground">{price.product.sku} · {price.variantKey === 'base' ? '基本規格' : tier ? tier.weightGrams != null ? `${tier.weightGrams}g` : `${tier.unitQty}${tier.unit}` : '規格待 HQ 確認'}</p></div>
            <span className="shrink-0 font-semibold">{formatCurrency(price.unitPrice)}</span>
          </li>;
        })}
      </ul>}
    </main>
  </PosShell>;
}
