/** Edge-safe Preview login surface gate. Path and env string checks only. */

export const GROOMING_PREVIEW_PATH = '/preview/grooming-voucher';
export const GROOMING_PREVIEW_COOKIE_SECRET_BYTES = 32;

const CANONICAL_BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

function bytesToCanonicalBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeCanonicalBase64Url(value: string): Uint8Array | null {
  const padLen = (4 - (value.length % 4)) % 4;
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(padLen);
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    return null;
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Shared Edge-safe rule: canonical base64url that decodes to exactly 32 bytes. */
export function parseGroomingPreviewCookieSecret(
  value: string | undefined,
): Uint8Array | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  if (!CANONICAL_BASE64URL_RE.test(value)) return null;
  const bytes = decodeCanonicalBase64Url(value);
  if (!bytes || bytes.length !== GROOMING_PREVIEW_COOKIE_SECRET_BYTES) return null;
  if (bytesToCanonicalBase64Url(bytes) !== value) return null;
  return bytes;
}

export type PreviewSurfaceEnv = {
  VERCEL_ENV?: string;
  GROOMING_PREVIEW_AUTH_ENABLED?: string;
  GROOMING_PREVIEW_BRANCH?: string;
  VERCEL_GIT_COMMIT_REF?: string;
  GROOMING_PREVIEW_COOKIE_SECRET?: string;
};

export type PreviewSurfaceDecision = 'bypass_hq' | 'continue';

export function readPreviewSurfaceEnv(
  source: Record<string, string | undefined>,
): PreviewSurfaceEnv {
  return {
    VERCEL_ENV: source.VERCEL_ENV,
    GROOMING_PREVIEW_AUTH_ENABLED: source.GROOMING_PREVIEW_AUTH_ENABLED,
    GROOMING_PREVIEW_BRANCH: source.GROOMING_PREVIEW_BRANCH,
    VERCEL_GIT_COMMIT_REF: source.VERCEL_GIT_COMMIT_REF,
    GROOMING_PREVIEW_COOKIE_SECRET: source.GROOMING_PREVIEW_COOKIE_SECRET,
  };
}

export function isExactGroomingPreviewPath(pathname: string): boolean {
  return pathname === GROOMING_PREVIEW_PATH;
}

export function isGroomingPreviewSurfaceOpen(env: PreviewSurfaceEnv): boolean {
  const branch = env.GROOMING_PREVIEW_BRANCH?.trim() ?? '';
  const ref = env.VERCEL_GIT_COMMIT_REF?.trim() ?? '';
  return (
    env.VERCEL_ENV === 'preview' &&
    env.GROOMING_PREVIEW_AUTH_ENABLED === 'true' &&
    branch.length > 0 &&
    ref.length > 0 &&
    ref === branch &&
    parseGroomingPreviewCookieSecret(env.GROOMING_PREVIEW_COOKIE_SECRET) !== null
  );
}

export function decideGroomingPreviewSurfaceAccess(input: {
  pathname: string;
  env: PreviewSurfaceEnv;
}): PreviewSurfaceDecision {
  if (!isExactGroomingPreviewPath(input.pathname)) return 'continue';
  if (!isGroomingPreviewSurfaceOpen(input.env)) return 'continue';
  return 'bypass_hq';
}

export function shouldBypassHqForGroomingPreviewSurface(input: {
  pathname: string;
  env: PreviewSurfaceEnv | NodeJS.ProcessEnv | Record<string, string | undefined>;
}): boolean {
  return (
    decideGroomingPreviewSurfaceAccess({
      pathname: input.pathname,
      env: readPreviewSurfaceEnv(input.env),
    }) === 'bypass_hq'
  );
}
