import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  IDENTITY_VERDICTS,
  OTHER_RECORD_DISPOSITIONS,
  activeHumanDecisions,
  identityDecisionScope,
  type OtherRecordDisposition,
  type PartnerStoreHumanDecision,
  type PartnerStoreIdentityScope,
  type PartnerStoreIdentityVerdict,
} from '@/lib/jar-exchange/partner-store-identity-decisions';
import {
  denyIdentityWrite,
  denyMerchantWrite,
  type IdentityWriteEnv,
} from '@/lib/jar-exchange/partner-store-identity-write-guard';

const decisionInclude = {
  decidedBy: { select: { id: true, email: true, name: true } },
  revokedBy: { select: { id: true, email: true, name: true } },
} satisfies Prisma.PartnerStoreIdentityDecisionInclude;

type DecisionRow = Prisma.PartnerStoreIdentityDecisionGetPayload<{
  include: typeof decisionInclude;
}>;

function isMissingIdentityTableError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const code = (error as { code?: string }).code;
    if (code === 'P2021' || code === 'P2010') return true;
  }
  const msg = error instanceof Error ? error.message : String(error);
  return (
    /partner_store_identity_decisions/i.test(msg) &&
    (/does not exist/i.test(msg) || /P2021/.test(msg))
  );
}

export function mapIdentityDecisionRow(row: DecisionRow): PartnerStoreHumanDecision {
  return {
    id: row.id,
    merchantId: row.merchantId,
    legacySlug: row.legacySlug,
    verdict: row.verdict as PartnerStoreIdentityVerdict,
    decidedByUserId: row.decidedByUserId,
    decidedByAccount: row.decidedBy.email,
    decidedByName: row.decidedBy.name,
    decidedAt: row.decidedAt.toISOString(),
    rationale: row.rationale,
    otherRecordDisposition: row.otherRecordDisposition as OtherRecordDisposition,
    createdAt: row.createdAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
    revokedByUserId: row.revokedByUserId,
    revokedByAccount: row.revokedBy?.email ?? null,
    revokeReason: row.revokeReason,
    scope: row.scope as PartnerStoreIdentityScope,
  };
}

