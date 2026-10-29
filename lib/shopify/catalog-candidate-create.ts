import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { costPerUnitFromTierTotal } from '@/lib/product-price-tier';
import { TIER_UNIT_PRESETS } from '@/lib/product-units';
import { allocateNextProductIdentity } from '@/lib/products/product-id';
import {
  CandidateResolutionError,
  candidateResolutionFingerprint,
  canonicalShopifyVariantId,
  normalizeCandidateSku,
  sourceMatchesCandidate,
  type CandidateClaim,
  type LiveCandidateSource,
} from '@/lib/shopify/catalog-candidate-resolution';
import {
  resolveLegacyCatalogReference,
} from '@/lib/shopify/legacy-catalog-reference';
import { matchingExistingProducts } from '@/lib/shopify/catalog-candidate-product-match';

const VALID_CATEGORIES = new Set([
  'staple_food', 'treats', 'health', 'freeze_dried', 'toys', 'accessories', 'other',
]);

export type CandidateCreateInput = {
  candidateId: string;
  expectedFingerprint: string;
  shopDomain: string;
  source: LiveCandidateSource;
  actorId: string;
  category: string;
  mode: 'weight' | 'unit';
  cost: number;
  weightGrams?: number | null;
  unit?: string | null;
  unitQty?: number | null;
  targetProductId?: string | null;
};

export class CandidateCreateError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'CandidateCreateError';
  }
}

export function candidateCreateMessage(error: unknown) {
  if (error instanceof CandidateCreateError || error instanceof CandidateResolutionError) {
    return `${error.message}；沒有建立商品，也沒有增加庫存。`;
  }
  return '這次沒有建立商品，也沒有增加庫存；請重新整理後再試。';
}

export function normalizeCandidateCreateInput(input: CandidateCreateInput) {
  if (!VALID_CATEGORIES.has(input.category)) throw new CandidateCreateError('INVALID_CATEGORY', '請選擇商品分類');
  if (!Number.isFinite(input.cost) || input.cost <= 0) {
    throw new CandidateCreateError('INVALID_COST', '請填寫大於 0 的實際整包進貨成本');
  }
  if (input.mode === 'weight') {
    if (!Number.isInteger(input.weightGrams) || (input.weightGrams ?? 0) <= 0) {
      throw new CandidateCreateError('INVALID_WEIGHT', '請依包裝填寫正確的淨重克數');
    }
    return { category: input.category, mode: input.mode, cost: input.cost, weightGrams: input.weightGrams!, unit: 'g', unitQty: 1 };
  }
  const unit = input.unit?.trim() ?? '';
  if (!(TIER_UNIT_PRESETS as readonly string[]).includes(unit)) {
    throw new CandidateCreateError('INVALID_UNIT', '請選擇正確的販售單位');
  }
  if (!Number.isInteger(input.unitQty) || (input.unitQty ?? 0) <= 0) {
    throw new CandidateCreateError('INVALID_UNIT_QTY', '請填寫每包包含的數量');
  }
  return { category: input.category, mode: input.mode, cost: input.cost, weightGrams: null, unit, unitQty: input.unitQty! };
}

function inputDigest(input: CandidateCreateInput, normalized: ReturnType<typeof normalizeCandidateCreateInput>) {
  return createHash('sha256').update(JSON.stringify({
    candidateId: input.candidateId,
    expectedFingerprint: input.expectedFingerprint,
    targetProductId: input.targetProductId?.trim() || null,
    ...normalized,
  })).digest('hex');
}

function parseAuditMetadata(value: string | null) {
  try { return value ? JSON.parse(value) as Record<string, unknown> : null; } catch { return null; }
}

async function candidateClaims(tx: Prisma.TransactionClient, candidate: { sku: string | null; shopifyVariantId: string }) {
  const sku = candidate.sku?.trim() || '__NO_SKU__';
  const variantId = canonicalShopifyVariantId(candidate.shopifyVariantId);
  return tx.productPriceTier.findMany({
    where: { OR: [
      { sku: { equals: sku, mode: 'insensitive' } },
      { shopifySku: { equals: sku, mode: 'insensitive' } },
      { shopifyVariantId: { in: [candidate.shopifyVariantId, variantId] } },
    ] },
    select: { id: true, productId: true, status: true, sku: true, shopifySku: true, shopifyVariantId: true, product: { select: { status: true } } },
  });
}

