import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  POS_SETTLEMENT_RULES_VERSION,
  computeLegacyTotals,
} from '@/lib/settlements/source-snapshot';
import {
  SETTLEMENT_INCOMPLETE_SALE_ERROR,
  SETTLEMENT_INVALID_AMOUNT_ERROR,
  SETTLEMENT_SNAPSHOT_BROKEN_ERROR,
  SETTLEMENT_SNAPSHOT_EMPTY_ERROR,
  SETTLEMENT_UNKNOWN_SOURCE_KIND_ERROR,
  SETTLEMENT_UNKNOWN_VERSION_ERROR,
  SETTLEMENT_VOID_STATE_ERROR,
  buildSnapshotView,
  countsTowardValidTotals,
  hasSourceSnapshot,
  isPosSettlementVersion,
  loadActiveSourceKeys,
  verifySnapshotIntegrity,
  type SettlementHeaderRow,
  type SettlementSourceRow,
} from '@/lib/settlements/read-snapshot';

const at = (stamp: string) => new Date(`${stamp}+08:00`);

function sourceRow(overrides: Partial<SettlementSourceRow> = {}): SettlementSourceRow {
  return {
    id: 'item-1',
    sourceKind: 'consignment_sale',
    sourceKey: 'consignment_sale:t1',
    direction: 'STORE_TO_FURMOSA',
    originalAmount: 1000,
    quantity: 4,
    unitPrice: 250,
    commissionAmount: 200,
    companyRevenue: 800,
    occurredAt: at('2024-05-19T11:00:00'),
    relatedOrderId: 'order-1',
    voidedAt: null,
    ...overrides,
  };
}

/** 依規格驗算範例：G=1000 C=200 R=400 S=0 K=120 → payable 600、net +520 */
function sampleSources(): SettlementSourceRow[] {
  return [
    sourceRow(),
    sourceRow({
      id: 'item-2',
      sourceKind: 'coupon_subsidy',
      sourceKey: 'coupon:pt10-400',
      direction: 'FURMOSA_TO_STORE',
      originalAmount: 400,
      quantity: null,
      unitPrice: null,
      commissionAmount: null,
      companyRevenue: null,
    }),
    sourceRow({
      id: 'item-3',
      sourceKind: 'store_collection',
      sourceKey: 'store_collection:pay-1',
      direction: 'STORE_TO_FURMOSA',
      originalAmount: 120,
      quantity: null,
      unitPrice: null,
      commissionAmount: null,
      companyRevenue: null,
    }),
  ];
}

function headerFor(
  sources: readonly SettlementSourceRow[],
  overrides: Partial<SettlementHeaderRow> = {},
): SettlementHeaderRow {
  const totals = computeLegacyTotals(sources);
  return {
    id: 'st-1',
    settlementId: 'SET-202405-001',
    status: 'draft',
    rulesVersion: POS_SETTLEMENT_RULES_VERSION,
    intendedPaymentMethod: 'BANK_TRANSFER',
    netPayableTwd: totals.netPayableTwd,
    storeCollected: totals.storeCollected,
    grossSales: totals.grossSales,
    commissionAmount: totals.commissionAmount,
    rewardPayout: totals.rewardPayout,
    shippingFee: totals.shippingFee,
    merchantOwesUs: totals.merchantOwesUs,
    payable: totals.payable,
    periodStart: at('2024-05-01T00:00:00'),
    periodEnd: at('2024-05-31T23:59:59.999'),
    paidAt: null,
    note: null,
    ...overrides,
  };
}

describe('新版身份只按 rulesVersion 判定', () => {
  it('不以明細列是否存在推測版本', () => {
    assert.equal(isPosSettlementVersion(POS_SETTLEMENT_RULES_VERSION), true);
    assert.equal(isPosSettlementVersion(null), false);
    assert.equal(isPosSettlementVersion('pos-settlement-v9'), false);
    assert.equal(hasSourceSnapshot(null), false);
    assert.equal(hasSourceSnapshot(''), false);
    assert.equal(hasSourceSnapshot('pos-settlement-v9'), true);
  });

  it('legacy 結算走不到快照分支', () => {
    const sources = sampleSources();
    const result = buildSnapshotView(headerFor(sources, { rulesVersion: null }), sources);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, SETTLEMENT_SNAPSHOT_EMPTY_ERROR);
  });
});

