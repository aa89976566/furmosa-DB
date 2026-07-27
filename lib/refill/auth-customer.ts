import { authenticateLineIdToken } from '@/lib/line/liff-customer';
import { findCustomerByLineUserId } from '@/lib/line/bind-customer';
import { RefillError } from '@/lib/refill/errors';

export async function requireRefillCustomer(idToken: string) {
  if (!idToken?.trim()) {
    throw new RefillError('請先登入 LINE', 'NOT_LOGGED_IN', 401);
  }
  const { lineUserId } = await authenticateLineIdToken(idToken);
  const customer = await findCustomerByLineUserId(lineUserId);
  if (!customer) {
    throw new RefillError('請先完成會員註冊', 'NOT_REGISTERED', 404);
  }
  return {
    customerId: customer.id,
    customerCode: customer.customerId,
    lineUserId,
    name: customer.name,
  };
}
