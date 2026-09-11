import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  amountsDigest,
  assertIntegerTwdRange,
  buildIdempotencyKey,
  classifyConsignmentSaleTxn,
  classifyCouponSource,
  computeLegacyTotals,
  consignmentSaleSourceKey,
  consignmentSaleTxnIdFromKey,
  couponSourceKey,
  dedupeSources,
  halfAwayFromZero,
  normalizeCouponCode,
  sourceKeysDigest,
  storeCollectionSource,
  withinLegacyTolerance,
  type SettlementSourceDraft,
} from '@/lib/settlements/source-snapshot';

const at = (stamp: string) => new Date(`${stamp}+08:00`);

function saleTxn(overrides: Partial<Parameters<typeof classifyConsignmentSaleTxn>[0]> = {}) {
  return {
    id: 'txn-1',
    txnNumber: 'MTXN-202605-0001',
    type: 'sale',
    quantity: -1,
    unitPrice: 255,
    commissionAmount: 76.5,
    companyRevenue: 178.5,
    orderId: 'order-1',
    orderNumber: 'SO-240519-001',
    productId: 'prod-1',
    productName: '凍乾雞胸',
    createdAt: at('2024-05-19T11:00:00'),
    ...overrides,
  };
}

function couponDraft(overrides: Partial<SettlementSourceDraft> = {}): SettlementSourceDraft {
  return {
    sourceKind: 'coupon_subsidy',
    sourceKey: couponSourceKey('pt10-200'),
    direction: 'FURMOSA_TO_STORE',
    originalAmount: 200,
    quantity: null,
    unitPrice: null,
    commissionAmount: null,
    companyRevenue: null,
    occurredAt: at('2024-05-19T15:00:00'),
    relatedOrderId: null,
    label: '王小姐 集點兌換券 PT10-200',
    sourceSnapshot: { model: 'grooming_coupon' },
    ...overrides,
  };
}

describe('精度：只在最終淨額進位一次', () => {
  it('half-away-from-zero 在正負半元都遠離零', () => {
    assert.equal(halfAwayFromZero(76.5), 77);
    assert.equal(halfAwayFromZero(-76.5), -77);
    assert.equal(halfAwayFromZero(0.5), 1);
    assert.equal(halfAwayFromZero(-0.5), -1);
    assert.equal(halfAwayFromZero(0), 0);
    // Math.round(-76.5) 會得到 -76，刻意不使用。
    assert.notEqual(halfAwayFromZero(-76.5), Math.round(-76.5));
  });

  it('拒絕非有限數值與超出整數台幣範圍的值', () => {
    assert.throws(() => halfAwayFromZero(Number.POSITIVE_INFINITY), /有限數值/);
    assert.throws(() => assertIntegerTwdRange(1.5, '本期淨額'), /整數台幣/);
    assert.throws(() => assertIntegerTwdRange(2147483648, '本期淨額'), /可儲存範圍/);
    assert.equal(assertIntegerTwdRange(-520, '本期淨額'), -520);
  });

  it('255 × 30% = 76.5 的半元逐欄保留，不被容差抹掉', () => {
    const classified = classifyConsignmentSaleTxn(saleTxn());
    assert.equal(classified.kind, 'source');
    if (classified.kind !== 'source') return;
    assert.equal(classified.source.commissionAmount, 76.5);
    assert.equal(classified.source.originalAmount, 255);
  });

  it('legacy 容差只用於 Float 合計比較', () => {
    assert.equal(withinLegacyTolerance(178.5, 178.504), true);
    assert.equal(withinLegacyTolerance(178.5, 178.52), false);
  });
});