describe('R2#2：未知版本與缺欄位必須 fail closed', () => {
  it('未知的非空版本不得套用本版公式解讀', () => {
    const sources = sampleSources();
    const result = buildSnapshotView(
      headerFor(sources, { rulesVersion: 'pos-settlement-v2' }),
      sources,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, SETTLEMENT_UNKNOWN_VERSION_ERROR);
  });

  it('netPayableTwd 為 null 時不得以 0 代替', () => {
    const sources = sampleSources();
    const result = buildSnapshotView(headerFor(sources, { netPayableTwd: null }), sources);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, SETTLEMENT_SNAPSHOT_BROKEN_ERROR);
  });

  it('storeCollected 為 null 同樣 fail closed', () => {
    const sources = sampleSources();
    const result = buildSnapshotView(headerFor(sources, { storeCollected: null }), sources);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, SETTLEMENT_SNAPSHOT_BROKEN_ERROR);
  });

  it('新版標記但完全沒有明細列時給出可讀錯誤', () => {
    const result = buildSnapshotView(headerFor([]), []);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, SETTLEMENT_SNAPSHOT_EMPTY_ERROR);
  });
});

describe('漂移不變條件', () => {
  it('一致的快照可以正常顯示，金額與規格驗算範例相同', () => {
    const sources = sampleSources();
    const result = buildSnapshotView(headerFor(sources), sources);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.view.header.payable, 600);
    assert.equal(result.view.header.merchantOwesUs, 520);
    assert.equal(result.view.netPayableTwd, 520);
    assert.equal(result.view.direction, 'STORE_TO_FURMOSA');
    assert.equal(result.view.activeSources.length, 3);
    assert.equal(result.view.voidedSources.length, 0);
    assert.equal(result.view.withdrawn, false);
  });

  it('legacy Float 合計允許 0.01 容差', () => {
    const sources = sampleSources();
    const header = headerFor(sources);
    assert.equal(verifySnapshotIntegrity({ ...header, grossSales: 1000.004 }, sources).ok, true);
    assert.equal(verifySnapshotIntegrity({ ...header, grossSales: 1000.5 }, sources).ok, false);
  });

  it('已存的整數欄位必須完全相等，不套任何容差', () => {
    const sources = sampleSources();
    const header = headerFor(sources);
    assert.equal(verifySnapshotIntegrity({ ...header, netPayableTwd: 521 }, sources).ok, false);
    assert.equal(verifySnapshotIntegrity({ ...header, storeCollected: 121 }, sources).ok, false);
  });

  it('payable 與 merchantOwesUs 都必須驗算', () => {
    const sources = sampleSources();
    const header = headerFor(sources);
    assert.equal(verifySnapshotIntegrity({ ...header, payable: 599 }, sources).ok, false);
    assert.equal(verifySnapshotIntegrity({ ...header, merchantOwesUs: 519 }, sources).ok, false);
  });

  it('驗算使用 header 已存的運費，不假設 S = 0', () => {
    const sources = sampleSources();
    const withShipping = computeLegacyTotals(sources, { shippingFee: 50 });
    const header = headerFor(sources, {
      shippingFee: 50,
      payable: withShipping.payable,
      merchantOwesUs: withShipping.merchantOwesUs,
      netPayableTwd: withShipping.netPayableTwd,
    });
    assert.equal(verifySnapshotIntegrity(header, sources).ok, true);
  });

  it('R2#3：讀取端與寫入端共用 Decimal 口徑，半元累加不會判為損毀', () => {
    const rows = Array.from({ length: 10 }, (_, index) =>
      sourceRow({
        id: `item-${index}`,
        sourceKey: `consignment_sale:t${index}`,
        originalAmount: 0.1,
        commissionAmount: 0,
        quantity: 1,
        unitPrice: 0.1,
        companyRevenue: 0.1,
      }),
    );
    const floatSum = rows.reduce((sum, row) => sum + row.originalAmount, 0);
    assert.notEqual(floatSum, 1);

    const result = buildSnapshotView(headerFor(rows), rows);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.view.netPayableTwd, 1);
  });
});

