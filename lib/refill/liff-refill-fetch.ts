/**
 * LIFF refill Preview helper: when the current page URL already carries a
 * non-empty `_vercel_share` and the request targets a same-origin relative
 * `/api/refill/*` path, forward that query value and use credentials:include.
 * Never hardcodes, logs, or stores the token; never attaches it to other paths.
 */

const SHARE_PARAM = '_vercel_share';

/** Same-origin relative path under /api/refill (rejects absolute / protocol-relative). */
export function isSameOriginRefillApiPath(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  if (
    input.startsWith('http://') ||
    input.startsWith('https://') ||
    input.startsWith('//')
  ) {
    return false;
  }
  const pathOnly = input.split(/[?#]/)[0] ?? '';
  return pathOnly === '/api/refill' || pathOnly.startsWith('/api/refill/');
}

/** Read non-empty `_vercel_share` from a page href or `?…` search string. */
export function readVercelShareFromPageUrl(pageUrlOrSearch: string): string | null {
  if (!pageUrlOrSearch) return null;
  try {
    const raw = pageUrlOrSearch.trim();
    const href = raw.startsWith('?')
      ? `http://local.invalid${raw}`
      : raw.includes('://')
        ? raw
        : raw.startsWith('/')
          ? `http://local.invalid${raw}`
          : `http://local.invalid/?${raw}`;
    const v = new URL(href).searchParams.get(SHARE_PARAM)?.trim() ?? '';
    return v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

/**
 * Resolve the request URL: append `_vercel_share` only when both guards pass.
 * Returns the original input unchanged otherwise.
 */
export function resolveLiffRefillFetchUrl(
  input: string,
  pageUrlOrSearch: string,
): string {
  if (!isSameOriginRefillApiPath(input)) return input;
  const share = readVercelShareFromPageUrl(pageUrlOrSearch);
  if (!share) return input;

  const u = new URL(input, 'http://local.invalid');
  if (!u.searchParams.get(SHARE_PARAM)?.trim()) {
    u.searchParams.set(SHARE_PARAM, share);
  }
  return `${u.pathname}${u.search}`;
}

type PageUrlSource = string | (() => string);

function currentPageUrl(source?: PageUrlSource): string {
  if (typeof source === 'function') return source();
  if (typeof source === 'string') return source;
  if (typeof window !== 'undefined' && window.location?.href) {
    return window.location.href;
  }
  return '';
}

/**
 * Drop-in fetch for LIFF refill API calls.
 * Special behavior (forward `_vercel_share` + credentials:include) only when
 * both guards pass; otherwise identical to plain fetch(input, init).
 */
export function liffRefillFetch(
  input: string,
  init?: RequestInit,
  pageUrl?: PageUrlSource,
): Promise<Response> {
  const page = currentPageUrl(pageUrl);
  const share = readVercelShareFromPageUrl(page);

  if (!isSameOriginRefillApiPath(input) || !share) {
    return fetch(input, init);
  }

  const url = resolveLiffRefillFetchUrl(input, page);
  return fetch(url, {
    ...init,
    credentials: 'include',
  });
}
