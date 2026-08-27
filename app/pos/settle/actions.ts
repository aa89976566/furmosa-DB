'use server';

import { requireMerchantSession } from '@/lib/merchant-auth';
import { parseTaipeiDateRange } from '@/lib/taipei-date';
import { loadStoreLedger } from '@/lib/pos/load-store-ledger';
import {
  allowedPaymentMethods,
  buildSettlementSnapshot,
  persistStoreSettlement,
  type StoreSettlementPaymentMethod,
} from '@/lib/pos/store-settlement';

export type ConfirmSettleResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

const METHOD_MAP: Record<string, StoreSettlementPaymentMethod> = {
  銀行轉帳: 'BANK_TRANSFER',
  匠寵餘額折抵: 'FURMOSA_BALANCE',
  其他已核准方式: 'OTHER_APPROVED',
  匠寵匯款至店家帳戶: 'FURMOSA_TO_STORE_TRANSFER',
  本期無需付款: 'NONE',
};

export async function confirmStoreSettlementAction(input: {
  from: string;
  to: string;
  paymentMethodLabel: string;
}): Promise<ConfirmSettleResult> {
  const session = await requireMerchantSession();
  const range = parseTaipeiDateRange(input.from, input.to);
  if (!range) {
    return { ok: false, error: '期間日期不正確。' };
  }

  const { entries, summary } = await loadStoreLedger({
    merchantId: session.merchantId,
    periodStart: range.start,
    periodEnd: range.end,
  });

  const method =
    METHOD_MAP[input.paymentMethodLabel] ??
    allowedPaymentMethods(summary.payer)[0] ??
    'NONE';

  try {
    const snapshot = buildSettlementSnapshot({
      storeId: session.merchantId,
      periodStart: range.start,
      periodEnd: range.end,
      entries,
      paymentMethod: method,
    });
    const persisted = await persistStoreSettlement(snapshot);
    if (!persisted.ok) {
      return { ok: false, error: persisted.error };
    }
    return { ok: true, message: '結帳已完成。' };
  } catch (error) {
    const message = error instanceof Error ? error.message : '結帳失敗。';
    return { ok: false, error: message };
  }
}
