import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { PrismaClient } from '@prisma/client';
import {
  POS_SETTLEMENT_RULES_VERSION,
  consignmentSaleSourceKey,
  couponSourceKey,
  type SettlementSourceDraft,
} from '@/lib/settlements/source-snapshot';
import {
  SETTLEMENT_STATUS_TRANSITION_ERROR,
  SETTLEMENT_WRITE_FLAG_ENV,
  SettlementLockConflictError,
  assertLockedCount,
  assertSettlementDeletable,
  buildSettlementDraft,
  classifyUniqueViolation,
  findSettlementByPreviewKey,
  formatSettlementNo,
  isMissingSchemaError,
  persistSettlementDraft,
  priorSettlementResult,
  settlementReadiness,
  settlementStatusUpdateCondition,
  settlementWriteEnabled,
  withdrawSettlementDraft,
  type SettlementDraft,
} from '@/lib/settlements/write-settlement';

const at = (stamp: string) => new Date(`${stamp}+08:00`);

afterEach(() => {
  delete process.env[SETTLEMENT_WRITE_FLAG_ENV];
});

function enableWrites() {
  process.env[SETTLEMENT_WRITE_FLAG_ENV] = 'true';
}

function saleSource(id: string, gross: number, commission: number): SettlementSourceDraft {
  return {
    sourceKind: 'consignment_sale',
    sourceKey: consignmentSaleSourceKey(id),
    direction: 'STORE_TO_FURMOSA',
    originalAmount: gross,
    quantity: 1,
    unitPrice: gross,
    commissionAmount: commission,
    companyRevenue: gross - commission,
    occurredAt: at('2024-05-19T11:00:00'),
    relatedOrderId: null,
    label: `商品 ${id}`,
    sourceSnapshot: { txnId: id },
  };
}

function couponSource(code: string, faceValue: number): SettlementSourceDraft {
  return {
    sourceKind: 'coupon_subsidy',
    sourceKey: couponSourceKey(code),
    direction: 'FURMOSA_TO_STORE',
    originalAmount: faceValue,
    quantity: null,
    unitPrice: null,
    commissionAmount: null,
    companyRevenue: null,
    occurredAt: at('2024-05-19T15:00:00'),
    relatedOrderId: null,
    label: `券 ${code}`,
    sourceSnapshot: { model: 'grooming_coupon' },
  };
}

function draftFor(
  sources: SettlementSourceDraft[],
  overrides: Partial<Parameters<typeof buildSettlementDraft>[0]> = {},
): SettlementDraft {
  return buildSettlementDraft({
    merchantId: 'm-1',
    periodStart: at('2024-05-01T00:00:00'),
    periodEnd: at('2024-05-31T23:59:59.999'),
    intendedPaymentMethod: 'BANK_TRANSFER',
    operationSeq: 0,
    sources,
    ...overrides,
  });
}

function expectedOf(draft: SettlementDraft) {
  return { sourceKeysDigest: draft.sourceKeysDigest, amountsDigest: draft.amountsDigest };
}

/** 送出時瀏覽器帶回的完整預覽指紋，含預覽當時的 key。 */
function submittedOf(draft: SettlementDraft) {
  return {
    ...expectedOf(draft),
    idempotencyKey: draft.idempotencyKey,
    payloadFingerprint: draft.payloadFingerprint,
  };
}

// ---------------------------------------------------------------------------
// 記憶體假 client。只實作本模組會用到的呼叫，交易以同步套用模擬。
// ---------------------------------------------------------------------------

type FakeSettlement = Record<string, unknown> & { id: string; settlementId: string };
type FakeItem = Record<string, unknown> & { settlementId: string; sourceKey: string };
type FakeTxn = { id: string; merchantId: string; settlementId: string | null };

