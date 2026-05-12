import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { adjustMerchantStock, recordMerchantQuickSale } from '../actions';
import { AdjustForm } from './adjust-form';

export const dynamic = 'force-dynamic';

export default async function MerchantAdjustPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { productId?: string; mode?: string };
}) {
  const merchant = await prisma.merchant.findUnique({
    where: { id: params.id },
    include: {
      stocks: { include: { product: true }, orderBy: { product: { name: 'asc' } } },
      productRules: { include: { product: true } },
    },
  });
  if (!merchant) notFound();

  const productIds = new Set<string>();
  for (const s of merchant.stocks) productIds.add(s.productId);
  for (const r of merchant.productRules) productIds.add(r.productId);

  const products = await prisma.product.findMany({
    where: { id: { in: [...productIds] } },
    orderBy: { name: 'asc' },
  });

  const stockByProduct = new Map(merchant.stocks.map((s) => [s.productId, s.quantity]));
  const ruleByProduct = new Map(merchant.productRules.map((r) => [r.productId, r]));

  const productOptions = products.map((p) => {
    const rule = ruleByProduct.get(p.id);
    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      currentStock: stockByProduct.get(p.id) ?? 0,
      suggestedPrice: rule?.suggestedPrice ?? null,
      commissionMode: rule?.commissionMode ?? null,
      commissionValue: rule?.commissionValue ?? null,
    };
  });

  return (
    <>
      <PageHeader
        title={`盤點 / 賣出登記：${merchant.name}`}
        description="一筆一筆對：實地盤點剩多少，或店家回報賣了多少都可以"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href={`/merchants/${merchant.id}`}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回
            </Link>
          </Button>
        }
      />
      <div className="grid gap-6 p-6 lg:grid-cols-3">
        <SectionCard
          title="登記異動"
          description="兩種模式：盤點（覆寫成新數量）或 賣出（從庫存扣掉並算抽成）"
          className="lg:col-span-2"
        >
          {productOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">這家店還沒有任何商品紀錄</p>
          ) : (
            <AdjustForm
              merchantId={merchant.id}
              products={productOptions}
              initialProductId={searchParams?.productId}
              initialMode={searchParams?.mode === 'sold' ? 'sold' : 'count'}
              countAction={adjustMerchantStock}
              saleAction={recordMerchantQuickSale}
            />
          )}
        </SectionCard>

        <SectionCard title="提醒" description="兩種模式怎麼用" className="lg:col-span-1">
          <ul className="space-y-3 text-sm">
            <li className="rounded-md border-l-4 border-primary bg-primary/5 p-3">
              <div className="font-semibold">盤點</div>
              <div className="text-xs text-muted-foreground">
                寫入「現場最終數量」。系統會記下差異 (例如 5 → 3 = -2)，常用於回收破損 / 漏記 / 失竊。
              </div>
            </li>
            <li className="rounded-md border-l-4 border-warning bg-warning/5 p-3">
              <div className="font-semibold">賣出</div>
              <div className="text-xs text-muted-foreground">
                店家對帳說「這個月賣了 N 個」就用這個。系統會：
                <br />
                • 扣店家庫存 -N
                <br />
                • 自動依抽成規則算店家抽成、公司實收
                <br />
                • 寫入流水（type=sale），但不開正式訂單
              </div>
            </li>
            <li className="rounded-md border-l-4 border-info bg-info/5 p-3">
              <div className="font-semibold">需要開正式訂單？</div>
              <div className="text-xs text-muted-foreground">
                想記錄客戶資料、要進結算的，請改走「建立訂單」。
              </div>
            </li>
          </ul>
        </SectionCard>
      </div>
    </>
  );
}
