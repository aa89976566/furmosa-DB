/**
 * Shared JWT signing secret for HQ + Merchant sessions.
 * Production MUST set AUTH_SECRET — no hardcoded fallback there (SECURITY C1).
 */

const DEV_FALLBACK =
  'dev-secret-only-please-change-me-in-production-32chars-min';

/** True when runtime must refuse missing AUTH_SECRET */
export function requiresAuthSecretEnv(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  return nodeEnv === 'production';
}

/**
 * Resolve AUTH_SECRET for jose HS256.
 * - production: missing/空白 → throw
 * - development / test: allow known local fallback
 */
export function resolveAuthSecret(
  env: { AUTH_SECRET?: string; NODE_ENV?: string } = process.env,
): string {
  const raw = typeof env.AUTH_SECRET === 'string' ? env.AUTH_SECRET.trim() : '';
  if (raw.length > 0) return raw;
  if (requiresAuthSecretEnv(env.NODE_ENV)) {
    throw new Error('缺少環境變數 AUTH_SECRET');
  }
  return DEV_FALLBACK;
}

export function getAuthSecretKey(
  env: { AUTH_SECRET?: string; NODE_ENV?: string } = process.env,
): Uint8Array {
  return new TextEncoder().encode(resolveAuthSecret(env));
}
