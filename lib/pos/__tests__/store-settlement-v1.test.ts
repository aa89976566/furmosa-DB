/**
 * POS 結算 v1 的寫入入口測試。
 *
 * 這裡只驗 POS 專屬的接縫：伺服器端寫入閘門、冪等 key 的組成、
 * 以及舊 POS 結帳輔助函式在加入 v1 之後行為不變。
 *
 * 交易、唯一約束與回滾由 lib/settlements/__tests__ 與
 * lib/settlements/__tests__/postgres-settlement.test.ts 負責，這裡不重複。
 *
 * 本檔不連任何資料庫：寫入閘門關閉時 persistStoreSettlement 不載入 prisma，
 * 所以在沒有 DATABASE_URL 的環境也能跑。
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isIncludedInSettlement,
  type LedgerEntry,
} from '@/lib/pos/store-ledger';
import {
  DuplicateSettlementError,
  allowedPaymentMethods,
  assertSourcesNotSettled,
  buildSettlementSnapshot,
  paymentMethodLabel,
  persistStoreSettlement,
  runSettlementTransaction,
  selectSettlementItems,
  withdrawStoreSettlement,
} from '@/lib/pos/store-settlement';
import {
  SETTLEMENT_WRITE_DISABLED_ERROR,
  SETTLEMENT_WRITE_FLAG_ENV,
  buildSettlementDraft,
  settlementWriteEnabled,
  type SettlementDraft,
  type SettlementPaymentMethod,
} from '@/lib/settlements/write-settlement';
import {
  POS_SETTLEMENT_RULES_VERSION,
  consignmentSaleSourceKey,
  type SettlementSourceDraft,
} from '@/lib/settlements/source-snapshot';

const STORE = 'store-paopao';
const at = (stamp: string) => new Date(`${stamp}+08:00`);
const PERIOD_START = at('2024-05-01T00:00:00');
const PERIOD_END = at('2024-05-31T23:59:59.999');

function entry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    id: 'entry-1',
    sourceKind: 'payment',
    sourceId: 'pay-1',
    transactionType: 'STORE_COLLECTION',
    occurredAt: at('2024-05-10T11:00:00'),
    amount: 200,
    paymentCollector: 'STORE',
    fundDirection: 'STORE_TO_FURMOSA',
    settlementStatus: 'UNSETTLED',
    relatedOrderId: null,
    relatedOrderDisplay: '—',
    storeId: STORE,
    customerId: 'cust-1',
    customerName: '王小姐',
    content: '店家代收現金',
    remark: null,
    couponId: null,
    couponCode: null,
    jarSerial: null,
    searchText: '',
    ...overrides,
  };
}

/** 寄賣銷售來源：3 × 85 = 255，分潤 76.5。半元必須留到唯一一次進位。 */
function saleSource(txnId: string, overrides: Partial<SettlementSourceDraft> = {}): SettlementSourceDraft {
  return {
    sourceKind: 'consignment_sale',
    sourceKey: consignmentSaleSourceKey(txnId),
    direction: 'STORE_TO_FURMOSA',
    originalAmount: 255,
    quantity: 3,
    unitPrice: 85,
    commissionAmount: 76.5,
    companyRevenue: 178.5,
    occurredAt: at('2024-05-10T11:00:00'),
    relatedOrderId: null,
    label: '測試商品 × 3',
    sourceSnapshot: { txnId },
    ...overrides,
  };
}

function draftOf(
  sources: SettlementSourceDraft[],
  options: { paymentMethod?: SettlementPaymentMethod; operationSeq?: number } = {},
): SettlementDraft {
  return buildSettlementDraft({
    merchantId: STORE,
    periodStart: PERIOD_START,
    periodEnd: PERIOD_END,
    intendedPaymentMethod: options.paymentMethod ?? 'BANK_TRANSFER',
    operationSeq: options.operationSeq ?? 0,
    sources,
  });
}

function submittedOf(draft: SettlementDraft) {
  return {
    sourceKeysDigest: draft.sourceKeysDigest,
    amountsDigest: draft.amountsDigest,
    idempotencyKey: draft.idempotencyKey,
    payloadFingerprint: draft.payloadFingerprint,
  };
}

