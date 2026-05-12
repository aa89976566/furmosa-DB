import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { restockMerchant } from '../actions';
import { RestockForm } from './restock-form';
import { CarrierSelect } from '@/components/shared/carrier-select';

export const dynamic = 'force-dynamic';

export default async function MerchantRestockPage({ params }: { params: { id: string } }) {
  const merchant = await prisma.merchant.findUnique({
    where: { id: params.id },
    include: {
      productRules: { include: { product: true }, orderBy: { suggestedPrice: 'desc' } },
      stocks: { include: { product: true } },
    },
  });
  if (!merchant) notFound();

  const allProducts = await prisma.product.findMany({
    where: { status: 'active' },
    orderBy: { name: 'asc' },
  });

  const stockMap = new Map(merchant.stocks.map((s) => [s.productId, s.quantity]));
  const ruleProductIds = new Set(merchant.productRules.map((r) => r.productId));

  // 已寄賣的優先排前面
  const sortedProducts = [...allProducts].sort((a, b) => {
    const aRule = ruleProductIds.has(a.id) ? 0 : 1;
    const bRule = ruleProductIds.has(b.id) ? 0 : 1;
    return aRule - bRule || a.name.localeCompare(b.name, 'zh-Hant');
  });

  const productOptions = sortedProducts.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    isConsigned: ruleProductIds.has(p.id),
    currentStock: stockMap.get(p.id) ?? 0,
  }));

  return (
    <>
      <PageHeader
        title={`進貨：${merchant.name}`}
        description="建立寄到店家的出貨單 — 多筆一起送，物流人員會接手處理"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href={`/merchants/${merchant.id}`}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回
            </Link>
          </Button>
        }
      />
      <div className="grid gap-6 p-6">
        <SectionCard title="新增進貨" description="送一筆或多筆都可以，送出後該商品會 +到店家庫存">
          <form action={restockMerchant} className="space-y-4">
            <input type="hidden" name="merchantId" value={merchant.id} />
            <RestockForm products={productOptions} />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">物流方式（選填）</label>
                <CarrierSelect />
              </div>
              <div className="space-y-2">
                <label htmlFor="note" className="text-sm font-medium">
                  備註（選填）
                </label>
                <input
                  id="note"
                  name="note"
                  type="text"
                  placeholder="補貨、首批寄賣..."
                  className="block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div className="rounded-lg border-l-4 border-info bg-info/5 p-3 text-xs text-muted-foreground">
              送出後會建立一張「待出貨」的運送單（出現在出貨隊列）。
              物流人員依 包裝 → 寄出 → 送達 推進狀態，**送達後**才會真的 +到店家庫存。
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" asChild>
                <Link href={`/merchants/${merchant.id}`}>取消</Link>
              </Button>
              <Button type="submit">建立出貨單</Button>
            </div>
          </form>
        </SectionCard>
      </div>
    </>
  );
}
