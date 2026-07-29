import { getMerchantSessionFromCookies } from '@/lib/merchant-auth';
import { RefillError } from '@/lib/refill/errors';

export async function requireRefillMerchantSession() {
  const session = await getMerchantSessionFromCookies();
  if (!session) {
    throw new RefillError('請先登入店家帳號', 'UNAUTHORIZED', 401);
  }
  return session;
}
