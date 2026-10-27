import Link from 'next/link';
import { ArrowLeft, ListChecks, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { ShopifySafeSyncForm } from '@/components/products/shopify-safe-sync-form';
import { ShopifyStageCandidatesForm } from '@/components/products/shopify-stage-candidates-form';
import { prisma } from '@/lib/prisma';
import { loadShopifyCatalogAudit } from '@/lib/shopify/catalog-sync-service';

export const dynamic = 'force-dynamic';

const hqReasonLabel = {
  missing_identity: 'HQ 規格缺少可辨識的 SKU',
  no_shopify_match: 'HQ SKU 在 Shopify 找不到',
  conflict: '同一個 Shopify 規格被重複認領',
} as const;

async function loadAudit() {
  return loadShopifyCatalogAudit(prisma);
}

function ReviewSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;

  return (
    <details className="group border-b border-border last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 hover:bg-muted/40">
        <span className="font-medium">{title}</span>
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-sm font-semibold text-amber-900">{count}</span>
      </summary>
      <div className="divide-y divide-border border-t border-border">{children}</div>
    </details>
  );
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

  const blockingCount = audit
    ? audit.plan.conflicts.length + audit.plan.unmatchedHqTiers.length
    : 0;
  const catalogWorkCount = audit
    ? audit.plan.unmatchedShopifyVariants.length
    : 0;
  const safeChangeCount = audit
    ? audit.plan.tierUpdates.length + audit.plan.productUpdates.length + audit.plan.tierArchives.length
    : 0;
  const hqTierLabels = new Map<string, string>();
  const shopifyVariantLabels = new Map<string, string>();
  if (audit) {
    for (const product of audit.hqProducts) {
      for (const tier of product.priceTiers) {
        const identity = tier.sku ?? tier.shopifySku ?? '未設定 SKU';
        const spec = tier.weightGrams ? `${tier.weightGrams}g` : `${tier.unitQty} ${tier.unit}`;
        const status = tier.status === 'archived' ? '已封存' : '使用中';
        hqTierLabels.set(tier.id, `${product.name} · ${identity} · ${spec} · ${status}`);
      }
    }
    for (const product of audit.shopifyProducts) {
      for (const variant of product.variants) {
        shopifyVariantLabels.set(variant.id, `${product.title} · ${variant.sku ?? '未設定 SKU'} · ${variant.title}`);
      }
    }
  }

  return (
    <>
      <PageHeader
        title="Shopify 商品檢查"
        description="先同步唯一可確認的資料；未對應商品留在待處理區，不會猜測或重複建立。"
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/products/shopify-candidates">
                <ListChecks className="mr-1 h-4 w-4" />
                查看待建清單
              </Link>
            </Button>
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
              blockingCount === 0
                ? 'border-emerald-200 bg-emerald-50'
                : 'border-amber-200 bg-amber-50'
            }`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  {blockingCount === 0 ? (
                    <ShieldCheck className="mt-0.5 h-6 w-6 text-emerald-700" />
                  ) : (
                    <TriangleAlert className="mt-0.5 h-6 w-6 text-amber-700" />
                  )}
                  <div>
                    <h2 className="text-lg font-semibold">
                      {blockingCount === 0 ? '現有商品可以進入同步確認' : `還有 ${blockingCount} 筆現有商品問題`}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      先處理現有 HQ 商品的對應問題；Shopify 新商品另列待建清單。
                    </p>
                  </div>
                </div>
                <div className="rounded-xl bg-white/70 px-4 py-2 text-sm font-medium">
                  可安全預覽變更 {safeChangeCount} 筆
                </div>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard label="Shopify 上架商品" value={audit.shopifyProducts.length} />
              <MetricCard label="HQ 標準商品" value={audit.hqProducts.length} />
              <MetricCard label="可安全對應規格" value={audit.plan.tierUpdates.length} tone="safe" />
              <MetricCard label="現有商品問題" value={blockingCount} tone={blockingCount ? 'danger' : 'safe'} />
              <MetricCard label="待建 HQ 商品" value={catalogWorkCount} tone={catalogWorkCount ? 'warning' : 'safe'} />
            </section>

            <section className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="border-b border-border px-5 py-4">
                <h2 className="font-semibold">需要先修正</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  以下項目會影響現有 HQ 商品，修正前不建議正式套用。
                </p>
              </div>

              <div>
                <ReviewSection title="資料衝突" count={audit.plan.conflicts.length}>
                  {audit.plan.conflicts.slice(0, 50).map((item) => (
                    <div key={`${item.code}-${item.ids.join('-')}`} className="px-5 py-4">
                      <p className="font-medium text-red-800">資料衝突</p>
                      <p className="mt-1 text-sm">{item.message}</p>
                      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                        {item.ids.map((id) => (
                          <li key={id}>{shopifyVariantLabels.get(id) ?? hqTierLabels.get(id) ?? id}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </ReviewSection>

                <ReviewSection title="HQ 規格尚未對應 Shopify" count={audit.plan.unmatchedHqTiers.length}>
                  {audit.plan.unmatchedHqTiers.slice(0, 50).map((item) => (
                    <div key={item.tierId} className="px-5 py-4">
                      <p className="font-medium">{item.productName}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{hqReasonLabel[item.reason]}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{hqTierLabels.get(item.tierId) ?? item.tierId}</p>
                    </div>
                  ))}
                </ReviewSection>

                {blockingCount === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-muted-foreground">沒有現有商品問題的項目。</div>
                ) : null}
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="flex flex-col gap-4 border-b border-border px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-semibold">待建立或補資料</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    先把 Shopify 原始資料完整登記進 HQ 待處理區；正式套用仍需完整確認，不建立庫存、不猜成本，也不會直接上架。
                  </p>
                </div>
                <ShopifyStageCandidatesForm fingerprint={audit.fingerprint} count={catalogWorkCount} />
              </div>
              <div>
                <ReviewSection title="Shopify 有 SKU，HQ 尚未建立" count={audit.plan.unmatchedShopifyVariants.length}>
                  {audit.plan.unmatchedShopifyVariants.slice(0, 50).map((item) => (
                    <div key={item.variantId} className="px-5 py-4">
                      <p className="font-medium">{item.productTitle}</p>
                      <p className="mt-1 text-sm text-muted-foreground">SKU {item.sku} · 建立 HQ 商品前需確認單位、成本與庫存規格</p>
                    </div>
                  ))}
                </ReviewSection>
                <ReviewSection title="Shopify 不需建立 HQ 商品" count={audit.plan.blankShopifyVariants.length}>
                  {audit.plan.blankShopifyVariants.slice(0, 50).map((item) => (
                    <div key={item.variantId} className="px-5 py-4">
                      <p className="font-medium">{item.productTitle}</p>
                      <p className="mt-1 text-sm text-muted-foreground">規格「{item.variantTitle}」不需 SKU，也不建立 HQ 庫存商品</p>
                    </div>
                  ))}
                </ReviewSection>
                {catalogWorkCount === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-muted-foreground">沒有待建立或缺 SKU 的商品。</div>
                ) : null}
              </div>
            </section>

            <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-semibold text-emerald-950">可安全同步</h2>
                  <div className="mt-3 grid gap-2 text-sm text-emerald-950 sm:grid-cols-3">
                    <p>規格與價格：{audit.plan.tierUpdates.length} 筆</p>
                    <p>商品名稱與狀態：{audit.plan.productUpdates.length} 筆</p>
                    <p>舊規格待封存：{audit.plan.tierArchives.length} 筆</p>
                  </div>
                  <p className="mt-3 text-xs text-emerald-800">
                    按下同步後會重新核對確認碼；資料若已變動便會停止。未對應商品不會被修改。
                  </p>
                </div>
                <ShopifySafeSyncForm fingerprint={audit.fingerprint} count={safeChangeCount} />
              </div>
            </section>
          </>
        ) : null}
      </div>
    </>
  );
}
