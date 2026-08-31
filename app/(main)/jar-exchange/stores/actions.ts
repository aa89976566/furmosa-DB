'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import {
  createApprovedIdentityDecisionsAtomically,
  createIdentityDecision,
  revokeIdentityDecision,
} from '@/lib/jar-exchange/partner-store-identity-store';
import { APPROVED_PARTNER_STORE_PAIRS } from '@/lib/jar-exchange/partner-store-approved-five';
import {
  LIMITED_ROLLOUT_MERCHANT_ID,
  denyIdentityWrite,
} from '@/lib/jar-exchange/partner-store-identity-write-guard';

export type IdentityWriteActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; reason?: string };

function revalidateStores() {
  revalidatePath('/jar-exchange/stores');
}

export async function createDemoIdentityDecision(): Promise<IdentityWriteActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: '請先登入總部帳號', reason: 'unauthenticated' };
  const blocked = denyIdentityWrite('confirm', process.env, user.email);
  if (blocked) return blocked;

  const result = await createIdentityDecision({
    merchantId: LIMITED_ROLLOUT_MERCHANT_ID,
    legacySlug: null,
    verdict: 'demo',
    decidedByUserId: user.userId,
    decidedByAccount: user.email,
    rationale: '第三層小範圍上線：只驗證 MER-DEMO 測試／示範判定，不寫五家真店。',
    otherRecordDisposition: 'keep_legacy_link',
    scope: 'production',
  });
  if (!result.ok) return { ok: false, error: result.error };
  revalidateStores();
  return { ok: true, id: result.decision.id };
}

export async function createApprovedFiveIdentityDecisions(): Promise<IdentityWriteActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: '請先登入總部帳號', reason: 'unauthenticated' };
  const blocked = denyIdentityWrite('confirm', process.env, user.email);
  if (blocked) return blocked;

  const result = await createApprovedIdentityDecisionsAtomically({
    decisions: APPROVED_PARTNER_STORE_PAIRS,
    decidedByUserId: user.userId,
    decidedByAccount: user.email,
    env: process.env,
  });
  if (!result.ok) return { ok: false, error: result.error };
  revalidateStores();
  return { ok: true };
}

export async function revokeDemoIdentityDecision(
  id: string,
  revokeReason: string,
): Promise<IdentityWriteActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: '請先登入總部帳號', reason: 'unauthenticated' };
  const blocked = denyIdentityWrite('revoke', process.env, user.email);
  if (blocked) return blocked;

  const result = await revokeIdentityDecision({
    id,
    revokedByUserId: user.userId,
    revokedByAccount: user.email,
    revokeReason,
  });
  if (!result.ok) return { ok: false, error: result.error };
  revalidateStores();
  return { ok: true, id: result.decision.id };
}
