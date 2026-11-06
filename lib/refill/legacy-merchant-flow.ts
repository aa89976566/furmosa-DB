export const LEGACY_MERCHANT_SERIAL_FLOW_MESSAGE =
  '這個換罐操作方式已停用。請重新整理頁面，改到 POS「換罐」：選客人、選品項與數量，有回收空罐就勾「已收到實體空罐」。這次操作沒有變更任何資料。';

export const LEGACY_MERCHANT_SERIAL_FLOW_ERROR = {
  error: LEGACY_MERCHANT_SERIAL_FLOW_MESSAGE,
  message: LEGACY_MERCHANT_SERIAL_FLOW_MESSAGE,
  code: 'LEGACY_REFILL_FLOW_REMOVED',
} as const;

export const LEGACY_MERCHANT_SERIAL_FLOW_HEADERS = {
  'Cache-Control': 'no-store',
} as const;

/**
 * 舊店員序號流程的固定回應。這個 helper 不讀環境、資料庫或時間，
 * 也不執行任何寫入；保留舊網址只為了讓未重新整理的分頁得到明確指引。
 */
export function legacyMerchantSerialFlowResult() {
  return {
    status: 410,
    body: LEGACY_MERCHANT_SERIAL_FLOW_ERROR,
    headers: LEGACY_MERCHANT_SERIAL_FLOW_HEADERS,
  } as const;
}
