/**
 * Shared JWT signing secret for HQ + Merchant sessions.
 * Production MUST set AUTH_SECRET — no hardcoded fallback there (SECURITY C1).
 *
 * 使用動態 key 讀取（process.env[name]），避免 Next 在 build 時把
 * process.env.AUTH_SECRET 內嵌成 undefined（與 lib/line/config 同策略）。
 */

const DEV_FALLBACK =
  'dev-secret-only-please-change-me-in-production-32chars-min';

function readEnv(
  name: string,
  env?: Record<string, string | undefined>,
): string | undefined {
  const source = env ?? process.env;
  const value = source[name];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

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
  env?: { AUTH_SECRET?: string; NODE_ENV?: string },
): string {
  const raw = readEnv('AUTH_SECRET', env as Record<string, string | undefined> | undefined);
  if (raw) return raw;
  const nodeEnv = env?.NODE_ENV ?? process.env.NODE_ENV;
  if (requiresAuthSecretEnv(nodeEnv)) {
    throw new Error('缺少環境變數 AUTH_SECRET');
  }
  return DEV_FALLBACK;
}

export function getAuthSecretKey(
  env?: { AUTH_SECRET?: string; NODE_ENV?: string },
): Uint8Array {
  return new TextEncoder().encode(resolveAuthSecret(env));
}

/** 診斷用：不回傳 secret 本身 */
export function isAuthSecretConfigured(
  env?: { AUTH_SECRET?: string },
): boolean {
  return Boolean(readEnv('AUTH_SECRET', env as Record<string, string | undefined> | undefined));
}
