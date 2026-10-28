import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Box, Link2, PackagePlus, Search, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseBlockedCandidateNote } from '@/lib/shopify/catalog-candidate-resolution';
import { BlockCandidateForm, LinkCandidateForm } from './candidate-actions';

export const dynamic = 'force-dynamic';

function normalized(value?: string | null) {
  return value?.trim().toLocaleLowerCase('en-US') || null;
}

function tierLabel(tier: {
  product: { name: string };
  weightGrams: number | null;
  unit: string;
  unitQty: number;
}) {
  const specification = tier.weightGrams
    ? `${tier.weightGrams}g`
    : `${tier.unitQty} ${tier.unit}`;
  return `${tier.product.name} ${specification}`;
}

export default async function ShopifyCandidateDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ q?: string }>;
}) {
  const [{ id }, searchParams, session] = await Promise.all([
    props.params,
    props.searchParams,
    getCurrentUser(),
  ]);
  const candidate = await prisma.shopifyCatalogCandidate.findUnique({ where: { id } });
  if (!candidate) notFound();

  const [actor, linkedTier, resolver] = await Promise.all([
    session
      ? prisma.user.findUnique({ where: { id: session.userId }, select: { role: true } })
      : null,
    candidate.linkedTierId
      ? prisma.productPriceTier.findUnique({
          where: { id: candidate.linkedTierId },
          include: { product: { select: { name: true, productId: true } } },
        })
      : null,
    candidate.resolvedById
      ? prisma.user.findUnique({ where: { id: candidate.resolvedById }, select: { name: true } })
      : null,
  ]);
  const canManage = actor?.role === 'admin';
  const q = (searchParams?.q ?? candidate.sku ?? candidate.productTitle).trim();
  const tiers = candidate.resolution === 'pending' && q
    ? await prisma.productPriceTier.findMany({
        where: {
          status: 'active',
          product: { status: 'active' },
          OR: [
            { sku: { contains: q, mode: 'insensitive' } },
            { shopifySku: { contains: q, mode: 'insensitive' } },
            { product: { name: { contains: q, mode: 'insensitive' } } },
          ],
        },
        include: { product: { select: { name: true, productId: true } } },
        orderBy: [{ product: { name: 'asc' } }, { weightGrams: 'asc' }, { unitQty: 'asc' }],
        take: 30,
      })
    : [];
  const blockedNote = parseBlockedCandidateNote(candidate.notes);

  return (
    <>
      <PageHeader
        title={candidate.resolution === 'pending' ? '處理 Shopify 商品' : 'Shopify 商品處理結果'}
        description="先確認是否已有 HQ 商品；系統不會猜測成本、規格或庫存。"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/products/shopify-candidates">
              <ArrowLeft className="mr-1 h-4 w-4" />返回待處理清單
            </Link>
          </Button>
        }
      />

      <main className="space-y-5 p-4 pb-24 sm:p-6">
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-800"><Box className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Shopify 資料</p>
              <h1 className="mt-1 text-xl font-semibold">{candidate.productTitle}</h1>
              <p className="mt-1 text-muted-foreground">規格：{candidate.variantTitle || '預設規格'}</p>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <Info label="SKU" value={candidate.sku || '未設定'} />
                <Info label="Shopify 售價" value={`NT$${Number(candidate.price).toLocaleString('zh-TW')}`} />
                <Info label="目前狀態" value={candidate.resolution === 'pending' ? '待處理' : candidate.resolution} />
              </div>
              <details className="mt-4 text-xs text-muted-foreground">
                <summary className="cursor-pointer">查看技術識別碼</summary>
                <p className="mt-2 break-all">Variant ID：{candidate.shopifyVariantId}</p>
              </details>
            </div>
          </div>
        </section>

        {candidate.resolution !== 'pending' ? (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <h2 className="text-lg font-semibold text-emerald-950">此筆已處理完成</h2>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <Info label="處理結果" value={
                candidate.resolution === 'linked' ? '已連結現有規格'
                  : candidate.resolution === 'blocked' ? '不需建立'
                    : candidate.resolution === 'unavailable' ? 'Shopify 已無此待辦' : candidate.resolution
              } />
              <Info label="處理時間" value={candidate.resolvedAt?.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) ?? '—'} />
              <Info label="處理人" value={resolver?.name ?? '系統'} />
              {linkedTier ? <Info label="連結規格" value={tierLabel(linkedTier)} /> : null}
              {blockedNote ? <Info label="原因" value={`${blockedNote.reason}${blockedNote.detail ? `：${blockedNote.detail}` : ''}`} /> : null}
              {!blockedNote && candidate.notes ? <Info label="備註" value={candidate.notes} /> : null}
            </div>
          </section>
        ) : (
          <>
            {!canManage ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                目前為唯讀模式；需要 HQ 管理員權限才能完成連結或標記。
              </div>
            ) : null}

            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start gap-3">
                <Link2 className="mt-0.5 h-5 w-5 text-emerald-800" />
                <div>
                  <h2 className="text-lg font-semibold">1. 連結現有商品規格</h2>
                  <p className="mt-1 text-sm text-muted-foreground">HQ 已有這個商品時，搜尋並確認正確規格。已綁定其他 Shopify 規格的項目仍會顯示，但不能選取。</p>
                </div>
              </div>
              <form className="mt-4 flex gap-2">
                <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border px-3">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <input name="q" defaultValue={q} className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="商品名稱或 SKU" />
                </label>
                <Button type="submit" variant="outline">搜尋</Button>
              </form>

              <div className="mt-4 space-y-3">
                {tiers.length ? tiers.map((tier) => {
                  const candidateSku = normalized(candidate.sku);
                  const mismatch = Boolean(
                    candidateSku
                    && [normalized(tier.sku), normalized(tier.shopifySku)].some((value) => value && value !== candidateSku),
                  );
                  const boundElsewhere = Boolean(
                    tier.shopifyVariantId && tier.shopifyVariantId !== candidate.shopifyVariantId,
                  );
                  const disabled = mismatch || boundElsewhere;
                  const label = tierLabel(tier);
                  return (
                    <article key={tier.id} className="rounded-xl border border-border p-4">
                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(260px,auto)] md:items-start">
                        <div>
                          <h3 className="font-semibold">{label}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">HQ SKU：{tier.sku || '未設定'} · 售價 NT${tier.price.toLocaleString('zh-TW')}</p>
                          {disabled ? (
                            <p className="mt-2 text-sm font-medium text-amber-800">
                              {boundElsewhere ? '已連結其他 Shopify 規格' : 'SKU 不同，系統不會自動覆寫'}
                            </p>
                          ) : (
                            <div className="mt-3 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                              <p>將寫入：Shopify 規格識別碼；Shopify SKU 空白時才補上。</p>
                              <p className="mt-1">不會變更：售價、成本、重量、單位與庫存。</p>
                            </div>
                          )}
                        </div>
                        {canManage && !disabled ? (
                          <LinkCandidateForm candidateId={candidate.id} tierId={tier.id} tierLabel={label} />
                        ) : null}
                      </div>
                    </article>
                  );
                }) : (
                  <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">找不到符合條件的 HQ 商品規格；請換關鍵字，或使用下方「建立新商品」。</p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start gap-3">
                <PackagePlus className="mt-0.5 h-5 w-5 text-emerald-800" />
                <div className="flex-1">
                  <h2 className="text-lg font-semibold">2. 建立新商品</h2>
                  <p className="mt-1 text-sm text-muted-foreground">分兩步完成：先建立商品主檔與實際資料，再回到這裡連結正確規格。本步不會自動建立庫存或成本。</p>
                  {canManage ? (
                    <Button asChild className="mt-4 min-h-11">
                      <Link href={`/products/new?fromCandidate=${candidate.id}`}>前往建立商品</Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start gap-3">
                <XCircle className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold">3. 不需建立</h2>
                  <p className="mt-1 text-sm text-muted-foreground">適用於贈品、組合包、測試商品或其他不屬於 HQ 庫存主檔的項目。</p>
                  {canManage ? <div className="mt-4 max-w-xl"><BlockCandidateForm candidateId={candidate.id} /></div> : null}
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}
