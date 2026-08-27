import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getAuthSecretKey } from '@/lib/auth-secret';
import { loginFailureMessage } from '@/lib/auth-errors';

export const MERCHANT_SESSION_COOKIE = 'furmosa_merchant_session';
export const MERCHANT_SESSION_TYPE = 'merchant' as const;

/** 店家平板預設保持登入 30 天；總部 HQ 仍用 SESSION_HOURS。 */
const DEFAULT_POS_SESSION_HOURS = 720;

export function merchantSessionHours() {
  const pos = Number(process.env.POS_SESSION_HOURS);
  if (Number.isFinite(pos) && pos > 0) return pos;
  return DEFAULT_POS_SESSION_HOURS;
}

function secretKey() {
  return getAuthSecretKey();
}

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
  return merchantSessionHours() * 60 * 60;
}

export function buildMerchantSessionClaims(input: {
  merchantUserId: string;
  merchantId: string;
  username: string;
  now?: Date;
  hours?: number;
}): MerchantSessionPayload {
  const now = input.now ?? new Date();
  const hours = input.hours ?? merchantSessionHours();
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
    .sign(secretKey());

  return { token, payload };
}

export async function readMerchantSession(
  token?: string,
  options?: { now?: Date },
): Promise<MerchantSessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
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
  const maxAge = merchantSessionMaxAgeSeconds();
  cookies().set(MERCHANT_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
    expires: new Date(Date.now() + maxAge * 1000),
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
  try {
    const result = await authenticateMerchantCredentials(username, password);
    if (!result.ok) return result;

    const { token, payload } = await signMerchantSession({
      merchantUserId: result.user.id,
      merchantId: result.user.merchantId,
      username: result.user.username,
    });
    await setMerchantSessionCookie(token);
    try {
      await prisma.merchantUser.update({
        where: { id: result.user.id },
        data: { lastLoginAt: new Date() },
      });
    } catch (err) {
      // 登入成功不因 lastLoginAt 寫入失敗而整頁崩潰
      console.error('[merchant-auth] lastLoginAt', err);
    }
    return { ok: true as const, session: payload };
  } catch (err) {
    return { ok: false as const, error: loginFailureMessage(err) };
  }
}

export { hashPassword, verifyPassword };
