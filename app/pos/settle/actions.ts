'use server';

import { prisma } from '@/lib/prisma';
import { requireMerchantSession } from '@/lib/merchant-auth';
import { parseTaipeiDateRange } from '@/lib/taipei-date';
import { loadStoreLedger } from '@/lib/pos/load-store-ledger';
import {
  confirmStoreSettlement,
  findPriorStoreSettlement,
  persistStoreSettlement,
  withdrawStoreSettlement,
} from '@/lib/pos/store-settlement';
import { settlementWriteEnabled } from '@/lib/settlements/write-settlement';
import { countVoidedAttempts } from '@/lib/settlements/read-snapshot';

export type ConfirmSettleResult =
  | {
      ok: true;
      /** 已存在的同一張結算，重送不會產生第二張。 */
      duplicate: boolean;
      settlementNo: string;
      status: string;
      netPayableTwd: number;
      /** 資料庫裡真實的撥款時間。status 是 paid 但這裡是 null 不得宣稱已撥款。 */
      paidAt: string | null;
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

  try {
    // 送出順序（寫入開關 → 先查本店原單 → 才重算來源與付款方式）集中在
    // lib/pos/store-settlement.ts，讓順序本身能在沒有資料庫的環境回歸測試。
    const result = await confirmStoreSettlement(
      {
        merchantId: session.merchantId,
        periodStart: range.start,
        periodEnd: range.end,
        paymentMethod: input.paymentMethod,
        preview: input.preview,
      },
      {
        writeEnabled: settlementWriteEnabled,
        findPrior: findPriorStoreSettlement,
        loadSources: loadStoreLedger,
        countAttempts: ({ merchantId, sourceKeys }) =>
          countVoidedAttempts(prisma, merchantId, sourceKeys),
        persist: persistStoreSettlement,
      },
    );

    if (!result.ok) return { ok: false, error: result.error };

    return {
      ok: true,
      duplicate: result.duplicate,
      settlementNo: result.settlementNo,
      status: result.status,
      netPayableTwd: result.netPayableTwd,
      paidAt: result.paidAt ? result.paidAt.toISOString() : null,
      message: result.message,
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