function fakeClient(options: { txns?: FakeTxn[]; failNextCreateWith?: unknown } = {}) {
  const settlements: FakeSettlement[] = [];
  const items: FakeItem[] = [];
  const txns: FakeTxn[] = options.txns ?? [];
  let pendingCreateError = options.failNextCreateWith;
  let sequence = 0;

  function matches(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
    return Object.entries(where).every(([key, expected]) => {
      const actual = row[key];
      if (expected && typeof expected === 'object' && 'in' in (expected as object)) {
        return (expected as { in: unknown[] }).in.includes(actual);
      }
      if (expected && typeof expected === 'object' && 'not' in (expected as object)) {
        return actual !== (expected as { not: unknown }).not;
      }
      if (expected && typeof expected === 'object' && 'startsWith' in (expected as object)) {
        const prefix = (expected as { startsWith: string }).startsWith;
        return typeof actual === 'string' && actual.startsWith(prefix);
      }
      return actual === expected;
    });
  }

  const api = {
    settlement: {
      findFirst: async ({
        where,
        orderBy,
      }: {
        where: Record<string, unknown>;
        orderBy?: { settlementId?: 'asc' | 'desc' };
      }) => {
        const hit = settlements.filter((row) => matches(row, where));
        if (orderBy?.settlementId === 'desc') {
          hit.sort((a, b) => b.settlementId.localeCompare(a.settlementId));
        }
        return hit[0] ?? null;
      },
      findUnique: async ({ where }: { where: Record<string, unknown> }) =>
        settlements.find((row) => matches(row, where)) ?? null,
      findUniqueOrThrow: async ({ where }: { where: Record<string, unknown> }) => {
        const found = settlements.find((row) => matches(row, where));
        if (!found) throw new Error('not found');
        return found;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (pendingCreateError) {
          const error = pendingCreateError;
          pendingCreateError = undefined;
          throw error;
        }
        if (settlements.some((row) => row.idempotencyKey === data.idempotencyKey)) {
          throw Object.assign(new Error('unique'), {
            code: 'P2002',
            meta: { target: ['idempotencyKey'] },
          });
        }
        if (settlements.some((row) => row.settlementId === data.settlementId)) {
          throw Object.assign(new Error('unique'), {
            code: 'P2002',
            meta: { target: ['Settlement_settlementId_key'] },
          });
        }
        sequence += 1;
        const row = { ...data, id: `st-${sequence}` } as FakeSettlement;
        // 真 Prisma 的 select 會回 null，不是 undefined。POS 從不寫 paidAt。
        if (row.paidAt === undefined) row.paidAt = null;
        settlements.push(row);
        return row;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        const hit = settlements.filter((row) => matches(row, where));
        for (const row of hit) Object.assign(row, data);
        return { count: hit.length };
      },
    },
    settlementSourceItem: {
      createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
        for (const row of data) {
          const clash = items.find(
            (existing) =>
              existing.merchantId === row.merchantId &&
              existing.sourceKey === row.sourceKey &&
              existing.voidedAt == null,
          );
          if (clash) {
            throw Object.assign(new Error('unique'), {
              code: 'P2002',
              meta: { target: ['SettlementSourceItem_active_source_key'] },
            });
          }
          items.push({ ...row, voidedAt: row.voidedAt ?? null } as unknown as FakeItem);
        }
        return { count: data.length };
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        items.filter((row) => matches(row, where)),
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        const hit = items.filter((row) => matches(row, where));
        for (const row of hit) Object.assign(row, data);
        return { count: hit.length };
      },
    },
    merchantStockTxn: {
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        const hit = txns.filter((row) => matches(row as unknown as Record<string, unknown>, where));
        for (const row of hit) Object.assign(row, data);
        return { count: hit.length };
      },
    },
    // 真 Prisma 交易失敗會整批回滾。這裡用快照還原模擬，否則部分寫入會留在記憶體，
    // 讓「整批拒絕」的斷言失去意義。
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      const snapshot = {
        settlements: settlements.map((row) => ({ ...row })),
        items: items.map((row) => ({ ...row })),
        txns: txns.map((row) => ({ ...row })),
        sequence,
      };
      try {
        return await fn(api);
      } catch (error) {
        settlements.splice(0, settlements.length, ...snapshot.settlements);
        items.splice(0, items.length, ...snapshot.items);
        txns.splice(0, txns.length, ...snapshot.txns);
        sequence = snapshot.sequence;
        throw error;
      }
    },
  };

  return { client: api as unknown as PrismaClient, settlements, items, txns };
}

describe('寫入開關預設關閉', () => {
  it('未設環境變數時視為關閉', () => {
    assert.equal(settlementWriteEnabled({}), false);
    assert.equal(settlementWriteEnabled({ [SETTLEMENT_WRITE_FLAG_ENV]: 'false' }), false);
    assert.equal(settlementWriteEnabled({ [SETTLEMENT_WRITE_FLAG_ENV]: '1' }), false);
    assert.equal(settlementWriteEnabled({ [SETTLEMENT_WRITE_FLAG_ENV]: 'true' }), true);
  });

  it('關閉時完全不碰資料庫，也不假裝成功', async () => {
    const draft = draftFor([saleSource('t1', 255, 76.5)]);
    const exploding = new Proxy(
      {},
      {
        get() {
          throw new Error('寫入關閉時不應該存取資料庫');
        },
      },
    ) as PrismaClient;

    const result = await persistSettlementDraft(exploding, draft, expectedOf(draft));
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'WRITE_DISABLED');
    assert.match(result.error, /尚未啟用/);
  });
});

