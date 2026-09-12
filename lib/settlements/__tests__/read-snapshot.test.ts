import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  POS_SETTLEMENT_RULES_VERSION,
  computeLegacyTotals,
} from '@/lib/settlements/source-snapshot';
import {
  SETTLEMENT_INCOMPLETE_SALE_ERROR,
  SETTLEMENT_INVALID_AMOUNT_ERROR,
  SETTLEMENT_INVALID_HEADER_ERROR,
  SETTLEMENT_SNAPSHOT_BROKEN_ERROR,
  SETTLEMENT_SNAPSHOT_EMPTY_ERROR,
  SETTLEMENT_UNKNOWN_SOURCE_KIND_ERROR,
  SETTLEMENT_UNKNOWN_VERSION_ERROR,
  SETTLEMENT_VOID_STATE_ERROR,
  buildSnapshotView,
  countsTowardValidTotals,
  formatSourceAmount,
  formatTaipeiDate,
  formatTaipeiDateTime,
  hasSourceSnapshot,
  isPosSettlementVersion,
  loadActiveSourceKeys,
  validateSnapshotHeader,
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

describe('R4#3：非法 header 與整數溢位必須是可讀錯誤', () => {
  it('legacy Float 欄位非有限時不進 Decimal 加總', () => {
    const sources = sampleSources();
    for (const field of [
      'grossSales',
      'commissionAmount',
      'rewardPayout',
      'shippingFee',
      'merchantOwesUs',
      'payable',
    ] as const) {
      for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
        const header = headerFor(sources, { [field]: bad });
        const result = buildSnapshotView(header, sources);
        assert.equal(result.ok, false, `${field}=${bad} 應該 fail closed`);
        if (result.ok) return;
        assert.equal(result.error, SETTLEMENT_INVALID_HEADER_ERROR);
      }
    }
  });

  it('已存整數淨額不是整數或超出可儲存範圍時 fail closed', () => {
    const sources = sampleSources();
    for (const bad of [520.5, Number.NaN, 2147483648, -2147483649]) {
      const netResult = buildSnapshotView(headerFor(sources, { netPayableTwd: bad }), sources);
      assert.equal(netResult.ok, false, `netPayableTwd=${bad} 應該 fail closed`);
      if (!netResult.ok) assert.equal(netResult.error, SETTLEMENT_INVALID_HEADER_ERROR);

      const collectedResult = buildSnapshotView(
        headerFor(sources, { storeCollected: bad }),
        sources,
      );
      assert.equal(collectedResult.ok, false, `storeCollected=${bad} 應該 fail closed`);
      if (!collectedResult.ok) {
        assert.equal(collectedResult.error, SETTLEMENT_INVALID_HEADER_ERROR);
      }
    }
  });

  it('validateSnapshotHeader 對正常 header 放行', () => {
    const sources = sampleSources();
    assert.deepEqual(validateSnapshotHeader(headerFor(sources)), { ok: true });
  });

  it('逐列合法但加總後溢位時回傳可讀錯誤，不冒泡成 500', () => {
    // 每一列都是有限數值，過得了逐列檢查；加總後才超出整數台幣範圍。
    const huge = [
      sourceRow({ id: 'big-1', originalAmount: 2e9, quantity: 1, unitPrice: 2e9, commissionAmount: 0 }),
      sourceRow({
        id: 'big-2',
        sourceKey: 'consignment_sale:t2',
        originalAmount: 2e9,
        quantity: 1,
        unitPrice: 2e9,
        commissionAmount: 0,
      }),
    ];
    // header 的數字本身合法，所以一定是加總那一步丟錯。
    const header = headerFor(sampleSources(), { grossSales: 4e9, merchantOwesUs: 4e9, payable: 0 });
    const result = buildSnapshotView(header, huge);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error, SETTLEMENT_INVALID_AMOUNT_ERROR);
  });
});

describe('R5#5：來源與分潤必須顯示原始小數', () => {
  it('半元不得被四捨五入成整數', () => {
    // 原缺陷：lib/format.ts 的 formatCurrency 把 76.5 顯示成 NT$77，
    // 畫面數字與快照存下的來源值不符，對帳查不出差額來源。
    assert.equal(formatSourceAmount(76.5), 'NT$76.5');
    assert.equal(formatSourceAmount(178.5), 'NT$178.5');
    assert.equal(formatSourceAmount(0.5), 'NT$0.5');
  });

  it('整數仍然沒有多餘小數位', () => {
    assert.equal(formatSourceAmount(255), 'NT$255');
    assert.equal(formatSourceAmount(0), 'NT$0');
  });

  it('千分位分組不變，且不因分組丟掉小數', () => {
    assert.equal(formatSourceAmount(1234), 'NT$1,234');
    assert.equal(formatSourceAmount(1234567.25), 'NT$1,234,567.25');
  });

  it('負值保留負號', () => {
    assert.equal(formatSourceAmount(-76.5), '-NT$76.5');
    assert.equal(formatSourceAmount(-1200), '-NT$1,200');
  });

  it('非有限數值不得顯示成金額', () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      assert.equal(formatSourceAmount(value), '—');
    }
  });

  it('多位小數不截斷：三成分潤的零頭要看得到', () => {
    assert.equal(formatSourceAmount(85.25), 'NT$85.25');
    assert.equal(formatSourceAmount(25.575), 'NT$25.575');
  });
});

/**
 * 台北期間起日的邊界時刻：`parseTaipeiDateRange('2026-09-01', ...)` 產生的起日，
 * 在 UTC 日曆上是 8/31。HQ 原本用 `lib/format.ts` 的 date-fns 口徑（本機時區），
 * 在 UTC 伺服器上就顯示成 2026/08/31，和 POS 的 2026/09/01 差一天。
 */
