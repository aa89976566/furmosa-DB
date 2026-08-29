'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import {
  IDENTITY_VERDICTS,
  OTHER_RECORD_DISPOSITIONS,
  type OtherRecordDisposition,
  type PartnerStoreIdentityVerdict,
} from '@/lib/jar-exchange/partner-store-identity-decisions';
import { ensurePreviewIdentityTable } from '@/lib/jar-exchange/partner-store-identity-preview';
import {
  createIdentityDecision,
  revokeIdentityDecision,
} from '@/lib/jar-exchange/partner-store-identity-store';

function revalidateStores() {
  revalidatePath('/jar-exchange/stores');
}

export async function savePartnerStoreIdentityDecision(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: '請先登入總部帳號' };
  await ensurePreviewIdentityTable();

  const verdict = String(formData.get('verdict') ?? '').trim() as PartnerStoreIdentityVerdict;
  const disposition = String(
    formData.get('otherRecordDisposition') ?? 'keep_legacy_link',
  ).trim() as OtherRecordDisposition;

  if (!IDENTITY_VERDICTS.includes(verdict)) {
    return { ok: false as const, error: '判定必須是同一門市、測試或示範' };
  }
  if (!OTHER_RECORD_DISPOSITIONS.includes(disposition)) {
    return { ok: false as const, error: '另一筆處理方式不正確' };
  }

  const result = await createIdentityDecision({
    merchantId: String(formData.get('merchantId') ?? ''),
    legacySlug: String(formData.get('legacySlug') ?? '') || null,
    verdict,
    decidedByUserId: user.userId,
    decidedByAccount: user.email,
    rationale: String(formData.get('rationale') ?? ''),
    otherRecordDisposition: disposition,
  });
  if (result.ok) revalidateStores();
  return result.ok ? { ok: true as const } : result;
}

export async function revokePartnerStoreIdentityDecision(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: '請先登入總部帳號' };
  await ensurePreviewIdentityTable();

  const result = await revokeIdentityDecision({
    id: String(formData.get('decisionId') ?? ''),
    revokedByUserId: user.userId,
    revokedByAccount: user.email,
    revokeReason: String(formData.get('revokeReason') ?? ''),
  });
  if (result.ok) revalidateStores();
  return result.ok ? { ok: true as const } : result;
}
