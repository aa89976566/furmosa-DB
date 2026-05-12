import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { createMerchantSale } from '../actions';
import { SaleForm } from './sale-form';

export const dynamic = 'force-dynamic';

export default async function MerchantSalePage({ params }: { params: { id: string } }) {
  const merchant = await prisma.merchant.findUnique({
    where: { id: params.id },
    include: {
      productRules: { include: { product: true } },
      stocks: { include: { product: true } },
    },
  });
  if (!merchant) notFound();

  // 提供「有規則 + 有庫存」的商品優先；其他商品也可選但會提示
  const ruleByProduct = new Map(merchant.productRules.map((r) => [r.productId, r]));
  const stockByProduct = new Map(merchant.stocks.map((s) => [s.productId, s]));

  const productIds = new Set<string>([...ruleByProduct.keys(), ...stockByProduct.keys()]);
  const products = await prisma.product.findMany({
    where: { id: { in: [...productIds] } },
    orderBy: { name: 'asc' },
  });

  const items = products.map((p) => {
    const rule = ruleByProduct.get(p.id);
    const stock = stockByProduct.get(p.id);
    const suggestedPrice = rule?.suggestedPrice ?? p.price;
    const commissionPerUnit = rule
      ? rule.commissionMode === 'percent'
        ? (suggestedPrice * rule.commissionValue) / 100
        : rule.commissionValue
      : 0;
    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      stock: stock?.quantity ?? 0,
      suggestedPrice,
      commissionMode: rule?.commissionMode ?? null,
      commissionValue: rule?.commissionValue ?? null,
      commissionPerUnit,
      companyRevenuePerUnit: suggestedPrice - commissionPerUnit,
    };
  });

  const sellable = items.filter((i) => i.stock > 0);
  const noStock = items.filter((i) => i.stock <= 0);

  return (
    <>
      <PageHeader
        title={`建立寄賣訂單：${merchant.name}`}
        description="選商品 → 自動帶入該店家的售價與抽成 → 送出後扣店家庫存"
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
        <SectionCard
          title="新增訂單"
          description="若沒有設定該店家規則，預設售價會用商品定價、抽成 0"
        >
          {sellable.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              這家店目前所有商品都沒有庫存。
              <Link
                href={`/merchants/${merchant.id}/restock`}
                className="ml-2 font-medium text-primary hover:underline"
              >
                先去進貨 →
              </Link>
            </div>
          ) : (
            <form action={createMerchantSale} className="space-y-4">
              <input type="hidden" name="merchantId" value={merchant.id} />
              <SaleForm items={[...sellable, ...noStock]} />
              <div className="space-y-2">
                <label htmlFor="note" className="text-sm font-medium">
                  備註（選填）
                </label>
                <input
                  id="note"
                  name="note"
                  type="text"
                  placeholder="月結 / 客戶名稱 / 訂單編號..."
                  className="block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" asChild>
                  <Link href={`/merchants/${merchant.id}`}>取消</Link>
                </Button>
                <Button type="submit">送出訂單</Button>
              </div>
            </form>
          )}
        </SectionCard>
      </div>
    </>
  );
}