const PERIOD_START_UTC = '2026-08-31T16:00:00.000Z';
/** 台北期間迄日 2026-09-12 23:59:59.999，UTC 日曆上仍是 9/12。 */
const PERIOD_END_UTC = '2026-09-12T15:59:59.999Z';

/** POS `settle-workspace.tsx` 既有的台北顯示口徑，用來交叉比對 HQ 是否真的一致。 */
function posTaipeiDay(iso: string): string {
  return new Date(iso).toLocaleDateString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function posTaipeiDateTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function readRepoFile(relativePath: string): string {
  return readFileSync(new URL(`../../../${relativePath}`, import.meta.url), 'utf8');
}

describe('R8：HQ 新版頁面的日期必須與 POS 同為台北時區', () => {
  it('台北 9/1 00:00 的期間起日顯示 2026/09/01，不是 UTC 日曆的 08/31', () => {
    // UTC 日曆確實是 8/31：這就是原缺陷會少一天的原因。
    assert.equal(PERIOD_START_UTC.slice(0, 10), '2026-08-31');
    assert.equal(formatTaipeiDate(PERIOD_START_UTC), '2026/09/01');
    assert.equal(formatTaipeiDate(new Date(PERIOD_START_UTC)), '2026/09/01');
  });

  it('同一時刻的時間顯示是台北時間 00:00，且午夜不得寫成 24:00', () => {
    assert.equal(formatTaipeiDateTime(PERIOD_START_UTC), '2026/09/01 00:00');
    assert.equal(formatTaipeiDateTime(new Date(PERIOD_START_UTC)), '2026/09/01 00:00');
  });

  it('期間迄日 23:59:59.999 仍留在同一個台北日曆日', () => {
    assert.equal(formatTaipeiDate(PERIOD_END_UTC), '2026/09/12');
    assert.equal(formatTaipeiDateTime(PERIOD_END_UTC), '2026/09/12 23:59');
  });

  it('隔離實機看到的整段期間：HQ 顯示 2026/09/01 ~ 2026/09/12', () => {
    const label = `${formatTaipeiDate(PERIOD_START_UTC)} ~ ${formatTaipeiDate(PERIOD_END_UTC)}`;
    assert.equal(label, '2026/09/01 ~ 2026/09/12');
  });

  it('與 POS 既有台北口徑逐字相同，不是各算一套', () => {
    for (const iso of [PERIOD_START_UTC, PERIOD_END_UTC, '2026-09-05T04:07:00.000Z']) {
      assert.equal(formatTaipeiDate(iso), posTaipeiDay(iso));
      assert.equal(formatTaipeiDateTime(iso), posTaipeiDateTime(iso));
    }
  });

  it('不受執行環境時區影響：UTC 與其他非台北時區都得到同一個字串', () => {
    // 這幾個時區會把同一時刻算成不同日曆日（紐約 8/31、Kiritimati 9/1），
    // 所以只要實作有殘留本機時區依賴，這個斷言就會失敗。
    const original = process.env.TZ;
    try {
      for (const tz of ['UTC', 'America/New_York', 'Pacific/Kiritimati', 'Europe/London']) {
        process.env.TZ = tz;
        assert.equal(formatTaipeiDate(PERIOD_START_UTC), '2026/09/01', tz);
        assert.equal(formatTaipeiDateTime(PERIOD_START_UTC), '2026/09/01 00:00', tz);
        assert.equal(formatTaipeiDate(PERIOD_END_UTC), '2026/09/12', tz);
      }
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });

  it('空值與無法解讀的時間顯示破折號，不得出現 Invalid Date', () => {
    for (const value of [null, undefined, '', '不是日期', new Date(Number.NaN)]) {
      assert.equal(formatTaipeiDate(value), '—');
      assert.equal(formatTaipeiDateTime(value), '—');
    }
  });

  it('新版快照元件的期間、撥款時間與來源時間都不再走本機時區', () => {
    const source = readRepoFile('components/settlements/snapshot-detail.tsx');
    assert.match(source, /formatTaipeiDate\(header\.periodStart\)/);
    assert.match(source, /formatTaipeiDate\(header\.periodEnd\)/);
    assert.match(source, /formatTaipeiDateTime\(header\.paidAt\)/);
    assert.match(source, /formatTaipeiDateTime\(row\.occurredAt\)/);
    assert.doesNotMatch(source, /\bformatDate\b/);
    assert.doesNotMatch(source, /\bformatDateTime\b/);
  });

  it('HQ 明細頁只有新版頁首改台北，legacy 分支的既有顯示不動', () => {
    const source = readRepoFile('app/(main)/merchants/(hub)/settlements/[id]/page.tsx');
    assert.equal(
      source.match(/formatTaipeiDate\(settlement\.period(Start|End)\)/g)?.length,
      2,
      '新版分支頁首必須用台北口徑',
    );
    // legacy 分支（calcSettlement 路徑）仍使用原本的 lib/format 口徑，未經授權不得變更。
    assert.equal(
      source.match(/formatDate\(settlement\.period(Start|End)\)/g)?.length,
      4,
      'legacy 頁首與摘要的既有 formatDate 必須保留',
    );
    assert.match(source, /formatDateTime\(settlement\.paidAt\)/);
  });

  it('POS 歷史的期間與撥款時間仍明確指定台北，沒有被本輪改動', () => {
    const source = readRepoFile('components/pos/settle-workspace.tsx');
    assert.match(source, /taipeiDay\(row\.periodStart\)/);
    assert.match(source, /row\.paidAt && row\.status === 'paid' \? taipeiDateTime\(row\.paidAt\)/);
    assert.equal(source.match(/timeZone: 'Asia\/Taipei'/g)?.length, 2);
  });
});
