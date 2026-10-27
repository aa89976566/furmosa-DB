export const VENDOR_SETTLEMENT_RULES_VERSION = "vendor-consignment-v1";

export type VendorSettlementAmounts = {
  grossCollectedTwd: number;
  refundTwd: number;
  netCollectedTwd: number;
  furmosaShareBps: number;
  furmosaShareTwd: number;
  vendorPayableTwd: number;
};

function assertInteger(name: string, value: number) {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${name} 必須是安全整數`);
  }
}

/**
 * 依實收金額計算供應商寄賣對帳。
 * 所有金額使用整數台幣；匠寵分潤採四捨五入，餘額全部歸供應商，確保加總完全相等。
 */
export function calculateVendorSettlement(input: {
  grossCollectedTwd: number;
  refundTwd?: number;
  furmosaShareBps: number;
}): VendorSettlementAmounts {
  const refundTwd = input.refundTwd ?? 0;

  assertInteger("grossCollectedTwd", input.grossCollectedTwd);
  assertInteger("refundTwd", refundTwd);
  assertInteger("furmosaShareBps", input.furmosaShareBps);

  if (input.grossCollectedTwd < 0) throw new Error("實收金額不可小於 0");
  if (refundTwd < 0) throw new Error("退款金額不可小於 0");
  if (refundTwd > input.grossCollectedTwd) throw new Error("退款金額不可超過實收金額");
  if (input.furmosaShareBps < 0 || input.furmosaShareBps > 10_000) {
    throw new Error("匠寵分潤基點必須介於 0 到 10000");
  }

  const netCollectedTwd = input.grossCollectedTwd - refundTwd;
  const furmosaShareTwd = Math.round((netCollectedTwd * input.furmosaShareBps) / 10_000);
  const vendorPayableTwd = netCollectedTwd - furmosaShareTwd;

  return {
    grossCollectedTwd: input.grossCollectedTwd,
    refundTwd,
    netCollectedTwd,
    furmosaShareBps: input.furmosaShareBps,
    furmosaShareTwd,
    vendorPayableTwd,
  };
}