export async function listIdentityDecisions(
  scope: PartnerStoreIdentityScope = identityDecisionScope(),
): Promise<PartnerStoreHumanDecision[]> {
  try {
    const rows = await prisma.partnerStoreIdentityDecision.findMany({
      where: { scope },
      include: decisionInclude,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map(mapIdentityDecisionRow);
  } catch (error) {
    if (isMissingIdentityTableError(error)) return [];
    throw error;
  }
}

export async function createIdentityDecision(input: {
  merchantId: string;
  legacySlug: string | null;
  verdict: PartnerStoreIdentityVerdict;
  decidedByUserId: string;
  decidedByAccount: string;
  decidedAt?: Date;
  rationale: string;
  otherRecordDisposition: OtherRecordDisposition;
  scope?: PartnerStoreIdentityScope;
  env?: IdentityWriteEnv;
}): Promise<{ ok: true; decision: PartnerStoreHumanDecision } | { ok: false; error: string }> {
  const blocked = denyIdentityWrite('confirm', input.env, input.decidedByAccount);
  if (blocked) return { ok: false, error: blocked.error };
  const targetBlocked = denyMerchantWrite(input.merchantId, input.env);
  if (targetBlocked) return { ok: false, error: targetBlocked.error };

  const merchantId = input.merchantId.trim().toUpperCase();
  const legacySlug = input.legacySlug?.trim().toLowerCase() || null;
  const rationale = input.rationale.trim();
  const scope = input.scope ?? identityDecisionScope();
  const decidedAt = input.decidedAt ?? new Date();

  if (!rationale || !input.decidedByUserId.trim() || !input.decidedByAccount.trim()) {
    return { ok: false, error: '確認必須有帳號、時間與依據' };
  }
  if (!IDENTITY_VERDICTS.includes(input.verdict)) {
    return { ok: false, error: '判定必須是同一門市、測試或示範' };
  }
  if (!OTHER_RECORD_DISPOSITIONS.includes(input.otherRecordDisposition)) {
    return { ok: false, error: '另一筆處理方式不正確' };
  }
  if (input.verdict === 'same_store' && !legacySlug) {
    return { ok: false, error: '同一門市必須填舊核銷 slug' };
  }

  const existing = await listIdentityDecisions(scope);
  const active = activeHumanDecisions(existing);
  if (active.some((row) => row.merchantId.toUpperCase() === merchantId)) {
    return { ok: false, error: `${merchantId} 已有未撤銷的確認` };
  }

  try {
    const row = await prisma.partnerStoreIdentityDecision.create({
      data: {
        merchantId,
        legacySlug,
        verdict: input.verdict,
        decidedByUserId: input.decidedByUserId,
        decidedAt,
        rationale,
        otherRecordDisposition: input.otherRecordDisposition,
        scope,
      },
      include: decisionInclude,
    });
    return { ok: true, decision: mapIdentityDecisionRow(row) };
  } catch (error) {
    if (isMissingIdentityTableError(error)) {
      return { ok: false, error: '確認紀錄表尚未建立' };
    }
    throw error;
  }
}

export async function createApprovedIdentityDecisionsAtomically(input: {
  decisions: ReadonlyArray<{
    merchantId: string;
    legacySlug: string;
    rationale: string;
  }>;
  decidedByUserId: string;
  decidedByAccount: string;
  decidedAt?: Date;
  env?: IdentityWriteEnv;
}): Promise<{ ok: true; decisions: PartnerStoreHumanDecision[] } | { ok: false; error: string }> {
  const blocked = denyIdentityWrite('confirm', input.env, input.decidedByAccount);
  if (blocked) return { ok: false, error: blocked.error };
  if (input.decisions.length === 0) return { ok: false, error: '沒有要確認的店家' };

  const normalized = input.decisions.map((decision) => ({
    merchantId: decision.merchantId.trim().toUpperCase(),
    legacySlug: decision.legacySlug.trim().toLowerCase(),
    rationale: decision.rationale.trim(),
  }));
  const merchantIds = normalized.map((decision) => decision.merchantId);
  const legacySlugs = normalized.map((decision) => decision.legacySlug);
  if (
    new Set(merchantIds).size !== normalized.length ||
    new Set(legacySlugs).size !== normalized.length
  ) {
    return { ok: false, error: '批次內的 MER 或 slug 重複' };
  }
  if (normalized.some((decision) => !decision.rationale)) {
    return { ok: false, error: '每家店都必須留下確認依據' };
  }
  for (const merchantId of merchantIds) {
    const targetBlocked = denyMerchantWrite(merchantId, input.env);
    if (targetBlocked) return { ok: false, error: targetBlocked.error };
  }

  const scope: PartnerStoreIdentityScope = 'production';
  const decidedAt = input.decidedAt ?? new Date();

  try {
    const rows = await prisma.$transaction(async (tx) => {
      const [merchants, stores, conflicts] = await Promise.all([
        tx.merchant.findMany({
          where: { merchantId: { in: merchantIds } },
          select: { merchantId: true },
        }),
        tx.store.findMany({
          where: { slug: { in: legacySlugs } },
          select: { slug: true },
        }),
        tx.partnerStoreIdentityDecision.findMany({
          where: {
            scope,
            revokedAt: null,
            OR: [
              { merchantId: { in: merchantIds } },
              { legacySlug: { in: legacySlugs } },
            ],
          },
          select: { merchantId: true, legacySlug: true },
        }),
      ]);
      if (merchants.length !== normalized.length || stores.length !== normalized.length) {
        throw new Error('正式主檔或舊核銷店缺少，整批未寫入');
      }
      if (conflicts.length > 0) throw new Error('已有有效判定或對應衝突，整批未寫入');

      const created = await tx.partnerStoreIdentityDecision.createMany({
        data: normalized.map((decision) => ({
          merchantId: decision.merchantId,
          legacySlug: decision.legacySlug,
          verdict: 'same_store',
          decidedByUserId: input.decidedByUserId,
          decidedAt,
          rationale: decision.rationale,
          otherRecordDisposition: 'keep_legacy_link',
          scope,
        })),
      });
      if (created.count !== normalized.length) throw new Error('五家店未完整建立，整批未寫入');

      return tx.partnerStoreIdentityDecision.findMany({
        where: { scope, revokedAt: null, merchantId: { in: merchantIds } },
        include: decisionInclude,
        orderBy: { merchantId: 'asc' },
      });
    }, { maxWait: 10_000, timeout: 30_000 });
    return { ok: true, decisions: rows.map(mapIdentityDecisionRow) };
  } catch (error) {
    if (isMissingIdentityTableError(error)) return { ok: false, error: '確認紀錄表尚未建立' };
    return { ok: false, error: error instanceof Error ? error.message : '五家店整批寫入失敗' };
  }
}

export async function revokeIdentityDecision(input: {
  id: string;
  revokedByUserId: string;
  revokedByAccount: string;
  revokeReason: string;
  revokedAt?: Date;
  env?: IdentityWriteEnv;
}): Promise<{ ok: true; decision: PartnerStoreHumanDecision } | { ok: false; error: string }> {
  const blocked = denyIdentityWrite('revoke', input.env, input.revokedByAccount);
  if (blocked) return { ok: false, error: blocked.error };
  const reason = input.revokeReason.trim();
  if (!reason) return { ok: false, error: '撤銷必須填原因' };

  try {
    const current = await prisma.partnerStoreIdentityDecision.findUnique({
      where: { id: input.id },
      include: decisionInclude,
    });
    if (!current) return { ok: false, error: '找不到這筆確認' };
    const targetBlocked = denyMerchantWrite(current.merchantId, input.env);
    if (targetBlocked) return { ok: false, error: targetBlocked.error };
    if (current.revokedAt) return { ok: false, error: '這筆確認已經撤銷' };

    const row = await prisma.partnerStoreIdentityDecision.update({
      where: { id: input.id },
      data: {
        revokedAt: input.revokedAt ?? new Date(),
        revokedByUserId: input.revokedByUserId,
        revokeReason: reason,
      },
      include: decisionInclude,
    });
    return { ok: true, decision: mapIdentityDecisionRow(row) };
  } catch (error) {
    if (isMissingIdentityTableError(error)) {
      return { ok: false, error: '確認紀錄表尚未建立' };
    }
    throw error;
  }
}
