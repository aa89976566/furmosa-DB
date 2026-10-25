import Link from 'next/link';
import { ArrowLeft, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { prisma } from '@/lib/prisma';
import { fetchShopifyCatalog } from '@/lib/shopify/catalog-source';
import { planShopifyHqCatalogSync } from '@/lib/shopify/catalog-sync';
import {
  getShopifyAdminAccessToken,
  shopifyAdminAuthConfigFromEnv,
} from '@/lib/shopify/admin-access-token';

export const dynamic = 'force-dynamic';

const hqReasonLabel = {
  missing_identity: 'HQ 規格缺少可辨識的 SKU',
  no_shopify_match: 'HQ SKU 在 Shopify 找不到',
  conflict: '同一個 Shopify 規格被重複認領',
} as const;

async function loadAudit() {
  const auth = shopifyAdminAuthConfigFromEnv();
  const token = await getShopifyAdminAccessToken(auth);
  const [shopifyProducts, hqProducts] = await Promise.all([
    fetchShopifyCatalog({ domain: auth.domain, token }),
    prisma.product.findMany({
      where: { productCategory: 'STANDARD' },
      orderBy: [{ productId: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        productId: true,
        name: true,
        status: true,
        sourceSku: true,
        priceTiers: {
          orderBy: [{ weightGrams: 'asc' }, { unitQty: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            status: true,
            sku: true,
            shopifySku: true,
            shopifyVariantId: true,
            weightGrams: true,
            unit: true,
            unitQty: true,
            price: true,
          },
        },
      },
    }),
  ]);

  return {
    shopifyProducts,
    hqProducts,
    plan: planShopifyHqCatalogSync(shopifyProducts, hqProducts),
  };
}

function MetricCard({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  tone?: 'safe' | 'warning' | 'danger' | 'neutral';
}) {
  const toneClass = {
    safe: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    warning: 'border-amber-200 bg-amber-50 text-amber-950',
    danger: 'border-red-200 bg-red-50 text-red-950',
    neutral: 'border-border bg-card text-foreground',
  }[tone];

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-sm font-medium opacity-70">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export default async function ShopifyCatalogAuditPage() {
  let audit: Awaited<ReturnType<typeof loadAudit>> | null = null;
  let errorMessage: string | null = null;

  try {
    audit = await loadAudit();
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : '暫時無法讀取 Shopify 商品';
  }

  const reviewCount = audit
    ? audit.plan.conflicts.length
      + audit.plan.blankShopifyVariants.length
      + audit.plan.unmatchedShopifyVariants.length
      + audit.plan.unmatchedHqTiers.length
    : 0;
  const safeChangeCount = audit
    ? audit.plan.tierUpdates.length + audit.plan.productUpdates.length + audit.plan.tierArchives.length
    : 0;

  return (
    <>
      <PageHeader
        title="Shopify 商品檢查"
        description="只讀比較 Shopify 與 HQ，不會修改、合併或刪除商品。"
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/products">
                <ArrowLeft className="mr-1 h-4 w-4" />
                返回產品
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/products/shopify-audit">
                <RefreshCw className="mr-1 h-4 w-4" />
                重新檢查
              </Link>
            </Button>
          </>
        }
      />

      <div className="space-y-5 p-4 sm:p-6">
        {errorMessage ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-950">
            <div className="flex items-start gap-3">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <h2 className="font-semibold">目前無法完成檢查</h2>
                <p className="mt-1 text-sm leading-relaxed">{errorMessage}</p>
                <p className="mt-2 text-sm text-red-800">HQ 沒有修改任何商品，請稍後按「重新檢查」。</p>
              </div>
            </div>
          </section>
        ) : null}

        {audit ? (
          <>
            <section className={`rounded-2xl border p-5 ${
              reviewCount === 0
                ? 'border-emerald-200 bg-emerald-50'
                : 'border-amber-200 bg-amber-50'
            }`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  {reviewCount === 0 ? (
                    <ShieldCheck className="mt-0.5 h-6 w-6 text-emerald-700" />
                  ) : (
                    <TriangleAlert className="mt-0.5 h-6 w-6 text-amber-700" />
                  )}
                  <div>
                    <h2 className="text-lg font-semibold">
                      {reviewCount === 0 ? '資料可以進入同步確認' : `還有 ${reviewCount} 筆需要人工確認`}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      有待確認項目時，系統會禁止正式套用；本頁本身永遠只讀。
                    </p>
                  </div>
                </div>
                <div className="rounded-xl bg-white/70 px-4 py-2 text-sm font-medium">
                  可安全預覽變更 {safeChangeCount} 筆
                </div>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Shopify 商品" value={audit.shopifyProducts.length} />
              <MetricCard label="HQ 標準商品" value={audit.hqProducts.length} />
              <MetricCard label="可安全對應規格" value={audit.plan.tierUpdates.length} tone="safe" />
              <MetricCard label="需要人工確認" value={reviewCount} tone={reviewCount ? 'warning' : 'safe'} />
            </section>

            <section className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="border-b border-border px-5 py-4">
                <h2 className="font-semibold">需要人工確認</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  先補齊 SKU 或選擇正確對應；系統不會使用名稱、價格或重量猜測。
                </p>
              </div>

              <div className="divide-y divide-border">
                {audit.plan.conflicts.map((item) => (
                  <div key={`${item.code}-${item.ids.join('-')}`} className="px-5 py-4">
                    <p className="font-medium text-red-800">資料衝突</p>
                    <p className="mt-1 text-sm">{item.message}</p>
                  </div>
                ))}

                {audit.plan.blankShopifyVariants.map((item) => (
                  <div key={item.variantId} className="px-5 py-4">
                    <p className="font-medium">{item.productTitle}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Shopify 規格「{item.variantTitle}」缺少 SKU
                    </p>
                  </div>
                ))}

                {audit.plan.unmatchedShopifyVariants.map((item) => (
                  <div key={item.variantId} className="px-5 py-4">
                    <p className="font-medium">{item.productTitle}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Shopify SKU {item.sku} 尚未對應 HQ 規格
                    </p>
                  </div>
                ))}

                {audit.plan.unmatchedHqTiers.map((item) => (
                  <div key={item.tierId} className="px-5 py-4">
                    <p className="font-medium">{item.productName}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {hqReasonLabel[item.reason]}
                    </p>
                  </div>
                ))}

                {reviewCount === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                    沒有待確認項目。
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <h2 className="font-semibold text-emerald-950">可安全對應的預覽</h2>
              <div className="mt-3 grid gap-2 text-sm text-emerald-950 sm:grid-cols-3">
                <p>規格與價格：{audit.plan.tierUpdates.length} 筆</p>
                <p>商品名稱與狀態：{audit.plan.productUpdates.length} 筆</p>
                <p>舊規格待封存：{audit.plan.tierArchives.length} 筆</p>
              </div>
              <p className="mt-3 text-xs text-emerald-800">
                此區只是預覽。正式套用仍需另外提供完整指紋並再次確認。
              </p>
            </section>
          </>
        ) : null}
      </div>
    </>
  );
}