describe('R4#1：讀不到鎖定狀態不得當成沒有鎖繼續', () => {
  const ready = { writeEnabled: true, lockStateAvailable: true, operationSeqAvailable: true };

  it('三者都就緒才放行', () => {
    assert.deepEqual(settlementReadiness(ready), { ok: true });
  });

  it('flag 關閉時的理由與代碼不變', () => {
    const result = settlementReadiness({ ...ready, writeEnabled: false });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'WRITE_DISABLED');
  });

  it('鎖定狀態讀不到時擋下送出，並說明是讀不到而不是沒有鎖', () => {
    const result = settlementReadiness({ ...ready, lockStateAvailable: false });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'LOCK_STATE_UNKNOWN');
    assert.match(result.error, /讀不到/);
    assert.match(result.error, /避免重複結算/);
    // 不得把 available:false 說成「沒有可結算項目」或「已啟用」。
    assert.doesNotMatch(result.error, /沒有可以結算|尚未啟用/);
  });

  it('操作序號讀不到時同樣擋下：序號錯了會算出錯的冪等 key', () => {
    const result = settlementReadiness({ ...ready, operationSeqAvailable: false });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'LOCK_STATE_UNKNOWN');
  });

  it('flag 關閉優先於鎖定狀態，理由只給一個', () => {
    const result = settlementReadiness({
      writeEnabled: false,
      lockStateAvailable: false,
      operationSeqAvailable: false,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'WRITE_DISABLED');
  });
});

describe('草稿組裝', () => {
  it('重複的來源鍵屬程式錯誤，必須先去重', () => {
    const source = saleSource('t1', 255, 76.5);
    assert.throws(() => draftFor([source, source]), /先去重/);
  });

  it('來源順序不影響摘要與 key', () => {
    const a = draftFor([saleSource('t1', 100, 10), couponSource('pt10', 200)]);
    const b = draftFor([couponSource('pt10', 200), saleSource('t1', 100, 10)]);
    assert.equal(a.idempotencyKey, b.idempotencyKey);
    assert.equal(a.payloadFingerprint, b.payloadFingerprint);
  });

  it('結算編號沿用 SET-YYYYMM-NNN 格式', () => {
    assert.equal(formatSettlementNo(at('2024-05-31T23:59:59'), 3), 'SET-202405-003');
  });
});

describe('唯一violation 分類：來源衝突不得被當成編號碰撞', () => {
  it('分辨 idempotencyKey、active source key 與結算編號', () => {
    const p2002 = (target: string[]) => ({ code: 'P2002', meta: { target } });
    assert.equal(classifyUniqueViolation(p2002(['idempotencyKey'])), 'idempotency_key');
    assert.equal(
      classifyUniqueViolation(p2002(['SettlementSourceItem_active_source_key'])),
      'active_source_key',
    );
    assert.equal(classifyUniqueViolation(p2002(['Settlement_settlementId_key'])), 'settlement_no');
    assert.equal(classifyUniqueViolation({ code: 'P2003' }), null);
    assert.equal(classifyUniqueViolation(new Error('boom')), null);
  });

  it('缺表錯誤獨立分類', () => {
    assert.equal(isMissingSchemaError({ code: 'P2021' }), true);
    assert.equal(isMissingSchemaError({ code: 'P2022' }), true);
    assert.equal(isMissingSchemaError({ code: 'P2002' }), false);
  });

  it('鎖定筆數不符必須拋錯讓交易回滾', () => {
    assert.throws(() => assertLockedCount(3, 2), SettlementLockConflictError);
    assert.doesNotThrow(() => assertLockedCount(3, 3));
  });
});