describe('legacy 欄位公式 G/C/R/S/K', () => {
  function sources(): SettlementSourceDraft[] {
    return [
      {
        ...couponDraft(),
        sourceKind: 'consignment_sale',
        sourceKey: consignmentSaleSourceKey('t1'),
        direction: 'STORE_TO_FURMOSA',
        originalAmount: 1000,
        commissionAmount: 200,
        sourceSnapshot: {},
      },
      couponDraft({ originalAmount: 400 }),
      {
        ...couponDraft(),
        sourceKind: 'store_collection',
        sourceKey: 'store_collection:p1',
        direction: 'STORE_TO_FURMOSA',
        originalAmount: 120,
        sourceSnapshot: {},
      },
    ];
  }

  it('依規格驗算範例：G=1000 C=200 R=400 S=0 K=120', () => {
    const totals = computeLegacyTotals(sources());
    assert.equal(totals.grossSales, 1000);
    assert.equal(totals.commissionAmount, 200);
    assert.equal(totals.rewardPayout, 400);
    assert.equal(totals.shippingFee, 0);
    assert.equal(totals.storeCollected, 120);
    assert.equal(totals.payable, 600);
    assert.equal(totals.merchantOwesUs, 520);
    assert.equal(totals.netPayableTwd, 520);
    assert.equal(totals.direction, 'STORE_TO_FURMOSA');
    assert.equal(totals.commissionRate, 0.2);
  });

  it('負淨額代表公司應付店家，零淨額為相抵', () => {
    const negative = computeLegacyTotals([couponDraft({ originalAmount: 250 })]);
    assert.equal(negative.netPayableTwd, -250);
    assert.equal(negative.direction, 'FURMOSA_TO_STORE');

    const zero = computeLegacyTotals([]);
    assert.equal(zero.netPayableTwd, 0);
    assert.equal(zero.direction, 'NONE');
    assert.equal(zero.commissionRate, 0);
  });

  it('R2#3：加總走 Prisma.Decimal，與 JS 浮點累加不同口徑', () => {
    const rows = Array.from({ length: 10 }, (_, index) => ({
      ...couponDraft(),
      sourceKind: 'consignment_sale' as const,
      sourceKey: consignmentSaleSourceKey(`t${index}`),
      direction: 'STORE_TO_FURMOSA' as const,
      originalAmount: 0.1,
      commissionAmount: 0,
      sourceSnapshot: {},
    }));

    const floatSum = rows.reduce((sum, row) => sum + row.originalAmount, 0);
    assert.notEqual(floatSum, 1);

    const totals = computeLegacyTotals(rows);
    assert.equal(totals.grossSales, 1);
    assert.equal(totals.merchantOwesUs, 1);
  });

  it('運費可由呼叫端帶入，讀取端才能用 header 已存的 S 驗算', () => {
    const totals = computeLegacyTotals([couponDraft({ originalAmount: 100 })], {
      shippingFee: 50,
    });
    assert.equal(totals.shippingFee, 50);
    assert.equal(totals.payable, 150);
    assert.equal(totals.merchantOwesUs, -150);
  });
});

describe('canonical key', () => {
  it('寄賣銷售 key 可往返反解流水 id', () => {
    const key = consignmentSaleSourceKey('txn-abc');
    assert.equal(key, 'consignment_sale:txn-abc');
    assert.equal(consignmentSaleTxnIdFromKey(key), 'txn-abc');
    assert.equal(consignmentSaleTxnIdFromKey('coupon:pt10'), null);
    assert.equal(consignmentSaleTxnIdFromKey('consignment_sale:'), null);
  });

  it('券號正規化：空白視為沒有券號', () => {
    assert.equal(normalizeCouponCode('  PT10-200 '), 'pt10-200');
    assert.equal(normalizeCouponCode('   '), null);
    assert.equal(normalizeCouponCode(null), null);
  });
});

