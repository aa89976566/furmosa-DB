import assert from "node:assert/strict";
import test from "node:test";
import {
  assertShipmentStatusPersisted,
  shipmentStatusErrorMessage,
} from "../shipment-status-error";

test("將未盤點錯誤轉成可操作提示", () => {
  const error = new Error(
    "transaction failed: HQ 商品 FUR-0002 尚未完成實際單位盤點",
  );
  assert.equal(
    shipmentStatusErrorMessage(error),
    "無法寄出：商品 FUR-0002 尚未完成 HQ 主倉盤點，請先到庫存完成盤點。",
  );
});

test("將庫存不足錯誤轉成可操作提示", () => {
  const error = new Error("HQ 商品 FUR-0005 庫存不足，需要 4，現有 0");
  assert.equal(
    shipmentStatusErrorMessage(error),
    "無法寄出：商品 FUR-0005 庫存不足。請先補貨或修正 HQ 主倉庫存。",
  );
});

test("未知錯誤保留原始訊息", () => {
  assert.equal(
    shipmentStatusErrorMessage(new Error("門市資料待確認")),
    "門市資料待確認",
  );
});

test("狀態未持久化時阻止前端顯示成功", () => {
  assert.doesNotThrow(() =>
    assertShipmentStatusPersisted("shipped", "shipped"),
  );
  assert.throws(
    () => assertShipmentStatusPersisted("packed", "shipped"),
    /出貨狀態未成功更新/,
  );
});