/** 暫時改寫寫入 flag，結束後還原，避免影響其他測試。 */
async function withWriteFlag<T>(value: string | undefined, fn: () => Promise<T>): Promise<T> {
  const before = process.env[SETTLEMENT_WRITE_FLAG_ENV];
  if (value == null) delete process.env[SETTLEMENT_WRITE_FLAG_ENV];
  else process.env[SETTLEMENT_WRITE_FLAG_ENV] = value;
  try {
    return await fn();
  } finally {
    if (before == null) delete process.env[SETTLEMENT_WRITE_FLAG_ENV];
    else process.env[SETTLEMENT_WRITE_FLAG_ENV] = before;
  }
}

describe('POS v1 寫入閘門', () => {
  it('寫入 flag 未設定時拒寫，並且完全不載入 prisma', async () => {
    const draft = draftOf([saleSource('txn-1')]);
    const result = await withWriteFlag(undefined, () =>
      persistStoreSettlement({ draft, submitted: submittedOf(draft) }),
    );

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'WRITE_DISABLED');
    assert.equal(result.error, SETTLEMENT_WRITE_DISABLED_ERROR);
    // 訊息必須說清楚「沒有留下任何紀錄」，不能讓店員以為已經送出。
    assert.match(result.error, /沒有留下任何紀錄/);
  });

  it('撤回也走同一個伺服器端閘門，不靠 UI 隱藏按鈕保護', async () => {
    const result = await withWriteFlag(undefined, () =>
      withdrawStoreSettlement({ merchantId: STORE, settlementId: 'set-1' }),
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'WRITE_DISABLED');
  });

  it('flag 只認字串 true，其他值一律視為關閉', () => {
    for (const value of ['1', 'TRUE', 'yes', 'false', '', undefined]) {
      assert.equal(
        settlementWriteEnabled({ [SETTLEMENT_WRITE_FLAG_ENV]: value }),
        false,
        `${String(value)} 不應該被當成開啟`,
      );
    }
    assert.equal(settlementWriteEnabled({ [SETTLEMENT_WRITE_FLAG_ENV]: 'true' }), true);
  });
});

describe('POS v1 草稿與冪等 key', () => {
  it('同一次送出重算得到同一個 key 與同一個 fingerprint', () => {
    const a = draftOf([saleSource('txn-1'), saleSource('txn-2')]);
    const b = draftOf([saleSource('txn-2'), saleSource('txn-1')]);
    assert.equal(a.idempotencyKey, b.idempotencyKey, '來源順序不得影響 key');
    assert.equal(a.payloadFingerprint, b.payloadFingerprint);
    assert.equal(a.rulesVersion, POS_SETTLEMENT_RULES_VERSION);
  });

  it('付款方式仍在 key 與 fingerprint 內', () => {
    const bank = draftOf([saleSource('txn-1')], { paymentMethod: 'BANK_TRANSFER' });
    const balance = draftOf([saleSource('txn-1')], { paymentMethod: 'FURMOSA_BALANCE' });
    assert.notEqual(bank.idempotencyKey, balance.idempotencyKey);
    assert.notEqual(bank.payloadFingerprint, balance.payloadFingerprint);
  });

  it('操作序號改變即產生新 key，讓撤回後可以重新結算', () => {
    const first = draftOf([saleSource('txn-1')], { operationSeq: 0 });
    const second = draftOf([saleSource('txn-1')], { operationSeq: 1 });
    assert.notEqual(first.idempotencyKey, second.idempotencyKey);
    // 來源集合沒變，所以來源摘要相同；變的只有操作識別。
    assert.equal(first.sourceKeysDigest, second.sourceKeysDigest);
  });

  it('來源原值改變會改變金額摘要，數量與單價互換也一樣', () => {
    const base = draftOf([saleSource('txn-1')]);
    const sameTotalDifferentSplit = draftOf([
      saleSource('txn-1', { quantity: 1, unitPrice: 255 }),
    ]);
    assert.equal(base.sourceKeysDigest, sameTotalDifferentSplit.sourceKeysDigest);
    assert.notEqual(
      base.amountsDigest,
      sameTotalDifferentSplit.amountsDigest,
      '2×100 改成 4×50 這類變更必須被偵測到',
    );
  });

  it('半元只在最後進位一次，整數淨額是 179 而不是 178', () => {
    const draft = draftOf([saleSource('txn-1')]);
    assert.equal(draft.totals.grossSales, 255);
    assert.equal(draft.totals.commissionAmount, 76.5, '來源原值保留半元');
    assert.equal(draft.totals.netPayableTwd, 179);
    assert.equal(draft.totals.storeCollected, 0);
    assert.equal(draft.totals.direction, 'STORE_TO_FURMOSA');
  });

  it('來源鍵重複視為程式錯誤，必須先去重再建草稿', () => {
    assert.throws(() => draftOf([saleSource('txn-1'), saleSource('txn-1')]), /來源鍵重複/);
  });
});