describe('R2#1：撤回後仍可查閱送出當時的快照', () => {
  function withdrawn(): { header: SettlementHeaderRow; sources: SettlementSourceRow[] } {
    const active = sampleSources();
    const header = headerFor(active, { status: 'cancelled' });
    const voidedAt = at('2024-05-22T09:00:00');
    return {
      header,
      sources: active.map((row) => ({ ...row, voidedAt })),
    };
  }

  it('全部明細被標 voidedAt 且原淨額非零時不得判為損毀', () => {
    const { header, sources } = withdrawn();
    assert.notEqual(header.netPayableTwd, 0);
    const result = buildSnapshotView(header, sources);
    assert.equal(result.ok, true);
  });

  it('歷史金額原樣保留，不清零', () => {
    const { header, sources } = withdrawn();
    const result = buildSnapshotView(header, sources);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.view.netPayableTwd, 520);
    assert.equal(result.view.header.merchantOwesUs, 520);
  });

  it('稽核來源全部保留，active 為空但 voided 仍可查', () => {
    const { header, sources } = withdrawn();
    const result = buildSnapshotView(header, sources);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.view.auditSources.length, 3);
    assert.equal(result.view.activeSources.length, 0);
    assert.equal(result.view.voidedSources.length, 3);
    assert.equal(result.view.withdrawn, true);
  });

  it('cancelled 從有效財務統計排除', () => {
    const { header, sources } = withdrawn();
    const result = buildSnapshotView(header, sources);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.view.countsTowardValidTotals, false);

    assert.equal(countsTowardValidTotals('cancelled'), false);
    assert.equal(countsTowardValidTotals('draft'), true);
    assert.equal(countsTowardValidTotals('reviewing'), true);
    assert.equal(countsTowardValidTotals('paid'), true);
  });

  it('R3#4：撤回是整張的，draft 卻有部分明細被作廢必須 fail closed', () => {
    const sources = sampleSources();
    const header = headerFor(sources);
    const partial = sources.map((row, index) =>
      index === 0 ? { ...row, voidedAt: at('2024-05-22T09:00:00') } : row,
    );
    const result = buildSnapshotView(header, partial);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error, SETTLEMENT_VOID_STATE_ERROR);
  });

  it('R3#4：cancelled 卻仍有 active 明細也必須 fail closed', () => {
    const sources = sampleSources();
    const header = headerFor(sources, { status: 'cancelled' });
    const partial = sources.map((row, index) =>
      index === 0 ? row : { ...row, voidedAt: at('2024-05-22T09:00:00') },
    );
    const result = buildSnapshotView(header, partial);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error, SETTLEMENT_VOID_STATE_ERROR);
  });
});

