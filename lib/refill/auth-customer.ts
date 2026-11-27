import { cookies } from 'next/headers';
import { getLiffIdIfConfigured, getLineChannelId } from '@/lib/line/liff-config';
import { verifyLineIdToken } from '@/lib/line/verify-id-token';
import { findCustomerByLineUserId } from '@/lib/line/bind-customer';
import { RefillError } from '@/lib/refill/errors';
import {
  createRefillLineSession,
  readRefillLineSession,
  REFILL_LINE_SESSION_COOKIE,
  refillLineSessionCookieOptions,
} from '@/lib/refill/line-session';

export async function requireRefillCustomer(idToken: string) {
  if (!idToken?.trim()) {
    throw new RefillError('請先登入 LINE', 'NOT_LOGGED_IN', 401);
  }
  const cookieStore = await cookies();
  let lineUserId = await readRefillLineSession(
    cookieStore.get(REFILL_LINE_SESSION_COOKIE)?.value,
    idToken,
  );
  const needsSession = !lineUserId;

  if (!lineUserId) {
    try {
      const liffId = getLiffIdIfConfigured('refill') ?? getLiffIdIfConfigured('register');
      const channelId = liffId?.match(/^(\d+)-/)?.[1] ?? getLineChannelId();
      const payload = await verifyLineIdToken(idToken, channelId);
      lineUserId = payload.sub;
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (/expired|invalid id token|idtoken/i.test(message)) {
        throw new RefillError(
          '登入已過期，請重新連線 LINE',
          'LINE_TOKEN_EXPIRED',
          401,
        );
      }
      throw error;
    }
  }
  const customer = await findCustomerByLineUserId(lineUserId);
  if (!customer) {
    throw new RefillError('請先完成會員註冊', 'NOT_REGISTERED', 404);
  }

  if (needsSession) {
    const sessionToken = await createRefillLineSession(idToken, lineUserId);
    cookieStore.set(
      REFILL_LINE_SESSION_COOKIE,
      sessionToken,
      refillLineSessionCookieOptions(),
    );
  }

  return {
    customerId: customer.id,
    customerCode: customer.customerId,
    lineUserId,
    name: customer.name,
  };
}
