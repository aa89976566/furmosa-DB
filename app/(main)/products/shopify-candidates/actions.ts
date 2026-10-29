'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { shopifyAdminAuthConfigFromEnv } from '@/lib/shopify/admin-access-token';
import {
  blockCatalogCandidate,
  candidateResolutionMessage,
  CandidateResolutionError,
  CANDIDATE_BLOCK_REASONS,
  formatBlockedCandidateNote,
  linkCatalogCandidate,
  sourceRemainsUnmatched,
  type LiveCandidateSource,
} from '@/lib/shopify/catalog-candidate-resolution';
import { loadShopifyCatalogAudit } from '@/lib/shopify/catalog-sync-service';
import {
  candidateCreateMessage,
  createCatalogCandidate,
} from '@/lib/shopify/catalog-candidate-create';

export type CandidateActionState = { ok: boolean; message: string };

const commonSchema = z.object({
  candidateId: z.string().min(1),
  expectedFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
});
const linkSchema = commonSchema.extend({ tierId: z.string().min(1) });
const blockSchema = commonSchema.extend({
  reason: z.enum(CANDIDATE_BLOCK_REASONS),
  note: z.string().max(500).optional(),
});
const createSchema = commonSchema.extend({
  targetProductId: z.string().min(1).optional(),
  category: z.enum(['staple_food', 'treats', 'health', 'freeze_dried', 'toys', 'accessories', 'other']),
  mode: z.enum(['weight', 'unit']),
  cost: z.coerce.number().finite().positive(),
  weightGrams: z.coerce.number().int().positive().optional(),
  unit: z.string().max(20).optional(),
  unitQty: z.coerce.number().int().positive().optional(),
}).superRefine((value, context) => {
  if (value.mode === 'weight' && !value.weightGrams) context.addIssue({ code: 'custom', path: ['weightGrams'], message: '請填寫淨重' });
  if (value.mode === 'unit' && (!value.unit || !value.unitQty)) context.addIssue({ code: 'custom', path: ['unit'], message: '請填寫單位與數量' });
});

async function requireFreshAdmin() {
  const session = await getCurrentUser();
  if (!session) return null;
  const actor = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, role: true },
  });
  return actor?.role === 'admin' ? actor : null;
}

async function liveCandidateSource(candidateId: string): Promise<{
  source: LiveCandidateSource;
  shopDomain: string;
}> {
  const candidate = await prisma.shopifyCatalogCandidate.findUnique({
    where: { id: candidateId },
    select: { shopifyProductId: true, shopifyVariantId: true },
  });
  if (!candidate) throw new CandidateResolutionError('CANDIDATE_NOT_FOUND', '找不到候選商品');
  const [audit, config] = await Promise.all([
    loadShopifyCatalogAudit(prisma),
    Promise.resolve(shopifyAdminAuthConfigFromEnv()),
  ]);
  const product = audit.shopifyProducts.find((row) => row.id === candidate.shopifyProductId);
  const variant = product?.variants.find((row) => row.id === candidate.shopifyVariantId);
  if (!product || !variant?.sku) throw new CandidateResolutionError('SOURCE_CHANGED', 'Shopify 商品已更新');
  const source = {
    productId: product.id,
    variantId: variant.id,
    productTitle: product.title,
    variantTitle: variant.title,
    sku: variant.sku,
    price: variant.price,
    shopifyStatus: product.status,
  } satisfies LiveCandidateSource;
  if (!sourceRemainsUnmatched(source, audit.plan.unmatchedShopifyVariants)) {
    throw new CandidateResolutionError('SOURCE_CHANGED', '商品已不在目前未對應清單');
  }
  return {
    shopDomain: config.domain,
    source,
  };
}

export async function linkCandidateAction(
  _previous: CandidateActionState,
  formData: FormData,
): Promise<CandidateActionState> {
  const actor = await requireFreshAdmin();
  if (!actor) return { ok: false, message: '只有 HQ 管理員可以連結商品規格。' };
  const parsed = linkSchema.safeParse({
    candidateId: String(formData.get('candidateId') ?? ''),
    tierId: String(formData.get('tierId') ?? ''),
    expectedFingerprint: String(formData.get('expectedFingerprint') ?? ''),
    targetProductId: formData.get('targetProductId') ? String(formData.get('targetProductId')) : undefined,
  });
  if (!parsed.success) return { ok: false, message: '畫面資料不完整，請重新整理後再試。' };
  const existing = await prisma.shopifyCatalogCandidate.findUnique({
    where: { id: parsed.data.candidateId },
    select: { resolution: true, linkedTierId: true },
  });
  if (existing?.resolution === 'linked' && existing.linkedTierId === parsed.data.tierId) {
    redirect(`/products/shopify-candidates/${parsed.data.candidateId}?updated=linked`);
  }
  if (existing && existing.resolution !== 'pending') {
    return { ok: false, message: '這筆資料已由其他人處理，請重新整理查看最新結果。' };
  }
  try {
    const live = await liveCandidateSource(parsed.data.candidateId);
    await linkCatalogCandidate(prisma, { ...parsed.data, ...live, actorId: actor.id });
  } catch (error) {
    console.error('[SHOPIFY_CANDIDATE_LINK_FAILED]', error instanceof Error ? error.message : String(error));
    return { ok: false, message: candidateResolutionMessage(error) };
  }
  revalidatePath('/products/shopify-candidates');
  revalidatePath(`/products/shopify-candidates/${parsed.data.candidateId}`);
  redirect(`/products/shopify-candidates/${parsed.data.candidateId}?updated=linked`);
}