describe('R3#5：無法解讀的來源列必須是可讀錯誤而不是 500', () => {
  it('未知 sourceKind 不得被默默當成代收現金', () => {
    const sources = sampleSources();
    const header = headerFor(sources);
    const tampered = sources.map((row, index) =>
      index === 2 ? { ...row, sourceKind: 'mystery_kind' } : row,
    );
    const result = buildSnapshotView(header, tampered);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error, SETTLEMENT_UNKNOWN_SOURCE_KIND_ERROR);
  });

  it('未知 direction 同樣 fail closed', () => {
    const sources = sampleSources();
    const header = headerFor(sources);
    const tampered = sources.map((row, index) =>
      index === 0 ? { ...row, direction: 'SIDEWAYS' } : row,
    );
    const result = buildSnapshotView(header, tampered);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error, SETTLEMENT_UNKNOWN_SOURCE_KIND_ERROR);
  });

  it('非有限金額回傳可讀錯誤，不讓加總拋例外', () => {
    const sources = sampleSources();
    const header = headerFor(sources);
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const tampered = sources.map((row, index) =>
        index === 0 ? { ...row, originalAmount: bad } : row,
      );
      const result = buildSnapshotView(header, tampered);
      assert.equal(result.ok, false);
      if (result.ok) return;
      assert.equal(result.error, SETTLEMENT_INVALID_AMOUNT_ERROR);
    }
  });

  it('寄賣銷售缺數量、單價或分潤時回傳可讀錯誤', () => {
    const sources = sampleSources();
    const header = headerFor(sources);
    for (const missing of [{ quantity: null }, { unitPrice: null }, { commissionAmount: null }]) {
      const tampered = sources.map((row, index) => (index === 0 ? { ...row, ...missing } : row));
      const result = buildSnapshotView(header, tampered);
      assert.equal(result.ok, false);
      if (result.ok) return;
      assert.equal(result.error, SETTLEMENT_INCOMPLETE_SALE_ERROR);
    }
  });

  it('券與代收現金沒有數量單價是正常的，不得誤判', () => {
    const sources = sampleSources();
    const result = buildSnapshotView(headerFor(sources), sources);
    assert.equal(result.ok, true);
  });
});

describe('R3#1：已被 active 唯一鍵鎖住的來源不得再出現在暫計', () => {
  function lockClient(rows: Array<{ merchantId: string; sourceKey: string; voidedAt: Date | null }>) {
    return {
      settlementSourceItem: {
        findMany: async ({ where }: { where: Record<string, unknown> }) =>
          rows.filter(
            (row) =>
              row.merchantId === where.merchantId &&
              ((where.sourceKey as { in: string[] }).in ?? []).includes(row.sourceKey) &&
              (where.voidedAt === null ? row.voidedAt == null : true),
          ),
      },
    } as unknown as Parameters<typeof loadActiveSourceKeys>[0];
  }

  it('只把未作廢的來源視為已鎖，撤回過的要放回暫計', async () => {
    const client = lockClient([
      { merchantId: 'm-1', sourceKey: 'coupon:pt10-200', voidedAt: null },
      { merchantId: 'm-1', sourceKey: 'store_collection:pay-1', voidedAt: at('2024-05-22T09:00:00') },
    ]);
    const result = await loadActiveSourceKeys(client, 'm-1', [
      'coupon:pt10-200',
      'store_collection:pay-1',
      'consignment_sale:t1',
    ]);
    assert.equal(result.available, true);
    assert.deepEqual([...result.lockedKeys], ['coupon:pt10-200']);
  });

  it('不跨店：別家店鎖住同一個券號不影響本店', async () => {
    const client = lockClient([
      { merchantId: 'm-2', sourceKey: 'coupon:pt10-200', voidedAt: null },
    ]);
    const result = await loadActiveSourceKeys(client, 'm-1', ['coupon:pt10-200']);
    assert.equal(result.lockedKeys.size, 0);
  });

  it('沒有來源鍵時不查資料庫', async () => {
    const exploding = new Proxy(
      {},
      {
        get() {
          throw new Error('不應該連資料庫');
        },
      },
    ) as Parameters<typeof loadActiveSourceKeys>[0];
    const result = await loadActiveSourceKeys(exploding, 'm-1', []);
    assert.equal(result.available, true);
    assert.equal(result.lockedKeys.size, 0);
  });

  it('缺表環境標記 unavailable，不假裝沒有鎖', async () => {
    const missing = {
      settlementSourceItem: {
        findMany: async () => {
          throw Object.assign(new Error('missing'), { code: 'P2021' });
        },
      },
    } as unknown as Parameters<typeof loadActiveSourceKeys>[0];
    const result = await loadActiveSourceKeys(missing, 'm-1', ['coupon:pt10-200']);
    assert.equal(result.available, false);
    assert.equal(result.lockedKeys.size, 0);
  });
});
