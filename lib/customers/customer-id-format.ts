/** 客戶編號格式（可安全用於 client/server） */
export const CUSTOMER_ID_PREFIX = 'furmosa-';
export const LEGACY_CUSTOMER_ID_PREFIX = 'CUST-';

const pad = (n: number, width = 4) => String(n).padStart(width, '0');

export function formatCustomerId(seq: number): string {
  return `${CUSTOMER_ID_PREFIX}${pad(seq, 4)}`;
}

/** 從既有 customerId 清單取最大序號（含 CUST- 與 furmosa-） */
export function maxCustomerIdSeq(customerIds: string[]): number {
  let max = 0;
  for (const id of customerIds) {
    const m = id.match(/^(?:CUST-|furmosa-)(\d+)$/i);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}

/** 說明／範例用（furmosa-0001） */
export const CUSTOMER_ID_EXAMPLE = formatCustomerId(1);