async function completedResult(tx: Prisma.TransactionClient, input: CandidateCreateInput, digest: string) {
  const candidate = await tx.shopifyCatalogCandidate.findUnique({ where: { id: input.candidateId } });
  if (candidate?.resolution !== 'created') return null;
  if (!candidate.linkedProductId || !candidate.linkedTierId) throw new CandidateCreateError('INVALID_COMPLETED_STATE', '既有建立紀錄不完整，已停止重複處理');
  const audits = await tx.statusAuditLog.findMany({
    where: { entityType: 'shopify_catalog_candidate', entityId: candidate.id, newStatus: 'created' },
    select: { metadataJson: true },
  });
  if (audits.length !== 1 || parseAuditMetadata(audits[0]!.metadataJson)?.inputDigest !== digest) {
    throw new CandidateCreateError('IDEMPOTENCY_CONFLICT', '這筆已用不同資料建立，請查看最新結果');
  }
  return { ok: true as const, noop: true as const, productId: candidate.linkedProductId, tierId: candidate.linkedTierId };
}

export async function createCandidateInTransaction(tx: Prisma.TransactionClient, input: CandidateCreateInput) {
  const normalized = normalizeCandidateCreateInput(input);
  const digest = inputDigest(input, normalized);
  const lockKeys = [
    `parent|${input.shopDomain.trim().toLowerCase()}|${input.source.productId}`,
    `sku|${normalizeCandidateSku(input.source.sku) ?? '__NO_SKU__'}`,
    ...(input.targetProductId ? [`product|${input.targetProductId}`] : []),
  ].sort();
  for (const lockKey of lockKeys) {
    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);
  }

  const replay = await completedResult(tx, input, digest);
  if (replay) return replay;
  const candidate = await tx.shopifyCatalogCandidate.findUnique({ where: { id: input.candidateId } });
  if (!candidate) throw new CandidateCreateError('NOT_FOUND', '找不到這筆待確認商品');
  if (candidate.resolution !== 'pending') throw new CandidateCreateError('ALREADY_RESOLVED', '這筆剛由其他人處理');
  if (!sourceMatchesCandidate(candidate, input.source) || input.source.shopifyStatus.toLowerCase() !== 'active') {
    throw new CandidateCreateError('SOURCE_CHANGED', 'Shopify 商品剛有更新');
  }
  const sku = normalizeCandidateSku(input.source.sku);
  if (!sku) throw new CandidateCreateError('MISSING_SKU', 'Shopify 規格沒有 SKU');
  const claims = await candidateClaims(tx, candidate);
  if (candidateResolutionFingerprint({ shopDomain: input.shopDomain, candidate, claims: claims as CandidateClaim[] }) !== input.expectedFingerprint) {
    throw new CandidateCreateError('STALE', '畫面資料已更新');
  }
  if (claims.some((claim) => claim.status === 'active')) throw new CandidateCreateError('IDENTITY_CONFLICT', `SKU ${sku} 或 Shopify 規格已被其他 HQ 規格使用`);

  const siblings = await tx.shopifyCatalogCandidate.findMany({
    where: { shopifyProductId: candidate.shopifyProductId, resolution: { in: ['linked', 'created'] }, linkedProductId: { not: null } },
    select: { linkedProductId: true },
  });
  const productIds = [...new Set(siblings.flatMap((row) => row.linkedProductId ? [row.linkedProductId] : []))];
  if (productIds.length > 1) throw new CandidateCreateError('PRODUCT_MISMATCH', '同一個 Shopify 商品目前對應到不同 HQ 商品');

  const requestedProductId = input.targetProductId?.trim() || null;
  if (productIds.length === 1 && requestedProductId && productIds[0] !== requestedProductId) {
    throw new CandidateCreateError('PRODUCT_MISMATCH', '同一個 Shopify 商品已確認對應另一個 HQ 商品');
  }

  let productId = productIds[0] ?? requestedProductId;
  let createdProduct = false;
  let effectiveCategory = normalized.category;
  if (productId) {
    if (requestedProductId && productIds.length === 0) {
      const reference = resolveLegacyCatalogReference({
        productTitle: input.source.productTitle,
        variantTitle: input.source.variantTitle,
        shopifyPrice: input.source.price,
      });
      const eligibleProducts = await tx.product.findMany({
        where: { status: { in: ['draft', 'active'] } },
        select: { id: true, name: true },
      });
      const matchingProducts = matchingExistingProducts({
        products: eligibleProducts,
        shopifyProductTitle: input.source.productTitle,
        canonicalProductName: reference.reference?.canonicalName,
      });
      if (matchingProducts.length !== 1 || matchingProducts[0]!.id !== requestedProductId) {
        throw new CandidateCreateError('PRODUCT_MATCH_CHANGED', '同名 HQ 商品不再是唯一一筆，已停止處理');
      }
    }
    const product = await tx.product.findUnique({ where: { id: productId }, select: { id: true, status: true, category: true } });
    if (!product || !['draft', 'active'].includes(product.status)) throw new CandidateCreateError('PRODUCT_UNAVAILABLE', '既有 HQ 商品目前不能安全新增規格');
    effectiveCategory = product.category;
  } else {
    const identity = await allocateNextProductIdentity(tx);
    const baseCost = normalized.mode === 'weight'
      ? costPerUnitFromTierTotal(normalized.cost, normalized.weightGrams!)
      : normalized.cost;
    const product = await tx.product.create({ data: {
      ...identity,
      name: input.source.productTitle,
      category: normalized.category,
      productCategory: 'STANDARD',
      unit: normalized.unit,
      price: input.source.price,
      cost: baseCost,
      reorderPoint: 0,
      status: 'draft',
      vendorId: null,
      commercialTermsVersion: 1,
    }, select: { id: true } });
    productId = product.id;
    createdProduct = true;
  }

  const duplicateSpec = await tx.productPriceTier.findFirst({ where: {
    productId,
    weightGrams: normalized.weightGrams,
    unit: normalized.unit,
    unitQty: normalized.unitQty,
  }, select: { id: true } });
  if (duplicateSpec) throw new CandidateCreateError('SPEC_CONFLICT', 'HQ 商品已有相同規格');

  const tier = await tx.productPriceTier.create({ data: {
    productId,
    weightGrams: normalized.weightGrams,
    unit: normalized.unit,
    unitQty: normalized.unitQty,
    price: input.source.price,
    cost: normalized.cost,
    sku,
    shopifySku: sku,
    shopifyVariantId: canonicalShopifyVariantId(input.source.variantId),
    status: 'active',
  }, select: { id: true } });
  const updated = await tx.shopifyCatalogCandidate.updateMany({
    where: { id: candidate.id, resolution: 'pending' },
    data: { resolution: 'created', linkedProductId: productId, linkedTierId: tier.id, resolvedAt: new Date(), resolvedById: input.actorId },
  });
  if (updated.count !== 1) throw new CandidateCreateError('CONCURRENT', '這筆剛由其他人處理');
  await tx.statusAuditLog.create({ data: {
    entityType: 'shopify_catalog_candidate', entityId: candidate.id, previousStatus: 'pending', newStatus: 'created',
    actorType: 'user', actorId: input.actorId,
    metadataJson: JSON.stringify({ candidateId: candidate.id, shopifyProductId: input.source.productId, shopifyVariantId: input.source.variantId, productId, tierId: tier.id, fingerprint: input.expectedFingerprint, inputDigest: digest, category: effectiveCategory, categoryApplied: createdProduct, matchedExistingProductByName: Boolean(requestedProductId && productIds.length === 0), mode: normalized.mode, packageCost: normalized.cost, weightGrams: normalized.weightGrams, unit: normalized.unit, unitQty: normalized.unitQty }),
  } });
  return { ok: true as const, noop: false as const, productId, tierId: tier.id, createdProduct };
}

type CreateDb = Pick<PrismaClient, '$transaction'>;
export function createCatalogCandidate(db: CreateDb, input: CandidateCreateInput) {
  return (async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await db.$transaction((tx) => createCandidateInTransaction(tx, input), {
          maxWait: 5_000, timeout: 20_000, isolationLevel: 'Serializable',
        });
      } catch (error) {
        lastError = error;
        const target = error instanceof Prisma.PrismaClientKnownRequestError
          ? String(error.meta?.target ?? '') : '';
        const modelName = error instanceof Prisma.PrismaClientKnownRequestError
          ? String(error.meta?.modelName ?? '') : '';
        const identityCollision = error instanceof Prisma.PrismaClientKnownRequestError
          && error.code === 'P2002'
          && modelName === 'Product'
          && (target.includes('productId') || target.includes('sku'));
        const retryable = identityCollision
          || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034');
        if (!retryable || attempt === 2) throw error;
      }
    }
    throw lastError;
  })();
}
