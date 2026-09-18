import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import type { NextRequest, NextResponse } from 'next/server';
import { getAuthSecretKey } from '@/lib/auth-secret';

export const HQ_PASSKEY_RP_NAME = 'Furmosa HQ';
export const HQ_PASSKEY_PRODUCTION_RP_ID = 'hq.furmosa.com';

type ChallengeKind = 'registration' | 'authentication';

const CHALLENGE_COOKIE: Record<ChallengeKind, string> = {
  registration: 'furmosa_hq_passkey_registration',
  authentication: 'furmosa_hq_passkey_authentication',
};

export type PasskeyChallenge = {
  kind: ChallengeKind;
  challenge: string;
  userId?: string;
  webauthnUserId?: string;
};

function requestHostname(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  return (forwarded || request.nextUrl.hostname).toLowerCase().replace(/:\d+$/, '');
}

export function resolveHqPasskeyContext(
  request: NextRequest,
  nodeEnv: string | undefined = process.env.NODE_ENV,
) {
  const hostname = requestHostname(request);
  if (nodeEnv === 'production') {
    if (hostname !== HQ_PASSKEY_PRODUCTION_RP_ID) {
      throw new Error('Face ID 只可在 hq.furmosa.com 使用');
    }
    return {
      rpID: HQ_PASSKEY_PRODUCTION_RP_ID,
      origin: `https://${HQ_PASSKEY_PRODUCTION_RP_ID}`,
    };
  }

  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    throw new Error('本機 Face ID 測試只允許 localhost');
  }
  return { rpID: hostname, origin: request.nextUrl.origin };
}

export async function createPasskeyChallengeToken(value: PasskeyChallenge) {
  return new SignJWT(value)
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience('furmosa-hq-passkey')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(getAuthSecretKey());
}

export async function readPasskeyChallenge(kind: ChallengeKind): Promise<PasskeyChallenge | null> {
  const store = await cookies();
  const token = store.get(CHALLENGE_COOKIE[kind])?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getAuthSecretKey(), {
      audience: 'furmosa-hq-passkey',
    });
    if (payload.kind !== kind || typeof payload.challenge !== 'string') return null;
    return {
      kind,
      challenge: payload.challenge,
      userId: typeof payload.userId === 'string' ? payload.userId : undefined,
      webauthnUserId: typeof payload.webauthnUserId === 'string' ? payload.webauthnUserId : undefined,
    };
  } catch {
    return null;
  }
}

export function setPasskeyChallengeCookie(
  response: NextResponse,
  kind: ChallengeKind,
  token: string,
) {
  response.cookies.set(CHALLENGE_COOKIE[kind], token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 5 * 60,
  });
}

export function clearPasskeyChallengeCookie(response: NextResponse, kind: ChallengeKind) {
  response.cookies.set(CHALLENGE_COOKIE[kind], '', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

export function passkeyDeviceName(userAgent: string | null) {
  const ua = userAgent ?? '';
  if (/iPhone|iPad/i.test(ua)) return 'iPhone／iPad Face ID';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'Mac Touch ID';
  if (/Android/i.test(ua)) return 'Android 生物辨識';
  if (/Windows/i.test(ua)) return 'Windows Hello';
  return 'Passkey 裝置';
}