describe('建立草稿與冪等', () => {
  it('建立 header、明細與來源鎖，且永遠不寫 paidAt', async () => {
    enableWrites();
    const { client, settlements, items, txns } = fakeClient({
      txns: [{ id: 't1', merchantId: 'm-1', settlementId: null }],
    });
    const draft = draftFor([saleSource('t1', 255, 76.5), couponSource('pt10', 200)]);

    const result = await persistSettlementDraft(client, draft, expectedOf(draft));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.duplicate, false);
    assert.equal(result.status, 'draft');
    assert.equal(settlements.length, 1);
    // POS 從不寫撥款時間；假 client 與真 Prisma 一樣留 null。
    assert.equal(settlements[0]?.paidAt, null);
    assert.equal(settlements[0]?.rulesVersion, POS_SETTLEMENT_RULES_VERSION);
    assert.equal(settlements[0]?.createdSource, 'pos');
    assert.equal(items.length, 2);
    assert.equal(txns[0]?.settlementId, result.id);
    // 255 - 76.5 - 200 = -21.5 → half-away-from-zero → -22
    assert.equal(result.netPayableTwd, -22);
  });

  it('沒有來源時不建立結算', async () => {
    enableWrites();
    const { client, settlements } = fakeClient();
    const draft = draftFor([]);
    const result = await persistSettlementDraft(client, draft, expectedOf(draft));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'NO_SOURCES');
    assert.equal(settlements.length, 0);
  });

  it('預覽摘要與送出內容不一致時整批拒絕', async () => {
    enableWrites();
    const { client, settlements } = fakeClient();
    const draft = draftFor([saleSource('t1', 255, 76.5)]);
    const result = await persistSettlementDraft(client, draft, {
      sourceKeysDigest: draft.sourceKeysDigest,
      amountsDigest: 'stale',
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'STALE_PREVIEW');
    assert.equal(settlements.length, 0);
  });

  it('同 key 同 payload 重送回傳既有結算，不產生第二張', async () => {
    enableWrites();
    const { client, settlements } = fakeClient({
      txns: [{ id: 't1', merchantId: 'm-1', settlementId: null }],
    });
    const draft = draftFor([saleSource('t1', 255, 76.5)]);

    const first = await persistSettlementDraft(client, draft, expectedOf(draft));
    const second = await persistSettlementDraft(client, draft, expectedOf(draft));
    assert.equal(first.ok && second.ok, true);
    if (!first.ok || !second.ok) return;
    assert.equal(second.duplicate, true);
    assert.equal(second.id, first.id);
    assert.equal(settlements.length, 1);
  });

  it('同 key 不同 payload 必須拒絕', async () => {
    enableWrites();
    const { client, settlements } = fakeClient({
      txns: [{ id: 't1', merchantId: 'm-1', settlementId: null }],
    });
    const original = draftFor([saleSource('t1', 255, 76.5)]);
    await persistSettlementDraft(client, original, expectedOf(original));

    // 同一組來源鍵、同付款方式、同操作序號 → 同 key；但來源原值被改動。
    const tampered = draftFor([saleSource('t1', 255, 50)]);
    assert.equal(tampered.idempotencyKey, original.idempotencyKey);
    assert.notEqual(tampered.payloadFingerprint, original.payloadFingerprint);

    const result = await persistSettlementDraft(client, tampered, expectedOf(tampered));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'PAYLOAD_CONFLICT');
    assert.equal(settlements.length, 1);
  });

  it('來源已被別張結算鎖住時整批拒絕，不當成編號碰撞重試', async () => {
    enableWrites();
    const { client, settlements } = fakeClient({
      txns: [
        { id: 't1', merchantId: 'm-1', settlementId: null },
        { id: 't2', merchantId: 'm-1', settlementId: null },
      ],
    });
    const first = draftFor([saleSource('t1', 100, 10)]);
    await persistSettlementDraft(client, first, expectedOf(first));

    // 部分重疊：t1 已被鎖，t2 未鎖。
    const overlapping = draftFor([saleSource('t1', 100, 10), saleSource('t2', 200, 20)]);
    const result = await persistSettlementDraft(client, overlapping, expectedOf(overlapping));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'SOURCE_CONFLICT');
    assert.equal(settlements.length, 1);
  });

  it('寄賣流水在送出瞬間被搶鎖時，筆數斷言讓整批回滾', async () => {
    enableWrites();
    const { client } = fakeClient({
      txns: [{ id: 't1', merchantId: 'm-1', settlementId: 'other-settlement' }],
    });
    const draft = draftFor([saleSource('t1', 100, 10)]);
    const result = await persistSettlementDraft(client, draft, expectedOf(draft));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'LOCK_CONFLICT');
  });

  it('缺表環境回傳可讀訊息，不假裝成功', async () => {
    enableWrites();
    const { client } = fakeClient({ failNextCreateWith: { code: 'P2021' } });
    const draft = draftFor([saleSource('t1', 100, 10)]);
    const result = await persistSettlementDraft(client, draft, expectedOf(draft));
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'SCHEMA_MISSING');
      assert.match(result.error, /資料庫更新/);
    }
  });
});

