import { createHash } from 'node:crypto';
import type { Prisma, PrismaClient, ShopifyCatalogCandidate } from '@prisma/client';

export const CANDIDATE_BLOCK_REASONS = [
  '停售',
  '測試商品',
  '贈品或組合內容',
  '不由 HQ 履約',
  '其他',
] as const;

export type CandidateBlockReason = (typeof CANDIDATE_BLOCK_REASONS)[number];

type CandidateSnapshot = Pick<
  ShopifyCatalogCandidate,
  | 'id'
  | 'shopifyProductId'
  | 'shopifyVariantId'
  | 'productTitle'
  | 'variantTitle'
  | 'sku'
  | 'price'
  | 'shopifyStatus'
  | 'resolution'
  | 'lastSeenAt'
>;

export type LiveCandidateSource = {
  productId: string;
  variantId: string;
  productTitle: string;
  variantTitle: string;
  sku: string;
  price: number;
  shopifyStatus: string;
};

export type CandidateClaim = {
  id: string;
  productId: string;
  status: string;
  sku: string | null;
  shopifySku: string | null;
  shopifyVariantId: string | null;
  product: { status: string };
};

export type CandidateResolutionCode =
  | 'ALREADY_RESOLVED'
  | 'CANDIDATE_NOT_FOUND'
  | 'SOURCE_CHANGED'
  | 'STALE_FINGERPRINT'
  | 'NO_EXACT_TIER'
  | 'MULTIPLE_EXACT_TIERS'
  | 'TIER_NOT_FOUND'
  | 'TIER_UNAVAILABLE'
  | 'TIER_BOUND_TO_OTHER_VARIANT'
  | 'VARIANT_ALREADY_BOUND'
  | 'PRODUCT_MISMATCH'
  | 'CONCURRENT_MODIFICATION'
  | 'INVALID_BLOCK_REASON'
  | 'BLOCK_NOTE_REQUIRED';

export class CandidateResolutionError extends Error {
  constructor(public readonly code: CandidateResolutionCode, message: string) {
    super(message);
    this.name = 'CandidateResolutionError';
  }
}

const messageByCode: Record<CandidateResolutionCode, string> = {
  ALREADY_RESOLVED: '這筆資料已由其他人處理，請重新整理查看最新結果。',
  CANDIDATE_NOT_FOUND: '找不到這筆 Shopify 待處理商品。',
  SOURCE_CHANGED: 'Shopify 商品剛有更新；為避免套用舊資料，這次沒有修改。請重新整理。',
  STALE_FINGERPRINT: '畫面資料已更新；這次沒有修改。請重新整理後再確認。',
  NO_EXACT_TIER: '目前沒有唯一且 SKU 完全一致的 HQ 規格可連結。',
  MULTIPLE_EXACT_TIERS: '有多個 HQ 規格使用相同 SKU，已停止連結；請先整理重複資料。',
  TIER_NOT_FOUND: '找不到選擇的 HQ 商品規格，請重新整理。',
  TIER_UNAVAILABLE: '選擇的 HQ 商品或規格已停用，不能連結。',
  TIER_BOUND_TO_OTHER_VARIANT: '這個 HQ 規格已連結其他 Shopify 規格。',
  VARIANT_ALREADY_BOUND: '這個 Shopify 規格已連結到另一個 HQ 規格。',
  PRODUCT_MISMATCH: '同一個 Shopify 商品已確認對應另一個 HQ 商品，已停止連結。',
  CONCURRENT_MODIFICATION: '資料剛被其他人更新，這次沒有修改；請重新整理後再試。',
  INVALID_BLOCK_REASON: '請選擇這次不建立的原因。',
  BLOCK_NOTE_REQUIRED: '選擇「其他」時，請填寫原因說明。',
};

export function candidateResolutionMessage(error: unknown) {
  if (error instanceof CandidateResolutionError) return messageByCode[error.code];
  return '這次處理沒有完成，資料沒有被修改；請稍後再試。';
}

export function normalizeCandidateSku(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase() ?? '';
  return normalized || null;
}

export function canonicalShopifyVariantId(value: string) {
  const trimmed = value.trim();
  const tail = trimmed.split('/').pop() ?? '';
  return /^\d+$/.test(tail) ? tail : trimmed;
}

