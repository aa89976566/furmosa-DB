// Edge-compatible merchant session verify (middleware only)
import { jwtVerify } from 'jose';

export const MERCHANT_SESSION_COOKIE_NAME = 'furmosa_merchant_session';
const MERCHANT_SESSION_TYPE = 'merchant';

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? 'dev-secret-only-please-change-me-in-production-32chars-min',
);

export type MerchantEdgeSession = {
  merchantUserId: string;
  merchantId: string;
  username: string;
  type: 'merchant';
  issuedAt: number;
  expiresAt: number;
};

export async function verifyMerchantSessionEdge(
  token?: string,
  now: Date = new Date(),
): Promise<MerchantEdgeSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (payload.type !== MERCHANT_SESSION_TYPE) return null;
    if (!payload.merchantUserId || !payload.merchantId || !payload.username) return null;

    const issuedAt = Number(payload.issuedAt ?? payload.iat ?? 0);
    const expiresAt = Number(payload.expiresAt ?? payload.exp ?? 0);
    const nowSec = Math.floor(now.getTime() / 1000);
    if (!expiresAt || nowSec >= expiresAt) return null;

    return {
      merchantUserId: String(payload.merchantUserId),
      merchantId: String(payload.merchantId),
      username: String(payload.username),
      type: 'merchant',
      issuedAt,
      expiresAt,
    };
  } catch {
    return null;
  }
}

export type PosGuardDecision =
  | { action: 'next' }
  | { action: 'redirect'; pathname: string; next?: string };

/**
 * Pure routing guard for /pos/* — HQ cookie never grants POS access.
 */
export function decidePosAccess(input: {
  pathname: string;
  hasMerchantSession: boolean;
}): PosGuardDecision {
  const { pathname, hasMerchantSession } = input;
  const isLogin = pathname === '/pos/login' || pathname.startsWith('/pos/login/');

  if (isLogin) {
    if (hasMerchantSession) {
      return { action: 'redirect', pathname: '/pos' };
    }
    return { action: 'next' };
  }

  if (!hasMerchantSession) {
    return { action: 'redirect', pathname: '/pos/login', next: pathname };
  }

  return { action: 'next' };
}

/**
 * Pure routing guard for HQ routes — merchant cookie never grants HQ access.
 */
export function decideHqAccess(input: {
  pathname: string;
  hasHqSession: boolean;
  isPublic: boolean;
}): PosGuardDecision {
  const { pathname, hasHqSession, isPublic } = input;

  if (!hasHqSession && !isPublic) {
    return { action: 'redirect', pathname: '/login', next: pathname };
  }

  if (hasHqSession && (pathname === '/login' || pathname.startsWith('/login/'))) {
    return { action: 'redirect', pathname: '/dashboard' };
  }

  return { action: 'next' };
}
