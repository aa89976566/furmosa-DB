import Link from 'next/link';
import { Suspense } from 'react';
import { requireMerchantSession } from '@/lib/merchant-auth';
import { NewRestockForm } from './new-restock-form';
import { listJarExchangeProductsForRestock } from '@/lib/restock-request/service';
import { getAuthenticatedMerchantId } from '@/lib/merchant-auth';
import { ensureRefillPlanSeeded } from '@/lib/jar-exchange/refill-flavours';
import { prisma } from '@/lib/prisma';
import { PosShell } from '@/components/pos/pos-shell';

export const metadata = { title: '新增叫貨 · Furmosa 店家' };

export default async function PosRestockNewPage() {
  await requireMerchantSession();
  const merchantId = await getAuthenticatedMerchantId();

  // 確保 LINE 口味已對齊成 JAR_EXCHANGE 商品主檔，POS「自己選」才有品項
  await ensureRefillPlanSeeded();

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
      <div className="px-4 py-6">
        <Link href="/pos/restock" className="text-xs text-muted-foreground">
          ← 叫貨
        </Link>
        <h1 className="mb-4 text-xl font-semibold text-navy">新增叫貨</h1>
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