describe('舊 POS 結帳輔助函式回歸', () => {
  it('付款方式白名單與標籤不變', () => {
    assert.deepEqual(allowedPaymentMethods('STORE'), [
      'BANK_TRANSFER',
      'FURMOSA_BALANCE',
      'OTHER_APPROVED',
    ]);
    assert.deepEqual(allowedPaymentMethods('FURMOSA'), ['FURMOSA_TO_STORE_TRANSFER']);
    assert.deepEqual(allowedPaymentMethods('NONE'), ['NONE']);
    assert.equal(paymentMethodLabel('BANK_TRANSFER'), '銀行轉帳');
    assert.equal(paymentMethodLabel('NONE'), '本期無需付款');
  });

  it('只挑需要結算的流水，已入帳與不結算的不進明細', () => {
    const billable = entry();
    const online = entry({
      id: 'entry-2',
      sourceId: 'pay-2',
      fundDirection: 'NO_SETTLEMENT',
      paymentCollector: 'FURMOSA',
    });
    assert.equal(isIncludedInSettlement(billable), true);
    assert.equal(isIncludedInSettlement(online), false);
    assert.deepEqual(
      selectSettlementItems([billable, online]).map((row) => row.sourceId),
      ['pay-1'],
    );
  });

  it('已結過帳的流水不得再進新的結帳', () => {
    const settled = entry({ settlementStatus: 'SETTLED' });
    assert.throws(() => assertSourcesNotSettled([settled]), DuplicateSettlementError);
    assert.throws(
      () =>
        buildSettlementSnapshot({
          storeId: STORE,
          periodStart: PERIOD_START,
          periodEnd: PERIOD_END,
          entries: [settled],
          paymentMethod: 'BANK_TRANSFER',
        }),
      DuplicateSettlementError,
    );
  });

  it('快照會把付款方式修正到該方向允許的選項', () => {
    const snapshot = buildSettlementSnapshot({
      storeId: STORE,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      entries: [entry()],
      paymentMethod: 'FURMOSA_TO_STORE_TRANSFER',
    });
    assert.equal(snapshot.payer, 'STORE');
    assert.equal(snapshot.paymentMethod, 'BANK_TRANSFER', '店家付款不得用匠寵匯款方式');
    assert.deepEqual(snapshot.itemSourceIds, ['pay-1']);
  });

  it('結帳交易順序不變：先建紀錄與明細，再標記已結算', async () => {
    const calls: string[] = [];
    const snapshot = buildSettlementSnapshot({
      storeId: STORE,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      entries: [entry()],
      paymentMethod: 'BANK_TRANSFER',
    });

    const created = await runSettlementTransaction(async (fn) => {
      return fn({
        findSettledSourceIds: async () => {
          calls.push('check');
          return [];
        },
        createSettlement: async () => {
          calls.push('createSettlement');
          return { id: 'set-1' };
        },
        createItems: async () => {
          calls.push('createItems');
        },
        markSourcesSettled: async () => {
          calls.push('markSettled');
        },
      });
    }, snapshot);

    assert.equal(created.id, 'set-1');
    assert.deepEqual(calls, ['check', 'createSettlement', 'createItems', 'markSettled']);
  });

  it('交易內查到已結算的來源就整批拒絕', async () => {
    const snapshot = buildSettlementSnapshot({
      storeId: STORE,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      entries: [entry()],
      paymentMethod: 'BANK_TRANSFER',
    });

    await assert.rejects(
      runSettlementTransaction(
        async (fn) =>
          fn({
            findSettledSourceIds: async () => ['pay-1'],
            createSettlement: async () => {
              throw new Error('不應該走到建立結算');
            },
            createItems: async () => {
              throw new Error('不應該走到建立明細');
            },
            markSourcesSettled: async () => {
              throw new Error('不應該走到標記已結算');
            },
          }),
        snapshot,
      ),
      DuplicateSettlementError,
    );
  });
});
