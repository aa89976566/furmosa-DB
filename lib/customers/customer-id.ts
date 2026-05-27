import { prisma } from '@/lib/prisma';

/** 新客戶編號前綴（例：furmosa-0001） */
export const CUSTOMER_ID_PREFIX = 'furmosa-';

/** 舊版前綴，序號計算時一併納入，避免撞號 */
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

export async function nextCustomerId(): Promise<string> {
  const rows = await prisma.customer.findMany({ select: { customerId: true } });
  const next = maxCustomerIdSeq(rows.map((r) => r.customerId)) + 1;
  return formatCustomerId(next);
}

/** 說明／範例用（furmosa-0001） */
export const CUSTOMER_ID_EXAMPLE = formatCustomerId(1);
