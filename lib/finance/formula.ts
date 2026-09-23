import { rateBps } from '@/lib/finance/money';

export const DEFAULT_GREEN_MIN_BPS = 4500;
export const DEFAULT_YELLOW_MIN_BPS = 3000;

export type MissingKind = 'cost' | 'data';

export type AmountResult =
  | { ok: true; cents: number }
  | { ok: false; missing: MissingKind };

export type MarginThresholds = {
  greenMinBps: number;
  yellowMinBps: number;
};

export type MarginLight = 'green' | 'yellow' | 'red';

export type RefillDeductions = {
  cleaningCents: number | null;
  transportCents: number | null;
  groupLeaderShareCents: number | null;
  centerShareCents: number | null;
};

export function productGrossMarginCents(input: {
  sellingPriceCents: number | null;
  foodCostCents: number | null;
  packagingCostCents: number | null;
}): AmountResult {
  if (input.sellingPriceCents == null) return { ok: false, missing: 'data' };
  if (input.foodCostCents == null || input.packagingCostCents == null) {
    return { ok: false, missing: 'cost' };
  }
  return {
    ok: true,
    cents: input.sellingPriceCents - input.foodCostCents - input.packagingCostCents,
  };
}

export function refillBrandReceiptCents(input: {
  customerPaidCents: number | null;
  deductions: RefillDeductions;
}): AmountResult {
  const parts = [
    input.deductions.cleaningCents,
    input.deductions.transportCents,
    input.deductions.groupLeaderShareCents,
    input.deductions.centerShareCents,
  ];
  if (input.customerPaidCents == null || parts.some((part) => part == null)) {
    return { ok: false, missing: 'data' };
  }
  const deducted =
    (input.deductions.cleaningCents ?? 0) +
    (input.deductions.transportCents ?? 0) +
    (input.deductions.groupLeaderShareCents ?? 0) +
    (input.deductions.centerShareCents ?? 0);
  return { ok: true, cents: input.customerPaidCents - deducted };
}

export function refillChannelShareCents(deductions: RefillDeductions): AmountResult {
  if (deductions.groupLeaderShareCents == null || deductions.centerShareCents == null) {
    return { ok: false, missing: 'data' };
  }
  return {
    ok: true,
    cents: deductions.groupLeaderShareCents + deductions.centerShareCents,
  };
}

/**
 * 貢獻毛利 = 品牌實收 - 食品成本 - 包裝成本 - 該通路其他直接變動成本。
 * 換罐的清洗、運輸、團主與中心分潤要先從顧客付款得到品牌實收，這裡不再扣第二次。
 */
export function contributionMarginCents(input: {
  brandReceiptCents: number | null;
  foodCostCents: number | null;
  packagingCostCents: number | null;
  otherDirectCostCents: number | null;
}): { margin: AmountResult; rateBps: number | null } {
  if (input.foodCostCents == null || input.packagingCostCents == null) {
    return { margin: { ok: false, missing: 'cost' }, rateBps: null };
  }
  if (input.brandReceiptCents == null || input.otherDirectCostCents == null) {
    return { margin: { ok: false, missing: 'data' }, rateBps: null };
  }
  const cents =
    input.brandReceiptCents -
    input.foodCostCents -
    input.packagingCostCents -
    input.otherDirectCostCents;
  return {
    margin: { ok: true, cents },
    rateBps: rateBps(cents, input.brandReceiptCents),
  };
}

export function marginLight(rate: number, thresholds: MarginThresholds): MarginLight {
  if (rate >= thresholds.greenMinBps) return 'green';
  if (rate >= thresholds.yellowMinBps) return 'yellow';
  return 'red';
}

export type CashWeekInput = {
  inflowCents: number | null;
  supplierPaymentCents: number | null;
  packagingCents: number | null;
  payrollCents: number | null;
  adsCents: number | null;
  logisticsCents: number | null;
  samplingCents: number | null;
};

export function emptyCashWeek(): CashWeekInput {
  return {
    inflowCents: null,
    supplierPaymentCents: null,
    packagingCents: null,
    payrollCents: null,
    adsCents: null,
    logisticsCents: null,
    samplingCents: null,
  };
}

export function weekNetCents(week: CashWeekInput): AmountResult {
  const values = [
    week.inflowCents,
    week.supplierPaymentCents,
    week.packagingCents,
    week.payrollCents,
    week.adsCents,
    week.logisticsCents,
    week.samplingCents,
  ];
  if (values.some((value) => value == null)) return { ok: false, missing: 'data' };
  const [inflow, supplier, packaging, payroll, ads, logistics, sampling] = values as number[];
  return {
    ok: true,
    cents: inflow - supplier - packaging - payroll - ads - logistics - sampling,
  };
}

export type ProjectedCashWeek = {
  net: AmountResult;
  ending: AmountResult;
  belowMinimum: boolean | null;
};

export function projectCashWeeks(input: {
  openingBalanceCents: number | null;
  minimumCashCents: number | null;
  weeks: CashWeekInput[];
}): ProjectedCashWeek[] {
  let previous = input.openingBalanceCents;
  return input.weeks.map((week) => {
    const net = weekNetCents(week);
    if (!net.ok || previous == null) {
      previous = null;
      return { net, ending: { ok: false as const, missing: 'data' as const }, belowMinimum: null };
    }
    const ending = previous + net.cents;
    previous = ending;
    return {
      net,
      ending: { ok: true as const, cents: ending },
      belowMinimum: input.minimumCashCents == null ? null : ending < input.minimumCashCents,
    };
  });
}