describe('來源分類：只認可信成交價', () => {
  it('缺 unitPrice 或 commissionAmount 一律待確認', () => {
    const noPrice = classifyConsignmentSaleTxn(saleTxn({ unitPrice: null }));
    assert.equal(noPrice.kind, 'pending');
    if (noPrice.kind === 'pending') {
      assert.equal(noPrice.pending.reason, 'SALE_MISSING_PRICE');
      assert.match(noPrice.pending.reasonLabel, /人工確認/);
    }

    const noCommission = classifyConsignmentSaleTxn(saleTxn({ commissionAmount: null }));
    assert.equal(noCommission.kind, 'pending');
  });

  it('公司實收與成交額減分潤不符時待確認，不自行更正', () => {
    const mismatch = classifyConsignmentSaleTxn(saleTxn({ companyRevenue: 100 }));
    assert.equal(mismatch.kind, 'pending');
    if (mismatch.kind === 'pending') {
      assert.equal(mismatch.pending.reason, 'SALE_COMPANY_REVENUE_MISMATCH');
    }
  });

  it('盤點減損沒有成交價，永遠待確認', () => {
    const stocktake = classifyConsignmentSaleTxn(
      saleTxn({ type: 'adjust', unitPrice: null, commissionAmount: null }),
    );
    assert.equal(stocktake.kind, 'pending');
    if (stocktake.kind === 'pending') {
      assert.equal(stocktake.pending.reason, 'STOCKTAKE_REDUCTION');
    }
  });

  it('券號缺失或只靠店名歸屬都待確認，不占唯一鍵', () => {
    const noCode = classifyCouponSource({
      id: 'cpn-1',
      model: 'grooming_coupon',
      rawCouponCode: null,
      faceValue: 200,
      redeemedAt: at('2024-05-19T15:00:00'),
      storeAttributionReliable: true,
      customerName: '王小姐',
      relatedOrderId: null,
    });
    assert.equal(noCode.kind, 'pending');
    if (noCode.kind === 'pending') assert.equal(noCode.pending.reason, 'COUPON_CODE_MISSING');

    const ambiguous = classifyCouponSource({
      id: 'cpn-2',
      model: 'grooming_coupon',
      rawCouponCode: 'PT10-200',
      faceValue: 200,
      redeemedAt: at('2024-05-19T15:00:00'),
      storeAttributionReliable: false,
      customerName: '王小姐',
      relatedOrderId: null,
    });
    assert.equal(ambiguous.kind, 'pending');
    if (ambiguous.kind === 'pending') {
      assert.equal(ambiguous.pending.reason, 'COUPON_STORE_AMBIGUOUS');
    }
  });

  it('店家代收現金以 paymentId 為 canonical key', () => {
    const source = storeCollectionSource({
      paymentId: 'pay-30',
      amount: 30,
      occurredAt: at('2024-05-20T14:32:00'),
      relatedOrderId: 'refill-12',
      label: '王小姐 忘記帶空罐',
      snapshot: { paymentId: 'pay-30' },
    });
    assert.equal(source.sourceKey, 'store_collection:pay-30');
    assert.equal(source.direction, 'STORE_TO_FURMOSA');
  });
});

describe('R2#6：券跨來源去重不得靜默選一邊', () => {
  it('面額與方向一致時視為同一張券的鏡像，以 GroomingCoupon 為準', () => {
    const result = dedupeSources([
      couponDraft({ sourceSnapshot: { model: 'reward_redemption' } }),
      couponDraft({ sourceSnapshot: { model: 'grooming_coupon' } }),
    ]);
    assert.equal(result.sources.length, 1);
    assert.equal(result.sources[0]?.sourceSnapshot.model, 'grooming_coupon');
    assert.equal(result.conflicts.length, 0);
  });

  it('面額衝突時兩邊都不認列，產生待確認且不占唯一鍵', () => {
    const result = dedupeSources([
      couponDraft({ originalAmount: 200, sourceSnapshot: { model: 'grooming_coupon' } }),
      couponDraft({ originalAmount: 250, sourceSnapshot: { model: 'reward_redemption' } }),
    ]);
    assert.equal(result.sources.length, 0);
    assert.equal(result.conflicts.length, 1);
    assert.equal(result.conflicts[0]?.reason, 'COUPON_SOURCE_CONFLICT');
    assert.match(result.conflicts[0]?.reasonLabel ?? '', /不會自行選一邊/);
  });

  it('方向衝突同樣不認列', () => {
    const result = dedupeSources([
      couponDraft({ direction: 'FURMOSA_TO_STORE' }),
      couponDraft({ direction: 'STORE_TO_FURMOSA' }),
    ]);
    assert.equal(result.sources.length, 0);
    assert.equal(result.conflicts.length, 1);
  });

  it('非券來源的鍵重複屬上游程式錯誤，直接拋錯', () => {
    const sale = {
      ...couponDraft(),
      sourceKind: 'consignment_sale' as const,
      sourceKey: consignmentSaleSourceKey('t1'),
      sourceSnapshot: {},
    };
    assert.throws(() => dedupeSources([sale, sale]), /來源鍵重複/);
  });
});

