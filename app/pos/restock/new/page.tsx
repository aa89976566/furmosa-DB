import Link from 'next/link';
import { requireMerchantSession } from '@/lib/merchant-auth';
import { NewRestockForm } from './new-restock-form';
import { listJarExchangeProductsForRestock } from '@/lib/restock-request/service';
import { getAuthenticatedMerchantId } from '@/lib/merchant-auth';
import { prisma } from '@/lib/prisma';

export const metadata = { title: '新增補貨 · Furmosa 店家' };

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
    <div className="mx-auto w-full max-w-lg px-4 py-6">
      <Link href="/pos/restock" className="text-xs text-muted-foreground">
        ← 補貨列表
      </Link>
      <h1 className="mb-4 text-xl font-semibold text-navy">新增補貨申請</h1>
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
    </div>
  );
}
