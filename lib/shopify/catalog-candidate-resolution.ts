import type { Prisma, PrismaClient } from '@prisma/client';

export const CANDIDATE_BLOCK_REASONS = [
  '非販售品',
  '贈品',
  '組合包',
  '測試商品',
  '其他',
] as const;

export type CandidateBlockReason = (typeof CANDIDATE_BLOCK_REASONS)[number];

export type CandidateResolutionCode =
  | 'ALREADY_RESOLVED'
  | 'CANDIDATE_NOT_FOUND'
  | 'TIER_NOT_FOUND'
  | 'TIER_UNAVAILABLE'
  | 'TIER_BOUND_TO_OTHER_VARIANT'
  | 'VARIANT_ALREADY_BOUND'
  | 'SKU_ALREADY_BOUND'
  | 'SKU_MISMATCH'
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
  TIER_NOT_FOUND: '找不到選擇的 HQ 商品規格，請重新搜尋。',
  TIER_UNAVAILABLE: '選擇的 HQ 商品或規格已停用，請改選其他規格。',
  TIER_BOUND_TO_OTHER_VARIANT: '這個 HQ 規格已連結其他 Shopify 規格，請改選其他規格。',
  VARIANT_ALREADY_BOUND: '這個 Shopify 規格已連結到另一個 HQ 規格，不能重複連結。',
  SKU_ALREADY_BOUND: '這個 Shopify SKU 已由另一個 HQ 規格使用，請先確認正確對應。',
  SKU_MISMATCH: 'Shopify SKU 與所選 HQ 規格不同，系統不會自動覆寫；請改選正確規格。',
  CONCURRENT_MODIFICATION: '資料剛被其他人更新，這次沒有修改；請重新整理後再試。',
  INVALID_BLOCK_REASON: '請選擇不需建立的原因。',
  BLOCK_NOTE_REQUIRED: '選擇「其他」時，請填寫原因說明。',
};

export function candidateResolutionMessage(error: unknown) {
  if (error instanceof CandidateResolutionError) return messageByCode[error.code];
  return '這次處理沒有完成，資料沒有被修改；請稍後再試。';
}

export function formatBlockedCandidateNote(reason: CandidateBlockReason, note?: string | null) {
  const detail = note?.trim() ?? '';
  return detail ? `[原因:${reason}] ${detail}` : `[原因:${reason}]`;
}

export function parseBlockedCandidateNote(note?: string | null) {
  const match = note?.match(/^\[原因:([^\]]+)\](?:\s+(.*))?$/);
  return match ? { reason: match[1], detail: match[2] ?? '' } : null;
}

type TransactionDb = Prisma.TransactionClient;