export async function blockCandidateAction(
  _previous: CandidateActionState,
  formData: FormData,
): Promise<CandidateActionState> {
  const actor = await requireFreshAdmin();
  if (!actor) return { ok: false, message: '只有 HQ 管理員可以標記這次不建立。' };
  const parsed = blockSchema.safeParse({
    candidateId: String(formData.get('candidateId') ?? ''),
    expectedFingerprint: String(formData.get('expectedFingerprint') ?? ''),
    reason: String(formData.get('reason') ?? ''),
    note: String(formData.get('note') ?? ''),
  });
  if (!parsed.success) return { ok: false, message: '請選擇原因；選擇「其他」時也要填寫說明。' };
  const existing = await prisma.shopifyCatalogCandidate.findUnique({
    where: { id: parsed.data.candidateId },
    select: { resolution: true, notes: true },
  });
  const expectedNote = formatBlockedCandidateNote(parsed.data.reason, parsed.data.note);
  if (existing?.resolution === 'blocked' && existing.notes === expectedNote) {
    redirect(`/products/shopify-candidates/${parsed.data.candidateId}?updated=blocked`);
  }
  if (existing && existing.resolution !== 'pending') {
    return { ok: false, message: '這筆資料已由其他人處理，請重新整理查看最新結果。' };
  }
  try {
    const live = await liveCandidateSource(parsed.data.candidateId);
    await blockCatalogCandidate(prisma, { ...parsed.data, ...live, actorId: actor.id });
  } catch (error) {
    console.error('[SHOPIFY_CANDIDATE_BLOCK_FAILED]', error instanceof Error ? error.message : String(error));
    return { ok: false, message: candidateResolutionMessage(error) };
  }
  revalidatePath('/products/shopify-candidates');
  revalidatePath(`/products/shopify-candidates/${parsed.data.candidateId}`);
  redirect(`/products/shopify-candidates/${parsed.data.candidateId}?updated=blocked`);
}

export async function createCandidateAction(
  _previous: CandidateActionState,
  formData: FormData,
): Promise<CandidateActionState> {
  const actor = await requireFreshAdmin();
  if (!actor) return { ok: false, message: '只有 HQ 管理員可以建立商品。' };
  const parsed = createSchema.safeParse({
    candidateId: String(formData.get('candidateId') ?? ''),
    expectedFingerprint: String(formData.get('expectedFingerprint') ?? ''),
    category: String(formData.get('category') ?? ''),
    mode: String(formData.get('mode') ?? ''),
    cost: String(formData.get('cost') ?? ''),
    weightGrams: formData.get('weightGrams') ? String(formData.get('weightGrams')) : undefined,
    unit: formData.get('unit') ? String(formData.get('unit')) : undefined,
    unitQty: formData.get('unitQty') ? String(formData.get('unitQty')) : undefined,
  });
  if (!parsed.success) return { ok: false, message: '請完整填寫商品分類、實際包裝規格與大於 0 的整包進貨成本。' };
  try {
    const existing = await prisma.shopifyCatalogCandidate.findUnique({ where: { id: parsed.data.candidateId } });
    if (existing?.resolution === 'created') {
      const config = shopifyAdminAuthConfigFromEnv();
      await createCatalogCandidate(prisma, {
        ...parsed.data,
        shopDomain: config.domain,
        source: {
          productId: existing.shopifyProductId,
          variantId: existing.shopifyVariantId,
          productTitle: existing.productTitle,
          variantTitle: existing.variantTitle,
          sku: existing.sku ?? '',
          price: Number(existing.price),
          shopifyStatus: existing.shopifyStatus,
        },
        actorId: actor.id,
        weightGrams: parsed.data.weightGrams ?? null,
        unit: parsed.data.unit ?? null,
        unitQty: parsed.data.unitQty ?? null,
      });
    } else {
      const live = await liveCandidateSource(parsed.data.candidateId);
      await createCatalogCandidate(prisma, {
        ...parsed.data,
        ...live,
        actorId: actor.id,
        weightGrams: parsed.data.weightGrams ?? null,
        unit: parsed.data.unit ?? null,
        unitQty: parsed.data.unitQty ?? null,
      });
    }
  } catch (error) {
    console.error('[SHOPIFY_CANDIDATE_CREATE_FAILED]', error instanceof Error ? error.message : String(error));
    return { ok: false, message: candidateCreateMessage(error) };
  }
  revalidatePath('/products');
  revalidatePath('/products/shopify-candidates');
  revalidatePath(`/products/shopify-candidates/${parsed.data.candidateId}`);
  redirect(`/products/shopify-candidates/${parsed.data.candidateId}?updated=created`);
}
