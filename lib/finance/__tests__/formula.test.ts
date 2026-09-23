import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  contributionMarginCents,
  marginLight,
  productGrossMarginCents,
  projectCashWeeks,
  refillBrandReceiptCents,
  refillChannelShareCents,
  weekNetCents,
} from '@/lib/finance/formula';
import { rateBps } from '@/lib/finance/money';
import { taipeiMonday } from '@/lib/finance/calendar';
import { parseThresholds, parseTwdToCents } from '@/lib/finance/validate';

describe('單位經濟公式', () => {
  it('產品毛利等於售價減食品與包裝，缺成本不算成 0', () => {
    assert.deepEqual(
      productGrossMarginCents({ sellingPriceCents: 10000, foodCostCents: 3000, packagingCostCents: 500 }),
      { ok: true, cents: 6500 },
    );
    assert.deepEqual(
      productGrossMarginCents({ sellingPriceCents: 10000, foodCostCents: null, packagingCostCents: 0 }),
      { ok: false, missing: 'cost' },
    );
    assert.deepEqual(
      productGrossMarginCents({ sellingPriceCents: 10000, foodCostCents: 0, packagingCostCents: 0 }),
      { ok: true, cents: 10000 },
    );
  });

  it('貢獻毛利使用品牌實收，毛利率是貢獻毛利除以品牌實收', () => {
    const result = contributionMarginCents({
      brandReceiptCents: 8000,
      foodCostCents: 3000,
      packagingCostCents: 500,
      otherDirectCostCents: 200,
    });
    assert.equal(result.margin.ok && result.margin.cents, 4300);
    assert.equal(result.rateBps, rateBps(4300, 8000));
  });

  it('缺品牌實收或其他直接成本時，貢獻毛利與毛利率都不計算', () => {
    const missingDirect = contributionMarginCents({
      brandReceiptCents: 8000,
      foodCostCents: 3000,
      packagingCostCents: 500,
      otherDirectCostCents: null,
    });
    assert.deepEqual(missingDirect.margin, { ok: false, missing: 'data' });
    assert.equal(missingDirect.rateBps, null);

    const zeroReceipt = contributionMarginCents({
      brandReceiptCents: 0,
      foodCostCents: 100,
      packagingCostCents: 0,
      otherDirectCostCents: 0,
    });
    assert.equal(zeroReceipt.margin.ok && zeroReceipt.margin.cents, -100);
    assert.equal(zeroReceipt.rateBps, null);
  });

  it('換罐先扣清洗、運輸、團主分潤、中心店分潤，再算貢獻毛利且不重複扣', () => {
    const receipt = refillBrandReceiptCents({
      customerPaidCents: 9900,
      deductions: {
        cleaningCents: 100,
        transportCents: 200,
        groupLeaderShareCents: 300,
        centerShareCents: 400,
      },
    });
    assert.deepEqual(receipt, { ok: true, cents: 8900 });
    assert.deepEqual(
      refillChannelShareCents({
        cleaningCents: 100,
        transportCents: 200,
        groupLeaderShareCents: 300,
        centerShareCents: 400,
      }),
      { ok: true, cents: 700 },
    );
    const margin = contributionMarginCents({
      brandReceiptCents: receipt.ok ? receipt.cents : null,
      foodCostCents: 2000,
      packagingCostCents: 500,
      otherDirectCostCents: 100,
    });
    assert.equal(margin.margin.ok && margin.margin.cents, 6300);
    assert.deepEqual(
      refillBrandReceiptCents({
        customerPaidCents: 9900,
        deductions: {
          cleaningCents: null,
          transportCents: 0,
          groupLeaderShareCents: 0,
          centerShareCents: 0,
        },
      }),
      { ok: false, missing: 'data' },
    );
  });

  it('燈號預設 45% 含以上綠、30% 到未滿 45% 黃、低於 30% 紅，門檻可改', () => {
    const defaults = { greenMinBps: 4500, yellowMinBps: 3000 };
    assert.equal(marginLight(4500, defaults), 'green');
    assert.equal(marginLight(4499, defaults), 'yellow');
    assert.equal(marginLight(3000, defaults), 'yellow');
    assert.equal(marginLight(2999, defaults), 'red');
    const custom = { greenMinBps: 5000, yellowMinBps: 2000 };
    assert.equal(marginLight(5000, custom), 'green');
    assert.equal(marginLight(2000, custom), 'yellow');
    assert.equal(marginLight(1999, custom), 'red');
  });

  it('現金流任一格空白就讓該週與之後的餘額保持缺資料', () => {
    const full = {
      inflowCents: 10000,
      supplierPaymentCents: 2000,
      packagingCents: 500,
      payrollCents: 3000,
      adsCents: 400,
      logisticsCents: 100,
      samplingCents: 0,
    };
    const net = weekNetCents(full);
    assert.equal(net.ok ? net.cents : null, 4000);
    assert.equal(weekNetCents({ ...full, adsCents: null }).ok, false);
    const projected = projectCashWeeks({
      openingBalanceCents: 5000,
      minimumCashCents: 6000,
      weeks: [full, { ...full, inflowCents: null }, full],
    });
    assert.equal(projected[0]?.ending.ok && projected[0].ending.cents, 9000);
    assert.equal(projected[0]?.belowMinimum, false);
    assert.equal(projected[1]?.ending.ok, false);
    assert.equal(projected[2]?.ending.ok, false);
    const low = projectCashWeeks({
      openingBalanceCents: 1000,
      minimumCashCents: 6000,
      weeks: [full],
    });
    const lowEnding = low[0]?.ending;
    assert.equal(lowEnding?.ok === true ? lowEnding.cents : null, 5000);
    assert.equal(low[0]?.belowMinimum, true);
    const under = projectCashWeeks({
      openingBalanceCents: 1000,
      minimumCashCents: 6000,
      weeks: [{ ...full, inflowCents: 0 }],
    });
    assert.equal(under[0]?.belowMinimum, true);
  });

  it('空白金額是待補，0 是真的零；門檻必須綠燈高於黃燈', () => {
    assert.deepEqual(parseTwdToCents(''), { ok: true, cents: null });
    assert.deepEqual(parseTwdToCents('0'), { ok: true, cents: 0 });
    assert.deepEqual(parseTwdToCents('12.5'), { ok: true, cents: 1250 });
    assert.equal(parseTwdToCents('-1').ok, false);
    assert.equal(parseThresholds('45', '30').ok, true);
    assert.equal(parseThresholds('30', '45').ok, false);
  });

  it('13 週標籤使用台北週一', () => {
    assert.equal(taipeiMonday(new Date('2026-09-23T04:00:00.000Z')), '2026-09-21');
  });
});