function normalized(value: string | null | undefined) {
  const result = value?.trim().toLocaleLowerCase('en-US') ?? '';
  return result || null;
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

async function acquireVariantLock(tx: TransactionDb, variantId: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'shopify-variant:' + variantId}))`;
}

export async function linkCandidateInTransaction(
  tx: TransactionDb,
  input: { candidateId: string; tierId: string; notes?: string | null; actorId: string },
) {
  const candidate = await tx.shopifyCatalogCandidate.findUnique({
    where: { id: input.candidateId },
  });
  if (!candidate) {
    throw new CandidateResolutionError('CANDIDATE_NOT_FOUND', messageByCode.CANDIDATE_NOT_FOUND);
  }
  if (candidate.resolution === 'linked' && candidate.linkedTierId === input.tierId) {
    return { ok: true as const, noop: true as const, productId: candidate.linkedProductId };
  }
  if (candidate.resolution !== 'pending') {
    throw new CandidateResolutionError('ALREADY_RESOLVED', messageByCode.ALREADY_RESOLVED);
  }

  await acquireVariantLock(tx, candidate.shopifyVariantId);

  const tier = await tx.productPriceTier.findUnique({
    where: { id: input.tierId },
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
  if (!tier) throw new CandidateResolutionError('TIER_NOT_FOUND', messageByCode.TIER_NOT_FOUND);
  if (tier.status !== 'active' || tier.product.status !== 'active') {
    throw new CandidateResolutionError('TIER_UNAVAILABLE', messageByCode.TIER_UNAVAILABLE);
  }
  if (tier.shopifyVariantId && tier.shopifyVariantId !== candidate.shopifyVariantId) {
    throw new CandidateResolutionError(
      'TIER_BOUND_TO_OTHER_VARIANT',
      messageByCode.TIER_BOUND_TO_OTHER_VARIANT,
    );
  }

  const candidateSku = normalized(candidate.sku);
  const tierSku = normalized(tier.sku);
  const tierShopifySku = normalized(tier.shopifySku);
  if (candidateSku && tierShopifySku && candidateSku !== tierShopifySku) {
    throw new CandidateResolutionError('SKU_MISMATCH', messageByCode.SKU_MISMATCH);
  }
  if (candidateSku && tierSku && candidateSku !== tierSku) {
    throw new CandidateResolutionError('SKU_MISMATCH', messageByCode.SKU_MISMATCH);
  }

  const identityConflicts = await tx.productPriceTier.findMany({
    where: {
      id: { not: tier.id },
      status: 'active',
      OR: [
        { shopifyVariantId: candidate.shopifyVariantId },
        ...(candidateSku
          ? [
              { sku: { equals: candidate.sku!, mode: 'insensitive' as const } },
              { shopifySku: { equals: candidate.sku!, mode: 'insensitive' as const } },
            ]
          : []),
      ],
    },
    select: { shopifyVariantId: true, sku: true, shopifySku: true },
  });
  if (identityConflicts.some((row) => row.shopifyVariantId === candidate.shopifyVariantId)) {
    throw new CandidateResolutionError('VARIANT_ALREADY_BOUND', messageByCode.VARIANT_ALREADY_BOUND);
  }
  if (
    candidateSku
    && identityConflicts.some((row) => [normalized(row.sku), normalized(row.shopifySku)].includes(candidateSku))
  ) {
    throw new CandidateResolutionError('SKU_ALREADY_BOUND', messageByCode.SKU_ALREADY_BOUND);
  }

  const tierUpdate = await tx.productPriceTier.updateMany({
    where: {
      id: tier.id,
      status: 'active',
      OR: [
        { shopifyVariantId: null },
        { shopifyVariantId: candidate.shopifyVariantId },
      ],
    },
    data: {
      shopifyVariantId: candidate.shopifyVariantId,
      ...(tier.shopifySku || !candidate.sku ? {} : { shopifySku: candidate.sku }),
    },
  });
  if (tierUpdate.count !== 1) {
    throw new CandidateResolutionError(
      'CONCURRENT_MODIFICATION',
      messageByCode.CONCURRENT_MODIFICATION,
    );
  }

  const candidateUpdate = await tx.shopifyCatalogCandidate.updateMany({
    where: { id: candidate.id, resolution: 'pending' },
    data: {
      resolution: 'linked',
      linkedProductId: tier.productId,
      linkedTierId: tier.id,
      resolvedAt: new Date(),
      resolvedById: input.actorId,
      notes: input.notes?.trim() || null,
    },
  });
  if (candidateUpdate.count !== 1) {
    throw new CandidateResolutionError(
      'CONCURRENT_MODIFICATION',
      messageByCode.CONCURRENT_MODIFICATION,
    );
  }

  await tx.statusAuditLog.create({
    data: {
      entityType: 'shopify_catalog_candidate',
      entityId: candidate.id,
      previousStatus: 'pending',
      newStatus: 'linked',
      actorType: 'user',
      actorId: input.actorId,
      metadataJson: JSON.stringify({ tierId: tier.id, productId: tier.productId }),
    },
  });

  return { ok: true as const, noop: false as const, productId: tier.productId };
}

export async function blockCandidateInTransaction(
  tx: TransactionDb,
  input: { candidateId: string; reason: string; note?: string | null; actorId: string },
) {
  const reason = assertBlockReason(input.reason, input.note);
  const candidate = await tx.shopifyCatalogCandidate.findUnique({
    where: { id: input.candidateId },
    select: { id: true, resolution: true },
  });
  if (!candidate) {
    throw new CandidateResolutionError('CANDIDATE_NOT_FOUND', messageByCode.CANDIDATE_NOT_FOUND);
  }
  if (candidate.resolution !== 'pending') {
    throw new CandidateResolutionError('ALREADY_RESOLVED', messageByCode.ALREADY_RESOLVED);
  }

  const notes = formatBlockedCandidateNote(reason, input.note);
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
    throw new CandidateResolutionError(
      'CONCURRENT_MODIFICATION',
      messageByCode.CONCURRENT_MODIFICATION,
    );
  }

  await tx.statusAuditLog.create({
    data: {
      entityType: 'shopify_catalog_candidate',
      entityId: candidate.id,
      previousStatus: 'pending',
      newStatus: 'blocked',
      actorType: 'user',
      actorId: input.actorId,
      metadataJson: JSON.stringify({ reason }),
    },
  });
  return { ok: true as const };
}

type ResolutionDb = Pick<PrismaClient, '$transaction'>;

export async function linkCatalogCandidate(
  db: ResolutionDb,
  input: { candidateId: string; tierId: string; notes?: string | null; actorId: string },
) {
  return db.$transaction((tx) => linkCandidateInTransaction(tx, input), {
    maxWait: 5_000,
    timeout: 20_000,
  });
}

export async function blockCatalogCandidate(
  db: ResolutionDb,
  input: { candidateId: string; reason: string; note?: string | null; actorId: string },
) {
  return db.$transaction((tx) => blockCandidateInTransaction(tx, input), {
    maxWait: 5_000,
    timeout: 20_000,
  });
}
