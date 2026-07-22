import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const MERCHANT_SESSION_COOKIE = 'furmosa_merchant_session';
export const MERCHANT_SESSION_TYPE = 'merchant' as const;

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? 'dev-secret-only-please-change-me-in-production-32chars-min',
);

const SESSION_HOURS = Number(process.env.SESSION_HOURS ?? '168');

export type MerchantSessionPayload = {
  merchantUserId: string;
  merchantId: string;
  username: string;
  type: typeof MERCHANT_SESSION_TYPE;
  issuedAt: number;
  expiresAt: number;
};

export type MerchantCredentialsLookup = {
  id: string;
  merchantId: string;
  username: string;
  passwordHash: string;
  isActive: boolean;
};

export function merchantSessionMaxAgeSeconds() {
  return SESSION_HOURS * 60 * 60;
}

export function buildMerchantSessionClaims(input: {
  merchantUserId: string;
  merchantId: string;
  username: string;
  now?: Date;
  hours?: number;
}): MerchantSessionPayload {
  const now = input.now ?? new Date();
  const hours = input.hours ?? SESSION_HOURS;
  const issuedAt = Math.floor(now.getTime() / 1000);
  const expiresAt = issuedAt + hours * 60 * 60;
  return {
    merchantUserId: input.merchantUserId,
    merchantId: input.merchantId,
    username: input.username,
    type: MERCHANT_SESSION_TYPE,
    issuedAt,
    expiresAt,
  };
}

export async function signMerchantSession(
  claims: Omit<MerchantSessionPayload, 'type' | 'issuedAt' | 'expiresAt'> &
    Partial<Pick<MerchantSessionPayload, 'issuedAt' | 'expiresAt'>>,
  options?: { now?: Date; hours?: number },
) {
  const payload = buildMerchantSessionClaims({
    merchantUserId: claims.merchantUserId,
    merchantId: claims.merchantId,
    username: claims.username,
    now: options?.now,
    hours: options?.hours,
  });

  const token = await new SignJWT({
    merchantUserId: payload.merchantUserId,
    merchantId: payload.merchantId,
    username: payload.username,
    type: payload.type,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(payload.issuedAt)
    .setExpirationTime(payload.expiresAt)
    .sign(SECRET);

  return { token, payload };
}

export async function readMerchantSession(
  token?: string,
  options?: { now?: Date },
): Promise<MerchantSessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (payload.type !== MERCHANT_SESSION_TYPE) return null;
    if (!payload.merchantUserId || !payload.merchantId || !payload.username) return null;

    const issuedAt = Number(payload.issuedAt ?? payload.iat ?? 0);
    const expiresAt = Number(payload.expiresAt ?? payload.exp ?? 0);
    const nowSec = Math.floor((options?.now ?? new Date()).getTime() / 1000);
    if (!expiresAt || nowSec >= expiresAt) return null;

    return {
      merchantUserId: String(payload.merchantUserId),
      merchantId: String(payload.merchantId),
      username: String(payload.username),
      type: MERCHANT_SESSION_TYPE,
      issuedAt,
      expiresAt,
    };
  } catch {
    return null;
  }
}

export async function setMerchantSessionCookie(token: string) {
  cookies().set(MERCHANT_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: merchantSessionMaxAgeSeconds(),
  });
}

export async function clearMerchantSessionCookie() {
  cookies().set(MERCHANT_SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

export async function getMerchantSessionFromCookies(): Promise<MerchantSessionPayload | null> {
  const token = cookies().get(MERCHANT_SESSION_COOKIE)?.value;
  return readMerchantSession(token);
}

/**
 * Authenticate username/password without touching cookies (testable).
 * Never trusts a client-supplied merchantId.
 */
export async function authenticateMerchantCredentials(
  username: string,
  password: string,
  deps?: {
    findByUsername?: (username: string) => Promise<MerchantCredentialsLookup | null>;
    verify?: (plain: string, hash: string) => Promise<boolean>;
  },
): Promise<
  | { ok: true; user: MerchantCredentialsLookup }
  | { ok: false; error: string }
> {
  const find =
    deps?.findByUsername ??
    (async (u: string) =>
      prisma.merchantUser.findUnique({
        where: { username: u },
        select: {
          id: true,
          merchantId: true,
          username: true,
          passwordHash: true,
          isActive: true,
        },
      }));
  const verify = deps?.verify ?? verifyPassword;

  const user = await find(username.trim());
  if (!user) return { ok: false, error: '帳號或密碼不正確' };
  if (!user.isActive) return { ok: false, error: '此帳號已停用，請聯繫 Furmosa 總部' };
  const valid = await verify(password, user.passwordHash);
  if (!valid) return { ok: false, error: '帳號或密碼不正確' };
  return { ok: true, user };
}

export async function loginMerchantWithPassword(username: string, password: string) {
  const result = await authenticateMerchantCredentials(username, password);
  if (!result.ok) return result;

  const { token, payload } = await signMerchantSession({
    merchantUserId: result.user.id,
    merchantId: result.user.merchantId,
    username: result.user.username,
  });
  await setMerchantSessionCookie(token);
  await prisma.merchantUser.update({
    where: { id: result.user.id },
    data: { lastLoginAt: new Date() },
  });
  return { ok: true as const, session: payload };
}

export { hashPassword, verifyPassword };
