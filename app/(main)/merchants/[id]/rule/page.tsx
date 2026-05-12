import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { upsertMerchantRule, deleteMerchantRule } from '../actions';

export const dynamic = 'force-dynamic';

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
      stocks: { include: { product: true } },
    },
  });
  if (!merchant) notFound();

  const productId = searchParams?.productId;
  if (!productId) {
    redirect(`/merchants/${merchant.id}`);
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) notFound();

  const existingRule = merchant.productRules.find((r) => r.productId === productId);

  const previewPrice = existingRule?.suggestedPrice ?? product.price;

  return (
    <>
      <PageHeader
        title={`${existingRule ? '編輯' : '設定'}寄賣規則`}
        description={`${merchant.name} × ${product.name}`}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href={`/merchants/${merchant.id}`}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回
            </Link>
          </Button>
        }
      />
      <div className="grid gap-6 p-6 lg:grid-cols-2">
        <SectionCard title="抽成規則" description="同一商品在不同店家可有不同售價/抽成；只影響這家店">
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
              <label className="text-sm font-medium">抽成方式</label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 rounded-md border bg-background p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <input
                    type="radio"
                    name="commissionMode"
                    value="amount"
                    defaultChecked={(existingRule?.commissionMode ?? 'amount') === 'amount'}
                  />
                  <span>固定金額（每件抽 NT$）</span>
                </label>
                <label className="flex items-center gap-2 rounded-md border bg-background p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <input
                    type="radio"
                    name="commissionMode"
                    value="percent"
                    defaultChecked={existingRule?.commissionMode === 'percent'}
                  />
                  <span>百分比（按售價抽 %）</span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="commissionValue" className="text-sm font-medium">
                抽成數值
              </label>
              <input
                id="commissionValue"
                name="commissionValue"
                type="number"
                min={0}
                step="0.01"
                required
                defaultValue={existingRule?.commissionValue ?? 20}
                className="block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground">
                若選「固定金額」就填 NT$ 數字（如 60）；若選「百分比」就填 % 數字（如 20）。
              </p>
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
                <Link href={`/merchants/${merchant.id}`}>取消</Link>
              </Button>
              <Button type="submit">{existingRule ? '更新規則' : '建立規則'}</Button>
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
            <Row label="此店現有規則" value={existingRule ? '已存在' : '尚未設定'} />
            <Row
              label="此店參考售價"
              value={`NT$${previewPrice}`}
            />
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
