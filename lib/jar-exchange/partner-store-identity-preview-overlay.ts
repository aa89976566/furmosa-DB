/**
 * Preview 只讀對照。只用來顯示總部已鎖定的五家店與測試店排除，
 * 不會寫入資料庫，也不得當成正式確認紀錄。
 */
import { PREVIEW_ACCEPTANCE_ROWS } from '@/lib/jar-exchange/partner-store-identity-acceptance-rows';
import {
  isPreviewIdentityEnv,
  shouldInsertBootstrapDecision,
  type PartnerStoreHumanDecision,
} from '@/lib/jar-exchange/partner-store-identity-decisions';

export const PREVIEW_OVERLAY_ACCOUNT = '總部已鎖定對照（未寫入）';

export function isPreviewOverlayDecision(
  decision: Pick<PartnerStoreHumanDecision, 'id' | 'displayOnly' | 'decidedByAccount'>,
): boolean {
  return (
    decision.displayOnly === true ||
    decision.id.startsWith('preview-overlay:') ||
    decision.decidedByAccount === PREVIEW_OVERLAY_ACCOUNT
  );
}

export function withPreviewReadOnlyOverlay(
  records: PartnerStoreHumanDecision[],
  env: string | undefined = process.env.VERCEL_ENV,
): PartnerStoreHumanDecision[] {
  if (!isPreviewIdentityEnv(env)) return records;
  const extras: PartnerStoreHumanDecision[] = [];
  for (const row of PREVIEW_ACCEPTANCE_ROWS) {
    if (
      !shouldInsertBootstrapDecision(records, {
        merchantId: row.merchantId,
        legacySlug: row.legacySlug,
        scope: 'production',
      })
    ) {
      continue;
    }
    extras.push({
      id: `preview-overlay:${row.merchantId}:${row.legacySlug ?? 'none'}`,
      merchantId: row.merchantId,
      legacySlug: row.legacySlug,
      verdict: row.verdict,
      decidedByUserId: 'preview-overlay',
      decidedByAccount: PREVIEW_OVERLAY_ACCOUNT,
      decidedByName: '預覽對照',
      decidedAt: '2026-08-29T00:00:00.000Z',
      rationale: row.rationale,
      otherRecordDisposition: 'keep_legacy_link',
      createdAt: '2026-08-29T00:00:00.000Z',
      revokedAt: null,
      revokedByUserId: null,
      revokedByAccount: null,
      revokeReason: null,
      scope: 'production',
      displayOnly: true,
    });
  }
  return [...records, ...extras];
}
