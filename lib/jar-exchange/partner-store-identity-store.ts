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
