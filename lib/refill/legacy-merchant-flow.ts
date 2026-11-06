export const LEGACY_MERCHANT_SERIAL_FLOW_ERROR = {
  error: '此操作已停用，請重新整理 POS，改用「到店交付確認」。',
  code: 'LEGACY_REFILL_FLOW_REMOVED',
} as const;

/**
 * 店員不再掃描或輸入新舊罐序號。保留舊網址的明確回應，避免舊分頁
 * 靜默執行已淘汰流程；重新整理後會進入依品項與數量交付的新工作區。
 */
export function legacyMerchantSerialFlowResult() {
  return {
    status: 410,
    body: LEGACY_MERCHANT_SERIAL_FLOW_ERROR,
  } as const;
}
