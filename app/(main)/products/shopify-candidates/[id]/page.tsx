import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Link2, PackagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { shopifyAdminAuthConfigFromEnv } from '@/lib/shopify/admin-access-token';
import {
  candidateResolutionFingerprint,
  canonicalShopifyVariantId,
  exactAvailableClaims,
  parseBlockedCandidateNote,
  type CandidateClaim,
} from '@/lib/shopify/catalog-candidate-resolution';
import { BlockCandidateForm, CreateCandidateForm, LinkCandidateForm } from './candidate-actions';

export const dynamic = 'force-dynamic';

function tierLabel(tier: CandidateClaim & { product: { status: string; name?: string; productId?: string } }) {
  return `${tier.product.name ?? 'HQ 商品'}（${tier.sku || tier.shopifySku || '未設定 SKU'}）`;
}

export default async function ShopifyCandidateDetailPage(props: { params: Promise<{ id: string }> }) {
  const [{ id }, session] = await Promise.all([props.params, getCurrentUser()]);
  const selected = await prisma.shopifyCatalogCandidate.findUnique({ where: { id } });
  if (!selected) notFound();
  const [actor, candidates] = await Promise.all([
    session ? prisma.user.findUnique({ where: { id: session.userId }, select: { role: true } }) : null,
    prisma.shopifyCatalogCandidate.findMany({
      where: { shopifyProductId: selected.shopifyProductId },
      orderBy: [{ variantTitle: 'asc' }, { id: 'asc' }],
    }),
  ]);
  const searchSkus = candidates.flatMap((row) => row.sku?.trim() ? [row.sku.trim()] : []);
  const variantIds = candidates.flatMap((row) => [row.shopifyVariantId, canonicalShopifyVariantId(row.shopifyVariantId)]);
  const claims = await prisma.productPriceTier.findMany({
    where: {
      OR: [
        { shopifyVariantId: { in: variantIds } },
        { sku: { in: searchSkus, mode: 'insensitive' } },
        { shopifySku: { in: searchSkus, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      productId: true,
      status: true,
      sku: true,
      shopifySku: true,
      shopifyVariantId: true,
      product: { select: { status: true, name: true, productId: true } },
    },
  });
  const shopDomain = shopifyAdminAuthConfigFromEnv().domain;
  const canManage = actor?.role === 'admin';
  const pending = candidates.filter((row) => row.resolution === 'pending').length;
  const parentProductIds = [...new Set(candidates.flatMap((row) =>
    ['linked', 'created'].includes(row.resolution) && row.linkedProductId ? [row.linkedProductId] : [],
  ))];
  const parentProduct = parentProductIds.length === 1
    ? await prisma.product.findUnique({ where: { id: parentProductIds[0] }, select: { name: true } })
    : null;
  const parentProductMissing = parentProductIds.length === 1 && parentProduct == null;

  return (
    <>
      <PageHeader
        title={selected.productTitle}
        description={`${candidates.length} 個 Shopify 規格；${pending ? `還有 ${pending} 個待確認` : '已全部處理'}`}
        actions={<Button variant="outline" size="sm" asChild><Link href="/products/shopify-candidates"><ArrowLeft className="mr-1 h-4 w-4" />返回清單</Link></Button>}
      />
      <main className="space-y-4 p-4 pb-24 sm:p-6">
        {!canManage ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">目前為唯讀模式；需要 HQ 管理員權限才能處理。</div> : null}
        {candidates.map((candidate) => {
          const relevantClaims = claims.filter((claim) => (
            (claim.shopifyVariantId
              && canonicalShopifyVariantId(claim.shopifyVariantId) === canonicalShopifyVariantId(candidate.shopifyVariantId))
            || [claim.sku, claim.shopifySku].some((sku) => sku?.trim().toUpperCase() === candidate.sku?.trim().toUpperCase())
          ));
          const exact = exactAvailableClaims(candidate, relevantClaims);
          const fingerprint = candidateResolutionFingerprint({ shopDomain, candidate, claims: relevantClaims });
          const blocked = parseBlockedCandidateNote(candidate.notes);
          const linkable = candidate.resolution === 'pending' && exact.length === 1;
          return (
            <article key={candidate.id} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{candidate.variantTitle || '預設規格'}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">SKU {candidate.sku || '未設定'} · Shopify 售價 NT${Number(candidate.price).toLocaleString('zh-TW')}</p>
                </div>
                <span className={candidate.resolution === 'pending' ? 'rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-900' : 'rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-900'}>
                  {candidate.resolution === 'pending' ? '待確認' : candidate.resolution === 'linked' ? '已連結' : candidate.resolution === 'created' ? '已建立' : candidate.resolution === 'blocked' ? '這次不建立' : '已結案'}
                </span>
              </div>

              {candidate.resolution === 'pending' ? (
                <div className="mt-5 grid gap-4 xl:grid-cols-3">
                  <section className="rounded-xl border border-border p-4">
                    <div className="flex gap-2"><Link2 className="mt-0.5 h-4 w-4 text-emerald-800" /><div><h3 className="font-semibold">連結既有 HQ 規格</h3><p className="mt-1 text-sm text-muted-foreground">只接受唯一、完全相同的 SKU；不會改價格、成本或庫存。</p></div></div>
                    <div className="mt-4">
                      {linkable ? (
                        <div className="space-y-3 rounded-xl bg-muted/50 p-3">
                          <p className="text-sm"><span className="text-muted-foreground">Shopify</span> {candidate.variantTitle}（{candidate.sku}）</p>
                          <p className="text-center text-muted-foreground">↓</p>
                          <p className="text-sm"><span className="text-muted-foreground">HQ</span> {tierLabel(exact[0]!)}</p>
                          {canManage ? <LinkCandidateForm candidateId={candidate.id} tierId={exact[0]!.id} fingerprint={fingerprint} tierLabel={tierLabel(exact[0]!)} /> : null}
                        </div>
                      ) : (
                        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{exact.length > 1 ? '找到多個相同 SKU，為避免錯連已停止操作。' : '沒有唯一且 SKU 完全一致的 HQ 規格。'}</p>
                      )}
                    </div>
                  </section>
                  <section className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4">
                    <div className="flex gap-2"><PackagePlus className="mt-0.5 h-4 w-4 text-emerald-800" /><div><h3 className="font-semibold">{parentProduct ? '新增 HQ 規格' : '建立 HQ 商品'}</h3><p className="mt-1 text-sm text-muted-foreground">只建立商品資料，不會增加庫存。</p></div></div>
                    {parentProductIds.length > 1 ? (
                      <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">同一個 Shopify 商品目前對應到不同 HQ 商品，為避免拆錯商品，已停止建立。</p>
                    ) : parentProductMissing ? (
                      <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">既有對應的 HQ 商品已不存在，為避免建立到錯誤商品，已停止建立。</p>
                    ) : canManage && candidate.sku ? (
                      <div className="mt-4"><CreateCandidateForm candidateId={candidate.id} fingerprint={fingerprint} productTitle={candidate.productTitle} variantTitle={candidate.variantTitle} sku={candidate.sku} price={Number(candidate.price)} existingProductName={parentProduct?.name} /></div>
                    ) : (
                      <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{candidate.sku ? '需要 HQ 管理員權限才能建立。' : 'Shopify 規格沒有 SKU，不能安全建立。'}</p>
                    )}
                  </section>
                  <section className="rounded-xl border border-border p-4">
                    <h3 className="font-semibold">這次不建立</h3>
                    <p className="mt-1 text-sm text-muted-foreground">適用於停售、測試或不由 HQ 履約的項目。</p>
                    {canManage ? <div className="mt-4"><BlockCandidateForm candidateId={candidate.id} fingerprint={fingerprint} /></div> : null}
                  </section>
                </div>
              ) : (
                <div className="mt-4 rounded-xl bg-muted/50 p-3 text-sm">
                  {candidate.resolution === 'linked' ? `已連結 HQ 規格 ${candidate.linkedTierId ?? ''}` : candidate.resolution === 'created' ? '已建立 HQ 商品資料；庫存仍為 0，尚未入庫。' : blocked ? `原因：${blocked.reason}${blocked.detail ? `｜${blocked.detail}` : ''}` : candidate.notes || '此規格已處理。'}
                </div>
              )}
            </article>
          );
        })}
      </main>
    </>
  );
}
