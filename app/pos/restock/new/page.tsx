import Link from 'next/link';
import { Suspense } from 'react';
import { requireMerchantSession } from '@/lib/merchant-auth';
import { NewRestockForm } from './new-restock-form';
import { listJarExchangeProductsForRestock } from '@/lib/restock-request/service';
import { getAuthenticatedMerchantId } from '@/lib/merchant-auth';
import { prisma } from '@/lib/prisma';
import { PosShell } from '@/components/pos/pos-shell';

export const metadata = { title: '建立補貨單 · Furmosa 店家' };

export default async function PosRestockNewPage() {
  await requireMerchantSession();
  const merchantId = await getAuthenticatedMerchantId();

  const products = await listJarExchangeProductsForRestock();
  const stocks = await prisma.merchantStock.findMany({
    where: {
      merchantId,
      productId: { in: products.map((p) => p.id) },
    },
    select: { productId: true, quantity: true },
  });
  const stockByProduct = new Map<string, number>();
  for (const s of stocks) {
    stockByProduct.set(
      s.productId,
      (stockByProduct.get(s.productId) ?? 0) + s.quantity,
    );
  }

  return (
    <PosShell>
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <Link href="/pos/restock" className="text-sm text-muted-foreground">
          ← 補貨
        </Link>
        <header className="mb-5 border-b border-[#e7e5e4] pb-5">
          <h1 className="mt-2 text-2xl font-semibold">建立補貨單</h1>
          <p className="mt-1 text-sm text-muted-foreground">選擇補貨方式與數量。送出後可在「追蹤補貨單」確認進度。</p>
        </header>
        <Suspense fallback={<p className="text-sm text-muted-foreground">載入中…</p>}>
          <NewRestockForm
            products={products.map((p) => ({
              id: p.id,
              name: p.name,
              unit: p.unit,
              stockQty: stockByProduct.has(p.id)
                ? stockByProduct.get(p.id)!
                : null,
            }))}
          />
        </Suspense>
      </div>
    </PosShell>
  );
}
