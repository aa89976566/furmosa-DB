import { createHash, createHmac, scrypt, timingSafeEqual } from 'node:crypto';
import {
  GROOMING_PREVIEW_PATH,
  isGroomingPreviewSurfaceOpen,
  parseGroomingPreviewCookieSecret,
  readPreviewSurfaceEnv,
  type PreviewSurfaceEnv,
} from './preview-surface-gate';

function scryptDerived(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      32,
      { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey as Buffer);
      },
    );
  });
}

export { GROOMING_PREVIEW_PATH };

export const GROOMING_PREVIEW_COOKIE_NAME = 'grooming_preview_session';
export const GROOMING_PREVIEW_COOKIE_MAX_AGE_SEC = 2 * 60 * 60;
export const GROOMING_PREVIEW_AUD = 'grooming-voucher-preview';
export const GROOMING_PREVIEW_GENERIC_ERROR = '登入失敗';
export const SCRYPT_ENCODED_PREFIX = 'n=16384,r=8,p=1$';

export type PreviewAuthEnv = PreviewSurfaceEnv & {
  VERCEL_GIT_COMMIT_SHA?: string;
  GROOMING_PREVIEW_USERNAME?: string;
  GROOMING_PREVIEW_PASSWORD_SCRYPT?: string;
};

export type PreviewCookieOptions = {
  httpOnly: true;
  secure: true;
  sameSite: 'lax';
  path: typeof GROOMING_PREVIEW_PATH;
  maxAge: number;
};

export const GROOMING_PREVIEW_COOKIE_OPTIONS: PreviewCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: GROOMING_PREVIEW_PATH,
  maxAge: GROOMING_PREVIEW_COOKIE_MAX_AGE_SEC,
};

export const GROOMING_PREVIEW_CLEAR_COOKIE_OPTIONS: PreviewCookieOptions = {
  ...GROOMING_PREVIEW_COOKIE_OPTIONS,
  maxAge: 0,
};

export type PageAccess = 'not_found' | 'login' | 'app';

export type LoginDecision =
  | { type: 'not_found' }
  | { type: 'reject' }
  | {
      type: 'ok';
      cookie: { name: string; value: string; options: PreviewCookieOptions };
      redirectTo: typeof GROOMING_PREVIEW_PATH;
    };

export type LogoutDecision =
  | { type: 'reject' }
  | {
      type: 'ok';
      cookie: { name: string; value: string; options: PreviewCookieOptions };
      redirectTo: typeof GROOMING_PREVIEW_PATH;
    };

const HOST_RE = /^[a-zA-Z0-9.-]+(?::\d+)?$/;

export function readPreviewAuthEnv(
  source: Record<string, string | undefined>,
): PreviewAuthEnv {
  return {
    ...readPreviewSurfaceEnv(source),
    VERCEL_GIT_COMMIT_SHA: source.VERCEL_GIT_COMMIT_SHA,
    GROOMING_PREVIEW_USERNAME: source.GROOMING_PREVIEW_USERNAME,
    GROOMING_PREVIEW_PASSWORD_SCRYPT: source.GROOMING_PREVIEW_PASSWORD_SCRYPT,
  };
}

export function parsePasswordScrypt(
  encoded: string,
): { salt: Buffer; hash: Buffer } | null {
  if (!encoded.startsWith(SCRYPT_ENCODED_PREFIX)) return null;
  const rest = encoded.slice(SCRYPT_ENCODED_PREFIX.length);
  const sep = rest.indexOf('$');
  if (sep <= 0) return null;
  const saltB64 = rest.slice(0, sep);
  const hashB64 = rest.slice(sep + 1);
  if (!saltB64 || !hashB64 || hashB64.includes('$')) return null;
  try {
    const salt = Buffer.from(saltB64, 'base64url');
    const hash = Buffer.from(hashB64, 'base64url');
    if (salt.length < 16 || hash.length !== 32) return null;
    return { salt, hash };
  } catch {
    return null;
  }
}

export function isPreviewRouteAvailable(env: PreviewAuthEnv): boolean {
  if (!isGroomingPreviewSurfaceOpen(env)) return false;
  const username = env.GROOMING_PREVIEW_USERNAME?.trim() ?? '';
  const sha = env.VERCEL_GIT_COMMIT_SHA?.trim() ?? '';
  const parsed = env.GROOMING_PREVIEW_PASSWORD_SCRYPT
    ? parsePasswordScrypt(env.GROOMING_PREVIEW_PASSWORD_SCRYPT)
    : null;
  return username.length > 0 && sha.length > 0 && parsed !== null;
}

export function resolvePostRedirect(_requested?: string | null): typeof GROOMING_PREVIEW_PATH {
  return GROOMING_PREVIEW_PATH;
}

export function resolveExpectedOrigin(
  headerGet: (name: string) => string | null,
): string | null {
  const rawHost = headerGet('x-forwarded-host') ?? headerGet('host');
  if (!rawHost) return null;
  const host = rawHost.split(',')[0]?.trim() ?? '';
  if (!HOST_RE.test(host)) return null;
  const rawProto = headerGet('x-forwarded-proto') ?? 'https';
  const proto = rawProto.split(',')[0]?.trim() ?? '';
  if (proto !== 'https' && proto !== 'http') return null;
  return `${proto}://${host}`;
}

