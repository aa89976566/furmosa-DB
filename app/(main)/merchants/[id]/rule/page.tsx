import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { upsertMerchantRule, deleteMerchantRule } from '../actions';
import {
  MERCHANT_COMMISSION_PERCENTS,
  type MerchantCommissionPercent,
} from '@/lib/merchant-commission';

export const dynamic = 'force-dynamic';

function resolveInitialPercent(
  mode: string | null | undefined,
  value: number | null | undefined,
): MerchantCommissionPercent {
  if (mode === 'percent' && value === 20) return 20;
  if (mode === 'percent' && value === 30) return 30;
  return 30;
}

export default async function MerchantRulePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { productId?: string };
}) {
  const merchant = await prisma.merchant.findUnique({
    where: { id: params.id },
    include: {
      productRules: { include: { product: true } },
    },
  });
  if (!merchant) notFound();

  const productId = searchParams?.productId;
  if (!productId) {
    redirect(`/merchants/${merchant.id}/products`);
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) notFound();

  const existingRule = merchant.productRules.find((r) => r.productId === productId);
  const initialPercent = resolveInitialPercent(
    existingRule?.commissionMode,
    existingRule?.commissionValue,
  );
  const previewPrice = existingRule?.suggestedPrice ?? product.price;

  return (
    <>
      <PageHeader
        title={`${existingRule ? '編輯' : '設定'}寄賣分潤`}
        description={`${merchant.name} × ${product.name}`}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href={`/merchants/${merchant.id}/products`}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回商品列表
            </Link>
          </Button>
        }
      />
      <div className="grid gap-6 p-6 lg:grid-cols-2">
        <SectionCard
          title="寄賣分潤"
          description="此店此商品的分潤比例，僅可選 20% 或 30%"
        >
          <form action={upsertMerchantRule} className="space-y-4">
            <input type="hidden" name="merchantId" value={merchant.id} />
            <input type="hidden" name="productId" value={productId} />
            <div className="space-y-2">
              <label htmlFor="suggestedPrice" className="text-sm font-medium">
                建議售價（消費者付的錢）
              </label>
              <input
                id="suggestedPrice"
                name="suggestedPrice"
                type="number"
                min={1}
                step={1}
                required
                defaultValue={existingRule?.suggestedPrice ?? product.price ?? 0}
                className="block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium">寄賣分潤</span>
              <div className="inline-flex rounded-md border bg-background p-0.5">
                {MERCHANT_COMMISSION_PERCENTS.map((p) => (
                  <label
                    key={p}
                    className="cursor-pointer rounded px-4 py-2 text-sm has-[:checked]:bg-primary has-[:checked]:text-primary-foreground"
                  >
                    <input
                      type="radio"
                      name="commissionPercent"
                      value={p}
                      defaultChecked={initialPercent === p}
                      className="sr-only"
                    />
                    {p}%
                  </label>
                ))}
              </div>
              {existingRule?.commissionMode === 'amount' ? (
                <p className="text-xs text-warning">
                  此商品先前為固定金額抽成，儲存後會改為百分比分潤。
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label htmlFor="notes" className="text-sm font-medium">
                備註（選填）
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={2}
                defaultValue={existingRule?.notes ?? ''}
                className="block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" asChild>
                <Link href={`/merchants/${merchant.id}/products`}>取消</Link>
              </Button>
              <Button type="submit">{existingRule ? '更新' : '建立'}</Button>
            </div>
          </form>

          {existingRule && (
            <form action={deleteMerchantRule} className="mt-6 border-t pt-4">
              <input type="hidden" name="ruleId" value={existingRule.id} />
              <input type="hidden" name="merchantId" value={merchant.id} />
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="mr-1 h-4 w-4" />
                刪除這條規則
              </Button>
            </form>
          )}
        </SectionCard>

        <SectionCard title="商品資訊" description="參考用，不會被改動">
          <dl className="space-y-2 text-sm">
            <Row label="商品編號" value={product.productId} />
            <Row label="SKU" value={<span className="font-mono">{product.sku}</span>} />
            <Row label="名稱" value={product.name} />
            <Row label="分類" value={product.category} />
            <Row label="預設定價" value={`NT$${product.price}`} />
            <Row label="此店規則" value={existingRule ? '已設定' : '尚未設定'} />
            <Row label="參考售價" value={`NT$${previewPrice}`} />
          </dl>
        </SectionCard>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b pb-2 last:border-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