describe('R2#4：撤回後必須能用新操作序號重新結算', () => {
  it('撤回釋放唯一鍵與來源鎖，稽核列保留', async () => {
    enableWrites();
    const { client, items, txns, settlements } = fakeClient({
      txns: [{ id: 't1', merchantId: 'm-1', settlementId: null }],
    });
    const draft = draftFor([saleSource('t1', 255, 76.5)]);
    const created = await persistSettlementDraft(client, draft, expectedOf(draft));
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const withdrawn = await withdrawSettlementDraft(client, {
      merchantId: 'm-1',
      settlementId: created.id,
    });
    assert.equal(withdrawn.ok, true);
    if (!withdrawn.ok) return;
    assert.equal(withdrawn.status, 'cancelled');
    // 稽核列不刪除，只標記作廢。
    assert.equal(items.length, 1);
    assert.notEqual(items[0]?.voidedAt, null);
    assert.equal(txns[0]?.settlementId, null);
    // 撤回不清零歷史金額：255 - 76.5 = 178.5，四捨五入離零為 179。
    assert.equal(settlements[0]?.netPayableTwd, 179);
  });

  it('舊 key 重送仍回到原本那張 cancelled，不復活', async () => {
    enableWrites();
    const { client, settlements } = fakeClient({
      txns: [{ id: 't1', merchantId: 'm-1', settlementId: null }],
    });
    const draft = draftFor([saleSource('t1', 255, 76.5)]);
    const created = await persistSettlementDraft(client, draft, expectedOf(draft));
    assert.equal(created.ok, true);
    if (!created.ok) return;
    await withdrawSettlementDraft(client, { merchantId: 'm-1', settlementId: created.id });

    const resend = await persistSettlementDraft(client, draft, expectedOf(draft));
    assert.equal(resend.ok, true);
    if (!resend.ok) return;
    assert.equal(resend.duplicate, true);
    assert.equal(resend.id, created.id);
    assert.equal(resend.status, 'cancelled');
    assert.equal(settlements.length, 1);
  });

  it('操作序號 +1 後同一組來源可以再建一張新結算', async () => {
    enableWrites();
    const { client, settlements, items } = fakeClient({
      txns: [{ id: 't1', merchantId: 'm-1', settlementId: null }],
    });
    const first = draftFor([saleSource('t1', 255, 76.5)]);
    const created = await persistSettlementDraft(client, first, expectedOf(first));
    assert.equal(created.ok, true);
    if (!created.ok) return;
    await withdrawSettlementDraft(client, { merchantId: 'm-1', settlementId: created.id });

    const retry = draftFor([saleSource('t1', 255, 76.5)], { operationSeq: 1 });
    assert.notEqual(retry.idempotencyKey, first.idempotencyKey);
    const again = await persistSettlementDraft(client, retry, expectedOf(retry));
    assert.equal(again.ok, true);
    if (!again.ok) return;
    assert.equal(again.duplicate, false);
    assert.notEqual(again.id, created.id);
    assert.equal(settlements.length, 2);
    // 原稽核列保留，新結算另建一列。
    assert.equal(items.length, 2);
  });

  it('不得撤回已送審或已處理的結算', async () => {
    enableWrites();
    const { client, settlements } = fakeClient({
      txns: [{ id: 't1', merchantId: 'm-1', settlementId: null }],
    });
    const draft = draftFor([saleSource('t1', 100, 10)]);
    const created = await persistSettlementDraft(client, draft, expectedOf(draft));
    assert.equal(created.ok, true);
    if (!created.ok) return;
    settlements[0]!.status = 'reviewing';

    const result = await withdrawSettlementDraft(client, {
      merchantId: 'm-1',
      settlementId: created.id,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'NOT_WITHDRAWABLE');
  });

  it('不得撤回別家店的結算', async () => {
    enableWrites();
    const { client } = fakeClient({
      txns: [{ id: 't1', merchantId: 'm-1', settlementId: null }],
    });
    const draft = draftFor([saleSource('t1', 100, 10)]);
    const created = await persistSettlementDraft(client, draft, expectedOf(draft));
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const result = await withdrawSettlementDraft(client, {
      merchantId: 'other-store',
      settlementId: created.id,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'NOT_WITHDRAWABLE');
  });
});

describe('R3#2：重送必須先依原 key 找原單，不另建第二張', () => {
  it('送出成功後來源被鎖住，新預覽變空，重送仍回原單而不是「沒有可結算項目」', async () => {
    enableWrites();
    const { client, settlements } = fakeClient({
      txns: [{ id: 't1', merchantId: 'm-1', settlementId: null }],
    });
    const first = draftFor([saleSource('t1', 255, 76.5)]);
    const created = await persistSettlementDraft(client, first, submittedOf(first));
    assert.equal(created.ok, true);
    if (!created.ok) return;

    // 重新整理後的預覽：來源已被自己那張鎖住，因此暫計是空的。
    const emptyPreview = draftFor([]);
    assert.notEqual(emptyPreview.idempotencyKey, first.idempotencyKey);

    const resend = await persistSettlementDraft(client, emptyPreview, {
      ...expectedOf(emptyPreview),
      idempotencyKey: first.idempotencyKey,
      payloadFingerprint: first.payloadFingerprint,
    });
    assert.equal(resend.ok, true);
    if (!resend.ok) return;
    assert.equal(resend.duplicate, true);
    assert.equal(resend.id, created.id);
    assert.equal(settlements.length, 1);
  });

  it('撤回讓操作序號變動後，帶原 key 重送仍回原本那張 cancelled', async () => {
    enableWrites();
    const { client, settlements } = fakeClient({
      txns: [{ id: 't1', merchantId: 'm-1', settlementId: null }],
    });
    const first = draftFor([saleSource('t1', 255, 76.5)]);
    const created = await persistSettlementDraft(client, first, submittedOf(first));
    assert.equal(created.ok, true);
    if (!created.ok) return;
    await withdrawSettlementDraft(client, { merchantId: 'm-1', settlementId: created.id });

    // 撤回後同一組來源的操作序號變成 1，算出來的 key 不同。
    const afterWithdraw = draftFor([saleSource('t1', 255, 76.5)], { operationSeq: 1 });
    assert.notEqual(afterWithdraw.idempotencyKey, first.idempotencyKey);

    const resend = await persistSettlementDraft(client, afterWithdraw, {
      ...expectedOf(afterWithdraw),
      idempotencyKey: first.idempotencyKey,
      payloadFingerprint: first.payloadFingerprint,
    });
    assert.equal(resend.ok, true);
    if (!resend.ok) return;
    assert.equal(resend.id, created.id);
    assert.equal(resend.status, 'cancelled');
    assert.equal(settlements.length, 1);
  });

  it('原 key 找得到但預覽指紋不符時拒絕，不回傳不相符的原單', async () => {
    enableWrites();
    const { client } = fakeClient({
      txns: [{ id: 't1', merchantId: 'm-1', settlementId: null }],
    });
    const first = draftFor([saleSource('t1', 255, 76.5)]);
    await persistSettlementDraft(client, first, submittedOf(first));

    const emptyPreview = draftFor([]);
    const result = await persistSettlementDraft(client, emptyPreview, {
      ...expectedOf(emptyPreview),
      idempotencyKey: first.idempotencyKey,
      payloadFingerprint: 'tampered-fingerprint',
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'PAYLOAD_CONFLICT');
  });

  it('瀏覽器帶別家店的 key 找不到原單，不得回傳別家店的結算', async () => {
    enableWrites();
    const { client, settlements } = fakeClient({
      txns: [
        { id: 't1', merchantId: 'm-1', settlementId: null },
        { id: 't9', merchantId: 'm-2', settlementId: null },
      ],
    });
    const other = draftFor([saleSource('t1', 255, 76.5)]);
    const created = await persistSettlementDraft(client, other, submittedOf(other));
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const mine = draftFor([saleSource('t9', 100, 10)], { merchantId: 'm-2' });
    const result = await persistSettlementDraft(client, mine, {
      ...expectedOf(mine),
      idempotencyKey: other.idempotencyKey,
      payloadFingerprint: other.payloadFingerprint,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.notEqual(result.id, created.id);
    assert.equal(result.duplicate, false);
    assert.equal(settlements.length, 2);
  });

  it('沒有帶原 key 時行為不變：空來源仍回「沒有可結算項目」', async () => {
    enableWrites();
    const { client } = fakeClient();
    const emptyPreview = draftFor([]);
    const result = await persistSettlementDraft(client, emptyPreview, expectedOf(emptyPreview));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'NO_SOURCES');
  });

  it('帶原 key 卻沒帶 fingerprint 時拒絕，不得只憑 key 就回原單', async () => {
    enableWrites();
    const { client } = fakeClient({
      txns: [{ id: 't1', merchantId: 'm-1', settlementId: null }],
    });
    const first = draftFor([saleSource('t1', 255, 76.5)]);
    await persistSettlementDraft(client, first, submittedOf(first));

    const emptyPreview = draftFor([]);
    const result = await persistSettlementDraft(client, emptyPreview, {
      ...expectedOf(emptyPreview),
      idempotencyKey: first.idempotencyKey,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'PAYLOAD_CONFLICT');
  });
});

describe('R7#2：撥款時間一路由資料庫帶出，不得由 status 推導', () => {
  it('新建的待核對草稿帶出 paidAt = null', async () => {
    enableWrites();
    const { client } = fakeClient({
      txns: [{ id: 't1', merchantId: 'm-1', settlementId: null }],
    });
    const draft = draftFor([saleSource('t1', 255, 76.5)]);
    const created = await persistSettlementDraft(client, draft, submittedOf(draft));
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(created.paidAt, null);
  });

  it('重送回原單時帶出資料庫裡真實的 paidAt', async () => {
    enableWrites();
    const { client, settlements } = fakeClient({
      txns: [{ id: 't1', merchantId: 'm-1', settlementId: null }],
    });
    const first = draftFor([saleSource('t1', 255, 76.5)]);
    const created = await persistSettlementDraft(client, first, submittedOf(first));
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const paidAt = at('2024-06-05T10:00:00');
    Object.assign(settlements[0], { status: 'paid', paidAt });

    const emptyPreview = draftFor([]);
    const resend = await persistSettlementDraft(client, emptyPreview, {
      ...expectedOf(emptyPreview),
      idempotencyKey: first.idempotencyKey,
      payloadFingerprint: first.payloadFingerprint,
    });
    assert.equal(resend.ok, true);
    if (!resend.ok) return;
    assert.equal(resend.status, 'paid');
    assert.deepEqual(resend.paidAt, paidAt);
  });

  it('status 是 paid 但沒有 paidAt 時仍照實帶出 null，不得補一個時間', async () => {
    enableWrites();
    const { client, settlements } = fakeClient({
      txns: [{ id: 't1', merchantId: 'm-1', settlementId: null }],
    });
    const first = draftFor([saleSource('t1', 255, 76.5)]);
    await persistSettlementDraft(client, first, submittedOf(first));
    Object.assign(settlements[0], { status: 'paid' });

    const emptyPreview = draftFor([]);
    const resend = await persistSettlementDraft(client, emptyPreview, {
      ...expectedOf(emptyPreview),
      idempotencyKey: first.idempotencyKey,
      payloadFingerprint: first.payloadFingerprint,
    });
    assert.equal(resend.ok, true);
    if (!resend.ok) return;
    assert.equal(resend.status, 'paid');
    assert.equal(resend.paidAt, null);
  });

  it('撤回結果同樣帶出 paidAt', async () => {
    enableWrites();
    const { client } = fakeClient({
      txns: [{ id: 't1', merchantId: 'm-1', settlementId: null }],
    });
    const draft = draftFor([saleSource('t1', 255, 76.5)]);
    const created = await persistSettlementDraft(client, draft, submittedOf(draft));
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const result = await withdrawSettlementDraft(client, {
      merchantId: 'm-1',
      settlementId: created.id,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.status, 'cancelled');
    assert.equal(result.paidAt, null);
  });
});

describe('R7#1：送出前可先依本店 + 原 key 查既有單', () => {
  it('查得到本店原單，查不到別家店的同一把 key', async () => {
    enableWrites();
    const { client } = fakeClient({
      txns: [{ id: 't1', merchantId: 'm-1', settlementId: null }],
    });
    const draft = draftFor([saleSource('t1', 255, 76.5)]);
    const created = await persistSettlementDraft(client, draft, submittedOf(draft));
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const mine = await findSettlementByPreviewKey(client, 'm-1', draft.idempotencyKey);
    assert.equal(mine?.id, created.id);
    assert.equal(mine?.payloadFingerprint, draft.payloadFingerprint);
    assert.equal(mine?.paidAt, null);

    // 別家店拿同一把 key 必須查不到，才不會沿用或洩漏別人的結算。
    assert.equal(await findSettlementByPreviewKey(client, 'm-2', draft.idempotencyKey), null);
  });

  it('資料表還沒建立時回 null，不讓整個送出流程 500', async () => {
    const missingSchema = {
      settlement: {
        findFirst: async () => {
          throw Object.assign(new Error('missing'), { code: 'P2021' });
        },
      },
    } as unknown as PrismaClient;
    assert.equal(await findSettlementByPreviewKey(missingSchema, 'm-1', 'k'), null);
  });

  it('fingerprint 完全一致才回原單，缺少或不符都拒絕', () => {
    const prior = {
      id: 'st-1',
      settlementId: 'SET-202405-001',
      status: 'draft',
      netPayableTwd: 178,
      payloadFingerprint: 'fp-1',
      paidAt: null,
    };

    const match = priorSettlementResult(prior, 'fp-1');
    assert.equal(match.ok, true);
    if (match.ok) {
      assert.equal(match.duplicate, true);
      assert.equal(match.netPayableTwd, 178);
      assert.equal(match.paidAt, null);
    }

    for (const wrong of [undefined, null, 'fp-2'] as const) {
      const rejected = priorSettlementResult(prior, wrong);
      assert.equal(rejected.ok, false);
      if (!rejected.ok) assert.equal(rejected.code, 'PAYLOAD_CONFLICT');
    }
  });
});

describe('刪除守衛', () => {
  it('帶有來源明細或新版標記的結算不得刪除', () => {
    assert.throws(
      () => assertSettlementDeletable({ rulesVersion: POS_SETTLEMENT_RULES_VERSION, sourceItemCount: 0 }),
      /保留稽核/,
    );
    assert.throws(() => assertSettlementDeletable({ rulesVersion: null, sourceItemCount: 2 }), /保留稽核/);
  });

  it('legacy 結算的刪除行為不變', () => {
    assert.doesNotThrow(() => assertSettlementDeletable({ rulesVersion: null, sourceItemCount: 0 }));
  });
});

describe('R5#4：HQ 狀態推進必須驗合法下一步', () => {
  const v1 = POS_SETTLEMENT_RULES_VERSION;

  it('新版只允許逐步推進，並以原狀態當更新條件', () => {
    const steps: Array<[string, string]> = [
      ['draft', 'reviewing'],
      ['reviewing', 'approved'],
      ['approved', 'paid'],
    ];
    for (const [currentStatus, next] of steps) {
      const condition = settlementStatusUpdateCondition({
        rulesVersion: v1,
        currentStatus,
        next,
      });
      // 條件必須是「等於原狀態」，不是「不等於 cancelled」：競態時整筆不動。
      assert.deepEqual(condition.where, { status: currentStatus });
    }
  });

  it('新版不得往回改，已撥款的結算不能被降回 draft', () => {
    // 這是原缺陷的關鍵：被降回 draft 的新版結算會重新符合 POS 撤回條件。
    const illegal: Array<[string, string]> = [
      ['paid', 'draft'],
      ['paid', 'approved'],
      ['approved', 'draft'],
      ['approved', 'reviewing'],
      ['reviewing', 'draft'],
      ['draft', 'approved'],
      ['draft', 'paid'],
      ['reviewing', 'paid'],
    ];
    for (const [currentStatus, next] of illegal) {
      assert.throws(
        () => settlementStatusUpdateCondition({ rulesVersion: v1, currentStatus, next }),
        (error: unknown) =>
          error instanceof Error && error.message === SETTLEMENT_STATUS_TRANSITION_ERROR,
        `${currentStatus} -> ${next} 必須被擋下`,
      );
    }
  });

  it('新版已撤回不得被推回流程復活', () => {
    for (const next of ['draft', 'reviewing', 'approved', 'paid']) {
      assert.throws(
        () =>
          settlementStatusUpdateCondition({
            rulesVersion: v1,
            currentStatus: 'cancelled',
            next,
          }),
        /不是合法的下一步/,
      );
    }
  });

  it('新版已撥款是終點，不得再推進', () => {
    assert.throws(
      () =>
        settlementStatusUpdateCondition({ rulesVersion: v1, currentStatus: 'paid', next: 'paid' }),
      /不是合法的下一步/,
    );
  });

  it('legacy 規則完全不變：仍是「不等於 cancelled」，跳步也照舊允許', () => {
    for (const [currentStatus, next] of [
      ['draft', 'paid'],
      ['paid', 'draft'],
      ['approved', 'reviewing'],
    ]) {
      const condition = settlementStatusUpdateCondition({
        rulesVersion: null,
        currentStatus: currentStatus!,
        next: next!,
      });
      assert.deepEqual(condition.where, { status: { not: 'cancelled' } });
    }
  });

  it('legacy 已撤回仍由條件擋下，不靠例外', () => {
    const condition = settlementStatusUpdateCondition({
      rulesVersion: null,
      currentStatus: 'cancelled',
      next: 'reviewing',
    });
    assert.deepEqual(condition.where, { status: { not: 'cancelled' } });
  });
});