function decimalNumber(value: unknown) {
  return Number(value);
}

function candidateFingerprintPayload(input: {
  shopDomain: string;
  candidate: CandidateSnapshot;
  claims: CandidateClaim[];
}) {
  const { candidate } = input;
  return {
    shopDomain: input.shopDomain.trim().toLowerCase(),
    candidate: {
      id: candidate.id,
      shopifyProductId: candidate.shopifyProductId,
      shopifyVariantId: candidate.shopifyVariantId,
      productTitle: candidate.productTitle,
      variantTitle: candidate.variantTitle,
      sku: normalizeCandidateSku(candidate.sku),
      price: decimalNumber(candidate.price),
      shopifyStatus: candidate.shopifyStatus,
      resolution: candidate.resolution,
      lastSeenAt: candidate.lastSeenAt.toISOString(),
    },
    claims: input.claims
      .map((claim) => ({
        id: claim.id,
        productId: claim.productId,
        status: claim.status,
        productStatus: claim.product.status,
        sku: normalizeCandidateSku(claim.sku),
        shopifySku: normalizeCandidateSku(claim.shopifySku),
        shopifyVariantId: claim.shopifyVariantId?.trim() || null,
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
}

export function candidateResolutionFingerprint(input: {
  shopDomain: string;
  candidate: CandidateSnapshot;
  claims: CandidateClaim[];
}) {
  return createHash('sha256')
    .update(JSON.stringify(candidateFingerprintPayload(input)))
    .digest('hex');
}

export function sourceMatchesCandidate(candidate: CandidateSnapshot, source: LiveCandidateSource) {
  return candidate.shopifyProductId === source.productId
    && candidate.shopifyVariantId === source.variantId
    && candidate.productTitle === source.productTitle
    && candidate.variantTitle === source.variantTitle
    && normalizeCandidateSku(candidate.sku) === normalizeCandidateSku(source.sku)
    && decimalNumber(candidate.price) === source.price
    && candidate.shopifyStatus === source.shopifyStatus;
}

export function sourceRemainsUnmatched(
  source: LiveCandidateSource,
  rows: Array<{ productId: string; variantId: string }>,
) {
  return rows.filter((row) => row.productId === source.productId && row.variantId === source.variantId).length === 1;
}

export function exactAvailableClaims(candidate: CandidateSnapshot, claims: CandidateClaim[]) {
  const sku = normalizeCandidateSku(candidate.sku);
  if (!sku) return [];
  return claims.filter((claim) => {
    const identities = [normalizeCandidateSku(claim.sku), normalizeCandidateSku(claim.shopifySku)]
      .filter((value): value is string => Boolean(value));
    return claim.status === 'active'
      && claim.product.status === 'active'
      && !claim.shopifyVariantId
      && identities.length > 0
      && identities.every((identity) => identity === sku);
  });
}

export function formatBlockedCandidateNote(reason: CandidateBlockReason, note?: string | null) {
  const detail = note?.trim() ?? '';
  return detail ? `[原因:${reason}] ${detail}` : `[原因:${reason}]`;
}

export function parseBlockedCandidateNote(note?: string | null) {
  const match = note?.match(/^\[原因:([^\]]+)\](?:\s+(.*))?$/);
  return match ? { reason: match[1], detail: match[2] ?? '' } : null;
}

function assertBlockReason(reason: string, note?: string | null): CandidateBlockReason {
  if (!(CANDIDATE_BLOCK_REASONS as readonly string[]).includes(reason)) {
    throw new CandidateResolutionError('INVALID_BLOCK_REASON', messageByCode.INVALID_BLOCK_REASON);
  }
  if (reason === '其他' && !note?.trim()) {
    throw new CandidateResolutionError('BLOCK_NOTE_REQUIRED', messageByCode.BLOCK_NOTE_REQUIRED);
  }
  return reason as CandidateBlockReason;
}

type TransactionDb = Prisma.TransactionClient;

async function candidateClaims(tx: TransactionDb, candidate: CandidateSnapshot) {
  const sku = candidate.sku?.trim() || '__NO_SKU__';
  const canonicalVariantId = canonicalShopifyVariantId(candidate.shopifyVariantId);
  return tx.productPriceTier.findMany({
    where: {
      OR: [
        { shopifyVariantId: { in: [candidate.shopifyVariantId, canonicalVariantId] } },
        { sku: { equals: sku, mode: 'insensitive' } },
        { shopifySku: { equals: sku, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      productId: true,
      status: true,
      sku: true,
      shopifySku: true,
      shopifyVariantId: true,
      product: { select: { status: true } },
    },
  });
}

async function confirmedProductIds(tx: TransactionDb, candidate: CandidateSnapshot) {
  const rows = await tx.shopifyCatalogCandidate.findMany({
    where: {
      shopifyProductId: candidate.shopifyProductId,
      resolution: 'linked',
      linkedProductId: { not: null },
    },
    select: { linkedProductId: true },
  });
  return new Set(rows.flatMap((row) => row.linkedProductId ? [row.linkedProductId] : []));
}

function assertFresh(input: {
  shopDomain: string;
  candidate: CandidateSnapshot;
  claims: CandidateClaim[];
  expectedFingerprint: string;
  source: LiveCandidateSource;
}) {
  if (!sourceMatchesCandidate(input.candidate, input.source)) {
    throw new CandidateResolutionError('SOURCE_CHANGED', messageByCode.SOURCE_CHANGED);
  }
  if (candidateResolutionFingerprint(input) !== input.expectedFingerprint) {
    throw new CandidateResolutionError('STALE_FINGERPRINT', messageByCode.STALE_FINGERPRINT);
  }
}

export async function linkCandidateInTransaction(
  tx: TransactionDb,
  input: {
    candidateId: string;
    tierId: string;
    expectedFingerprint: string;
    shopDomain: string;
    source: LiveCandidateSource;
    actorId: string;
  },
) {
  const candidate = await tx.shopifyCatalogCandidate.findUnique({ where: { id: input.candidateId } });
  if (!candidate) throw new CandidateResolutionError('CANDIDATE_NOT_FOUND', messageByCode.CANDIDATE_NOT_FOUND);
  if (candidate.resolution === 'linked' && candidate.linkedTierId === input.tierId) {
    return { ok: true as const, noop: true as const, productId: candidate.linkedProductId };
  }
  if (candidate.resolution !== 'pending') {
    throw new CandidateResolutionError('ALREADY_RESOLVED', messageByCode.ALREADY_RESOLVED);
  }

  const claims = await candidateClaims(tx, candidate);
  assertFresh({ ...input, candidate, claims });
  const exact = exactAvailableClaims(candidate, claims);
  if (exact.length === 0) throw new CandidateResolutionError('NO_EXACT_TIER', messageByCode.NO_EXACT_TIER);
  if (exact.length > 1) throw new CandidateResolutionError('MULTIPLE_EXACT_TIERS', messageByCode.MULTIPLE_EXACT_TIERS);
  const tier = exact[0]!;
  if (tier.id !== input.tierId) throw new CandidateResolutionError('TIER_NOT_FOUND', messageByCode.TIER_NOT_FOUND);
  if (tier.status !== 'active' || tier.product.status !== 'active') {
    throw new CandidateResolutionError('TIER_UNAVAILABLE', messageByCode.TIER_UNAVAILABLE);
  }
  const canonicalVariantId = canonicalShopifyVariantId(candidate.shopifyVariantId);
  if (tier.shopifyVariantId) {
    throw new CandidateResolutionError('TIER_BOUND_TO_OTHER_VARIANT', messageByCode.TIER_BOUND_TO_OTHER_VARIANT);
  }
  const products = await confirmedProductIds(tx, candidate);
  if (products.size > 1 || (products.size === 1 && !products.has(tier.productId))) {
    throw new CandidateResolutionError('PRODUCT_MISMATCH', messageByCode.PRODUCT_MISMATCH);
  }
  if (claims.some((claim) => claim.id !== tier.id
    && claim.shopifyVariantId
    && canonicalShopifyVariantId(claim.shopifyVariantId) === canonicalVariantId)) {
    throw new CandidateResolutionError('VARIANT_ALREADY_BOUND', messageByCode.VARIANT_ALREADY_BOUND);
  }

  const tierUpdate = await tx.productPriceTier.updateMany({
    where: {
      id: tier.id,
      status: 'active',
      shopifyVariantId: null,
    },
    data: {
      shopifyVariantId: canonicalVariantId,
      shopifySku: candidate.sku,
    },
  });
  if (tierUpdate.count !== 1) {
    throw new CandidateResolutionError('CONCURRENT_MODIFICATION', messageByCode.CONCURRENT_MODIFICATION);
  }
  const candidateUpdate = await tx.shopifyCatalogCandidate.updateMany({
    where: { id: candidate.id, resolution: 'pending' },
    data: {
      resolution: 'linked',
      linkedProductId: tier.productId,
      linkedTierId: tier.id,
      resolvedAt: new Date(),
      resolvedById: input.actorId,
    },
  });
  if (candidateUpdate.count !== 1) {
    throw new CandidateResolutionError('CONCURRENT_MODIFICATION', messageByCode.CONCURRENT_MODIFICATION);
  }
  await tx.statusAuditLog.create({
    data: {
      entityType: 'shopify_catalog_candidate',
      entityId: candidate.id,
      previousStatus: 'pending',
      newStatus: 'linked',
      actorType: 'user',
      actorId: input.actorId,
      metadataJson: JSON.stringify({ tierId: tier.id, productId: tier.productId, fingerprint: input.expectedFingerprint }),
    },
  });
  return { ok: true as const, noop: false as const, productId: tier.productId };
}

export async function blockCandidateInTransaction(
  tx: TransactionDb,
  input: {
    candidateId: string;
    reason: string;
    note?: string | null;
    expectedFingerprint: string;
    shopDomain: string;
    source: LiveCandidateSource;
    actorId: string;
  },
) {
  const reason = assertBlockReason(input.reason, input.note);
  const candidate = await tx.shopifyCatalogCandidate.findUnique({ where: { id: input.candidateId } });
  if (!candidate) throw new CandidateResolutionError('CANDIDATE_NOT_FOUND', messageByCode.CANDIDATE_NOT_FOUND);
  const notes = formatBlockedCandidateNote(reason, input.note);
  if (candidate.resolution === 'blocked' && candidate.notes === notes) return { ok: true as const, noop: true as const };
  if (candidate.resolution !== 'pending') {
    throw new CandidateResolutionError('ALREADY_RESOLVED', messageByCode.ALREADY_RESOLVED);
  }
  const claims = await candidateClaims(tx, candidate);
  assertFresh({ ...input, candidate, claims });
  const result = await tx.shopifyCatalogCandidate.updateMany({
    where: { id: candidate.id, resolution: 'pending' },
    data: {
      resolution: 'blocked',
      resolvedAt: new Date(),
      resolvedById: input.actorId,
      notes,
    },
  });
  if (result.count !== 1) {
    throw new CandidateResolutionError('CONCURRENT_MODIFICATION', messageByCode.CONCURRENT_MODIFICATION);
  }
  await tx.statusAuditLog.create({
    data: {
      entityType: 'shopify_catalog_candidate',
      entityId: candidate.id,
      previousStatus: 'pending',
      newStatus: 'blocked',
      actorType: 'user',
      actorId: input.actorId,
      metadataJson: JSON.stringify({ reason, fingerprint: input.expectedFingerprint }),
    },
  });
  return { ok: true as const, noop: false as const };
}

type ResolutionDb = Pick<PrismaClient, '$transaction'>;

export async function linkCatalogCandidate(
  db: ResolutionDb,
  input: Parameters<typeof linkCandidateInTransaction>[1],
) {
  return db.$transaction((tx) => linkCandidateInTransaction(tx, input), {
    maxWait: 5_000,
    timeout: 20_000,
    isolationLevel: 'Serializable',
  });
}

export async function blockCatalogCandidate(
  db: ResolutionDb,
  input: Parameters<typeof blockCandidateInTransaction>[1],
) {
  return db.$transaction((tx) => blockCandidateInTransaction(tx, input), {
    maxWait: 5_000,
    timeout: 20_000,
    isolationLevel: 'Serializable',
  });
}
