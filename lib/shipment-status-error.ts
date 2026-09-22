const DEFAULT_MESSAGE = "更新出貨狀態失敗，請稍後再試";

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "";
}

/** 將資料庫庫存保護訊息轉成物流人員可直接處理的提示。 */
export function shipmentStatusErrorMessage(error: unknown): string {
  const message = errorText(error).replace(/\s+/g, " ").trim();
  if (!message) return DEFAULT_MESSAGE;

  const stocktake = message.match(
    /HQ 商品\s+([^，。\s]+)\s+尚未完成實際單位盤點/,
  );
  if (stocktake) {
    return `無法寄出：商品 ${stocktake[1]} 尚未完成 HQ 主倉盤點，請先到庫存完成盤點。`;
  }

  const shortage = message.match(/HQ 商品\s+([^，。\s]+)\s+庫存不足[^。]*/);
  if (shortage) {
    return `無法寄出：商品 ${shortage[1]} 庫存不足。請先補貨或修正 HQ 主倉庫存。`;
  }

  const variant = message.match(
    /HQ 商品\s+([^，。\s]+)\s+缺少或無法唯一確認規格/,
  );
  if (variant) {
    return `無法寄出：商品 ${variant[1]} 的規格無法確認，請先補齊商品規格。`;
  }

  if (message.includes("HQ 主倉 WH-MAIN 不存在")) {
    return "無法寄出：HQ 主倉尚未建立，請先完成主倉設定。";
  }

  if (message.includes("HQ 重量規格不一致")) {
    return "無法寄出：商品重量規格與 HQ 庫存不一致，請先修正商品規格。";
  }

  if (message.includes("已出貨不能退回")) {
    return "撤回沒有成功，這張單仍維持原狀態。庫存帳需要先套用已核准的反向帳修正，才能退回待出貨。";
  }

  return message.slice(0, 160);
}

export function assertShipmentStatusPersisted(
  actual: string | null,
  expected: string,
): void {
  if (actual !== expected) {
    throw new Error(
      "出貨狀態未成功更新，請重新整理後再試；若仍失敗，請先檢查 HQ 主倉庫存。",
    );
  }
}
