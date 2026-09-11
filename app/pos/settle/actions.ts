'use server';

import { prisma } from '@/lib/prisma';
import { requireMerchantSession } from '@/lib/merchant-auth';
import { parseTaipeiDateRange } from '@/lib/taipei-date';
import { loadStoreLedger } from '@/lib/pos/load-store-ledger';
import {
  payerFromDirection,
  persistStoreSettlement,
  resolveRequestedPaymentMethod,
  submittedSettlementMessage,
  withdrawStoreSettlement,
} from '@/lib/pos/store-settlement';
import {
  buildSettlementDraft,
  settlementReadiness,
  settlementWriteEnabled,
} from '@/lib/settlements/write-settlement';
import { computeLegacyTotals } from '@/lib/settlements/source-snapshot';
import { countVoidedAttempts } from '@/lib/settlements/read-snapshot';

export type ConfirmSettleResult =
  | {
      ok: true;
      /** 已存在的同一張結算，重送不會產生第二張。 */
      duplicate: boolean;
      settlementNo: string;
      status: string;
      netPayableTwd: number;
      message: string;
    }
  | { ok: false; error: string };

export async function confirmStoreSettlementAction(input: {
  from: string;
  to: string;
  /**
   * 穩定的結帳方式代碼（不是畫面文字）。
   * UI 文字不得作為程式判斷依據，改字或換語言都不該影響冪等 key。
   */
  paymentMethod: string;
  /** 畫面上那份暫計的指紋。與伺服器重算不符即拒絕，不靜默改變整批內容。 */
  preview: {
    sourceKeysDigest: string;
    amountsDigest: string;
    idempotencyKey: string;
    payloadFingerprint: string;
  };
}): Promise<ConfirmSettleResult> {
  const session = await requireMerchantSession();
  const range = parseTaipeiDateRange(input.from, input.to);
  if (!range) {
    return { ok: false, error: '期間日期不正確。' };
  }

  // 金額一律由伺服器重算，不採用瀏覽器傳入的任何數字。
  const { sources, lockStateAvailable } = await loadStoreLedger({
    merchantId: session.merchantId,
    periodStart: range.start,
    periodEnd: range.end,
  });

  try {
    const attempts = await countVoidedAttempts(
      prisma,
      session.merchantId,
      sources.map((source) => source.sourceKey),
    );

    // 讀不到鎖定狀態或操作序號時不得繼續：序號錯了會算出錯的冪等 key。
    // 也必須排在收付方向之前：sources 不完整時算出的方向可能相反。
    const readiness = settlementReadiness({
      writeEnabled: settlementWriteEnabled(),
      lockStateAvailable,
      operationSeqAvailable: attempts.available,
    });
    if (!readiness.ok) return { ok: false, error: readiness.error };

    // 收付方向由可信且未鎖定來源的 Decimal 淨額決定，不看 legacy 對帳摘要。
    // 不適用的方式直接擋下，不 fallback：付款方式納入冪等 key，悄悄換一個
    // 等於用別的 key 寫入，畫面顯示的方式也會與實際存下的不符。
    const resolved = resolveRequestedPaymentMethod({
      requested: input.paymentMethod,
      payer: payerFromDirection(computeLegacyTotals(sources).direction),
    });
    if (!resolved.ok) return { ok: false, error: resolved.error };

    const draft = buildSettlementDraft({
      merchantId: session.merchantId,
      periodStart: range.start,
      periodEnd: range.end,
      intendedPaymentMethod: resolved.method,
      operationSeq: attempts.operationSeq,
      sources,
    });

    const result = await persistStoreSettlement({
      draft,
      submitted: {
        sourceKeysDigest: input.preview.sourceKeysDigest,
        amountsDigest: input.preview.amountsDigest,
        idempotencyKey: input.preview.idempotencyKey,
        payloadFingerprint: input.preview.payloadFingerprint,
      },
    });

    if (!result.ok) return { ok: false, error: result.error };

    return {
      ok: true,
      duplicate: result.duplicate,
      settlementNo: result.settlementNo,
      status: result.status,
      netPayableTwd: result.netPayableTwd,
      // 重送舊 key 會回到原本那一張，而它可能已撤回或已撥款；訊息必須依實際狀態。
      message: submittedSettlementMessage({
        duplicate: result.duplicate,
        settlementNo: result.settlementNo,
        status: result.status,
      }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '結帳失敗。';
    return { ok: false, error: message };
  }
}

export type WithdrawSettleResult =
  | { ok: true; settlementNo: string; message: string }
  | { ok: false; error: string };

/** 店家撤回自己送出的待核對草稿。歸屬與狀態都由伺服器端條件判斷。 */
export async function withdrawStoreSettlementAction(input: {
  settlementId: string;
}): Promise<WithdrawSettleResult> {
  const session = await requireMerchantSession();
  if (!input.settlementId) return { ok: false, error: '缺少結帳單編號。' };

  try {
    const result = await withdrawStoreSettlement({
      merchantId: session.merchantId,
      settlementId: input.settlementId,
    });
    if (!result.ok) return { ok: false, error: result.error };
    return {
      ok: true,
      settlementNo: result.settlementNo,
      message: `已撤回 ${result.settlementNo}。紀錄保留，項目回到可結算，可以重新送出。`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '撤回失敗。';
    return { ok: false, error: message };
  }
}
