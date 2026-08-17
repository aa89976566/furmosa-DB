/**
 * LIFF refill identity-token recovery helpers.
 * Maps expired/invalid LINE idToken verify failures to a machine-readable
 * API code; client may logout+login at most once (loop guard survives redirect).
 * Never logs or stores tokens; preserves path + existing _vercel_share only.
 */

import { RefillError } from '@/lib/refill/errors';

export const LINE_ID_TOKEN_INVALID_CODE = 'LINE_ID_TOKEN_INVALID' as const;

/** sessionStorage key: set before logout/login redirect; cleared after success or second hit */
export const LIFF_REFILL_REAUTH_GUARD_KEY = 'furmosa_liff_refill_reauth_once';

/**
 * LINE verify error_description / message patterns that indicate the browser
 * identity token itself is unusable (re-login can help). Config mismatches
 * like wrong audience are excluded — re-login cannot fix those.
 */
export function isRecoverableLineIdTokenFailureMessage(message: string): boolean {
  const m = message.trim().toLowerCase();
  if (!m) return false;
  if (m.includes('audience')) return false;
  if (m.includes('client_id')) return false;
  if (m.includes('缺少環境變數')) return false;
  return (
    m.includes('idtoken expired') ||
    m.includes('id token expired') ||
    (m.includes('expired') && m.includes('id') && m.includes('token')) ||
    m === 'invalid idtoken' ||
    m.includes('invalid id token') ||
    m.includes('invalid_token')
  );
}

/** Convert a verify/auth failure into RefillError, or null if not recoverable auth. */
export function mapToLineIdTokenInvalidError(e: unknown): RefillError | null {
  if (e instanceof RefillError) {
    if (e.code === LINE_ID_TOKEN_INVALID_CODE || e.code === 'NOT_LOGGED_IN') return e;
    return null;
  }
  if (!(e instanceof Error)) return null;
  if (!isRecoverableLineIdTokenFailureMessage(e.message)) return null;
  return new RefillError('請重新登入 LINE', LINE_ID_TOKEN_INVALID_CODE, 401);
}

/**
 * Build LIFF login redirectUri from the current page href:
 * same origin + path + query; keep non-empty _vercel_share; drop reauth noise.
 */
export function buildLiffRefillRedirectUri(pageHref: string): string {
  const url = new URL(pageHref);
  // Ensure we never invent a share token — only keep if already present & non-empty
  const share = url.searchParams.get('_vercel_share')?.trim();
  if (!share) {
    url.searchParams.delete('_vercel_share');
  } else {
    url.searchParams.set('_vercel_share', share);
  }
  return `${url.origin}${url.pathname}${url.search}`;
}

export function shouldAttemptLiffReauth(
  code: string | undefined,
  alreadyAttempted: boolean,
): boolean {
  if (alreadyAttempted) return false;
  return code === LINE_ID_TOKEN_INVALID_CODE;
}

export function readLiffReauthGuard(storage: Pick<Storage, 'getItem'> | null): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(LIFF_REFILL_REAUTH_GUARD_KEY) === '1';
  } catch {
    return false;
  }
}

export function markLiffReauthGuard(storage: Pick<Storage, 'setItem'> | null): void {
  if (!storage) return;
  try {
    storage.setItem(LIFF_REFILL_REAUTH_GUARD_KEY, '1');
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearLiffReauthGuard(storage: Pick<Storage, 'removeItem'> | null): void {
  if (!storage) return;
  try {
    storage.removeItem(LIFF_REFILL_REAUTH_GUARD_KEY);
  } catch {
    /* ignore */
  }
}