describe('R2#5：fingerprint 必須涵蓋來源原值', () => {
  function sale(quantity: number, unitPrice: number): SettlementSourceDraft {
    return {
      ...couponDraft(),
      sourceKind: 'consignment_sale',
      sourceKey: consignmentSaleSourceKey('t1'),
      direction: 'STORE_TO_FURMOSA',
      originalAmount: quantity * unitPrice,
      quantity,
      unitPrice,
      commissionAmount: 0,
      companyRevenue: quantity * unitPrice,
      sourceSnapshot: {},
    };
  }

  it('2 × 100 與 4 × 50 的 originalAmount 相同，摘要必須不同', () => {
    const a = [sale(2, 100)];
    const b = [sale(4, 50)];
    assert.equal(a[0]!.originalAmount, b[0]!.originalAmount);
    assert.equal(sourceKeysDigest(a), sourceKeysDigest(b));
    assert.notEqual(
      amountsDigest(a, computeLegacyTotals(a)),
      amountsDigest(b, computeLegacyTotals(b)),
    );
  });

  it('companyRevenue 變更也會改變摘要', () => {
    const base = [sale(2, 100)];
    const changed = [{ ...base[0]!, companyRevenue: 199 }];
    assert.notEqual(
      amountsDigest(base, computeLegacyTotals(base)),
      amountsDigest(changed, computeLegacyTotals(changed)),
    );
  });

  it('來源集合摘要只看 key，順序不影響結果', () => {
    const one = couponDraft({ sourceKey: 'coupon:a' });
    const two = couponDraft({ sourceKey: 'coupon:b' });
    assert.equal(sourceKeysDigest([one, two]), sourceKeysDigest([two, one]));
  });
});

describe('R2#4：操作 key 必須含伺服器推導的操作序號', () => {
  const base = {
    merchantId: 'm-1',
    periodStart: at('2024-05-01T00:00:00'),
    periodEnd: at('2024-05-31T23:59:59.999'),
    sourceKeysDigest: 'digest-1',
    intendedPaymentMethod: 'BANK_TRANSFER',
  };

  it('同一次送出重送得到同一個 key', () => {
    assert.equal(
      buildIdempotencyKey({ ...base, operationSeq: 0 }),
      buildIdempotencyKey({ ...base, operationSeq: 0 }),
    );
  });

  it('撤回後序號改變即產生新 key，舊 key 仍指向原本那張', () => {
    const first = buildIdempotencyKey({ ...base, operationSeq: 0 });
    const afterWithdraw = buildIdempotencyKey({ ...base, operationSeq: 1 });
    assert.notEqual(first, afterWithdraw);
    assert.equal(first, buildIdempotencyKey({ ...base, operationSeq: 0 }));
  });

  it('付款方式仍然納入 key', () => {
    assert.notEqual(
      buildIdempotencyKey({ ...base, operationSeq: 0 }),
      buildIdempotencyKey({ ...base, operationSeq: 0, intendedPaymentMethod: 'FURMOSA_BALANCE' }),
    );
  });

  it('序號必須是非負整數', () => {
    assert.throws(() => buildIdempotencyKey({ ...base, operationSeq: -1 }), /非負整數/);
    assert.throws(() => buildIdempotencyKey({ ...base, operationSeq: 1.5 }), /非負整數/);
  });
});
