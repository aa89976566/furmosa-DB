'use server';

import { prisma } from '@/lib/prisma';
import { requireMerchantSession } from '@/lib/merchant-auth';
import { parseTaipeiDateRange } from '@/lib/taipei-date';
import { loadStoreLedger } from '@/lib/pos/load-store-ledger';
import {
  allowedPaymentMethods,
  persistStoreSettlement,
  withdrawStoreSettlement,
  type StoreSettlementPaymentMethod,
} from '@/lib/pos/store-settlement';
import { buildSettlementDraft } from '@/lib/settlements/write-settlement';
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

const METHOD_MAP: Record<string, StoreSettlementPaymentMethod> = {
  銀行轉帳: 'BANK_TRANSFER',
  '銀行轉帳（店家匯回匠寵）': 'BANK_TRANSFER',
  匠寵餘額折抵: 'FURMOSA_BALANCE',
  其他已核准方式: 'OTHER_APPROVED',
  匠寵匯款至店家帳戶: 'FURMOSA_TO_STORE_TRANSFER',
  本期無需付款: 'NONE',
};

/** 已送出的草稿只是待核對，絕不能寫成「已付款」或「已完成」。 */
function submittedMessage(duplicate: boolean, settlementNo: string): string {
  return duplicate
    ? `這期已經送出過了，還是同一張 ${settlementNo}，狀態待總部核對。`
    : `已送出待核對 ${settlementNo}。總部核對後才會撥款，這不是已付款。`;
}

export async function confirmStoreSettlementAction(input: {
  from: string;
  to: string;
  paymentMethodLabel: string;
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
  const { summary, sources } = await loadStoreLedger({
    merchantId: session.merchantId,
    periodStart: range.start,
    periodEnd: range.end,
  });

  const allowed = allowedPaymentMethods(summary.payer);
  const requested = METHOD_MAP[input.paymentMethodLabel];
  const method = requested && allowed.includes(requested) ? requested : allowed[0] ?? 'NONE';

  try {
    const attempts = await countVoidedAttempts(
      prisma,
      session.merchantId,
      sources.map((source) => source.sourceKey),
    );

    const draft = buildSettlementDraft({
      merchantId: session.merchantId,
      periodStart: range.start,
      periodEnd: range.end,
      intendedPaymentMethod: method,
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
      message: submittedMessage(result.duplicate, result.settlementNo),
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
