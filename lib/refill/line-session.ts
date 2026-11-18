import { createHash, timingSafeEqual } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { getAuthSecretKey } from '@/lib/auth-secret';

export const REFILL_LINE_SESSION_COOKIE = 'furmosa_refill_line_v1';
export const REFILL_LINE_SESSION_TTL_SECONDS = 10 * 60;

const ISSUER = 'furmosa-hq';
const AUDIENCE = 'line-refill';

function tokenFingerprint(idToken: string) {
  return createHash('sha256').update(idToken).digest('base64url');
}

function sameFingerprint(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function createRefillLineSession(
  idToken: string,
  lineUserId: string,
  now = new Date(),
) {
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT({ tokenFingerprint: tokenFingerprint(idToken) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(lineUserId)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + REFILL_LINE_SESSION_TTL_SECONDS)
    .sign(getAuthSecretKey());
}

export async function readRefillLineSession(
  sessionToken: string | undefined,
  idToken: string,
  now = new Date(),
): Promise<string | null> {
  if (!sessionToken || !idToken.trim()) return null;

  try {
    const { payload } = await jwtVerify(sessionToken, getAuthSecretKey(), {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
      currentDate: now,
    });
    if (typeof payload.sub !== 'string' || !payload.sub) return null;
    if (typeof payload.tokenFingerprint !== 'string') return null;
    if (!sameFingerprint(payload.tokenFingerprint, tokenFingerprint(idToken))) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

export function refillLineSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/api/refill',
    maxAge: REFILL_LINE_SESSION_TTL_SECONDS,
  };
}
