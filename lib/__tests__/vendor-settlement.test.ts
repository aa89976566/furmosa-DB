import assert from "node:assert/strict";
import test from "node:test";

import { calculateVendorSettlement } from "../vendor-settlement";

test("QIQI：匠寵取得實收的 25%，供應商取得 75%", () => {
  assert.deepEqual(calculateVendorSettlement({ grossCollectedTwd: 1_000, furmosaShareBps: 2_500 }), {
    grossCollectedTwd: 1_000,
    refundTwd: 0,
    netCollectedTwd: 1_000,
    furmosaShareBps: 2_500,
    furmosaShareTwd: 250,
    vendorPayableTwd: 750,
  });
});

test("退款按淨實收金額同比例回沖", () => {
  assert.deepEqual(
    calculateVendorSettlement({ grossCollectedTwd: 1_000, refundTwd: 200, furmosaShareBps: 2_500 }),
    {
      grossCollectedTwd: 1_000,
      refundTwd: 200,
      netCollectedTwd: 800,
      furmosaShareBps: 2_500,
      furmosaShareTwd: 200,
      vendorPayableTwd: 600,
    },
  );
});

test("無法整除時，匠寵分潤四捨五入且雙方合計等於淨實收", () => {
  const result = calculateVendorSettlement({ grossCollectedTwd: 179, furmosaShareBps: 2_500 });
  assert.equal(result.furmosaShareTwd, 45);
  assert.equal(result.vendorPayableTwd, 134);
  assert.equal(result.furmosaShareTwd + result.vendorPayableTwd, result.netCollectedTwd);
});

test("拒絕退款超過實收與無效分潤比例", () => {
  assert.throws(
    () => calculateVendorSettlement({ grossCollectedTwd: 100, refundTwd: 101, furmosaShareBps: 2_500 }),
    /退款金額不可超過實收金額/,
  );
  assert.throws(
    () => calculateVendorSettlement({ grossCollectedTwd: 100, furmosaShareBps: 10_001 }),
    /匠寵分潤基點必須介於/,
  );
});