export function isSameOriginPost(headerGet: (name: string) => string | null): boolean {
  const expected = resolveExpectedOrigin(headerGet);
  if (!expected) return false;
  const origin = headerGet('origin');
  if (origin) return origin === expected;
  const referer = headerGet('referer');
  if (!referer) return false;
  try {
    return new URL(referer).origin === expected;
  } catch {
    return false;
  }
}

function sha256(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

function safeEqualBuffers(left: Buffer, right: Buffer): boolean {
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function verifyCredentials(
  username: string,
  password: string,
  env: PreviewAuthEnv,
): Promise<boolean> {
  const expectedUser = env.GROOMING_PREVIEW_USERNAME ?? '';
  const parsed = env.GROOMING_PREVIEW_PASSWORD_SCRYPT
    ? parsePasswordScrypt(env.GROOMING_PREVIEW_PASSWORD_SCRYPT)
    : null;
  if (!expectedUser || !parsed) return false;

  const userOk = safeEqualBuffers(sha256(username), sha256(expectedUser));
  let derived: Buffer;
  try {
    derived = await scryptDerived(password, parsed.salt);
  } catch {
    return false;
  }
  const passOk = safeEqualBuffers(derived, parsed.hash);
  return userOk && passOk;
}

function hmacSecretBytes(env: PreviewAuthEnv): Buffer | null {
  const parsed = parseGroomingPreviewCookieSecret(env.GROOMING_PREVIEW_COOKIE_SECRET);
  if (!parsed) return null;
  return Buffer.from(parsed);
}

export function createSessionCookieValue(
  env: PreviewAuthEnv,
  nowMs: number,
): string | null {
  const secretBytes = hmacSecretBytes(env);
  const sha = env.VERCEL_GIT_COMMIT_SHA?.trim() ?? '';
  if (!secretBytes || !sha) return null;
  const exp = Math.floor(nowMs / 1000) + GROOMING_PREVIEW_COOKIE_MAX_AGE_SEC;
  const payload = JSON.stringify({
    aud: GROOMING_PREVIEW_AUD,
    exp,
    sha,
  });
  const body = Buffer.from(payload, 'utf8').toString('base64url');
  const sig = createHmac('sha256', secretBytes).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifySessionCookieValue(
  value: string | undefined,
  env: PreviewAuthEnv,
  nowMs: number,
): boolean {
  if (!value) return false;
  const secretBytes = hmacSecretBytes(env);
  const expectedSha = env.VERCEL_GIT_COMMIT_SHA?.trim() ?? '';
  if (!secretBytes || !expectedSha) return false;

  const dot = value.lastIndexOf('.');
  if (dot <= 0 || dot === value.length - 1) return false;
  const body = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expectedSig = createHmac('sha256', secretBytes).update(body).digest('base64url');
  if (!safeEqualBuffers(Buffer.from(sig), Buffer.from(expectedSig))) return false;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return false;
  }
  if (!parsed || typeof parsed !== 'object') return false;
  const record = parsed as { aud?: unknown; exp?: unknown; sha?: unknown };
  if (record.aud !== GROOMING_PREVIEW_AUD) return false;
  if (typeof record.exp !== 'number' || !Number.isFinite(record.exp)) return false;
  if (record.exp <= Math.floor(nowMs / 1000)) return false;
  if (typeof record.sha !== 'string' || record.sha !== expectedSha) return false;
  return true;
}

export function evaluatePageAccess(input: {
  env: PreviewAuthEnv;
  cookieValue: string | undefined;
  nowMs: number;
}): PageAccess {
  if (!isPreviewRouteAvailable(input.env)) return 'not_found';
  if (!verifySessionCookieValue(input.cookieValue, input.env, input.nowMs)) return 'login';
  return 'app';
}

export async function evaluateLoginAttempt(input: {
  env: PreviewAuthEnv;
  username: string;
  password: string;
  headerGet: (name: string) => string | null;
  nowMs: number;
}): Promise<LoginDecision> {
  if (!isPreviewRouteAvailable(input.env)) return { type: 'not_found' };
  if (!isSameOriginPost(input.headerGet)) return { type: 'reject' };
  const ok = await verifyCredentials(input.username, input.password, input.env);
  if (!ok) return { type: 'reject' };
  const value = createSessionCookieValue(input.env, input.nowMs);
  if (!value) return { type: 'reject' };
  return {
    type: 'ok',
    cookie: {
      name: GROOMING_PREVIEW_COOKIE_NAME,
      value,
      options: GROOMING_PREVIEW_COOKIE_OPTIONS,
    },
    redirectTo: resolvePostRedirect(),
  };
}

export function evaluateLogout(input: {
  headerGet: (name: string) => string | null;
}): LogoutDecision {
  if (!isSameOriginPost(input.headerGet)) return { type: 'reject' };
  return {
    type: 'ok',
    cookie: {
      name: GROOMING_PREVIEW_COOKIE_NAME,
      value: '',
      options: GROOMING_PREVIEW_CLEAR_COOKIE_OPTIONS,
    },
    redirectTo: resolvePostRedirect(),
  };
}
