import { prisma } from '@/lib/prisma';
import { formatCustomerId, maxCustomerIdSeq, CUSTOMER_ID_EXAMPLE } from '@/lib/customers/customer-id-format';

export async function nextCustomerId(): Promise<string> {
  const rows = await prisma.customer.findMany({ select: { customerId: true } });
  const next = maxCustomerIdSeq(rows.map((r) => r.customerId)) + 1;
  return formatCustomerId(next);
}
export { formatCustomerId, maxCustomerIdSeq, CUSTOMER_ID_EXAMPLE };
