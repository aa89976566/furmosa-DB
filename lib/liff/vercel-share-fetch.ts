/**
 * Preview Deployment Protection helper for LIFF pages.
 * When the current page URL already has a non-empty `_vercel_share` and the
 * request is a same-origin relative LIFF API path, forward that query value
 * and use credentials:include. Never invents, logs, or sends the token
 * cross-origin.
 */

const SHARE_PARAM = '_vercel_share';

/** Same-origin relative LIFF customer APIs (refill + LINE LIFF). */
export function isSameOriginLiffApiPath(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  if (
    input.startsWith('http://') ||
    input.startsWith('https://') ||
    input.startsWith('//')
  ) {
    return false;
  }
  const pathOnly = input.split(/[?#]/)[0] ?? '';
  return (
    pathOnly === '/api/refill' ||
    pathOnly.startsWith('/api/refill/') ||
    pathOnly === '/api/line/liff' ||
    pathOnly.startsWith('/api/line/liff/')
  );
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

export function resolveLiffPreviewFetchUrl(
  input: string,
  pageUrlOrSearch: string,
): string {
  if (!isSameOriginLiffApiPath(input)) return input;
  const share = readVercelShareFromPageUrl(pageUrlOrSearch);
  if (!share) return input;

  const u = new URL(input, 'http://local.invalid');
  if (!u.searchParams.get(SHARE_PARAM)?.trim()) {
    u.searchParams.set(SHARE_PARAM, share);
  }
  return `${u.pathname}${u.search}`;
}

/**
 * Attach an existing non-empty `_vercel_share` from pageHref onto a same-origin
 * relative navigation target. Does not invent tokens; leaves absolute URLs unchanged.
 */
export function withExistingVercelShare(
  relativeTarget: string,
  pageHref: string,
): string {
  if (
    !relativeTarget ||
    relativeTarget.startsWith('http://') ||
    relativeTarget.startsWith('https://') ||
    relativeTarget.startsWith('//')
  ) {
    return relativeTarget;
  }
  const share = readVercelShareFromPageUrl(pageHref);
  if (!share) return relativeTarget;

  const u = new URL(relativeTarget, 'http://local.invalid');
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
 * Drop-in fetch for LIFF Preview APIs under /api/refill/* and /api/line/liff/*.
 * Special behavior only when both guards pass; otherwise plain fetch.
 */
export function liffPreviewFetch(
  input: string,
  init?: RequestInit,
  pageUrl?: PageUrlSource,
): Promise<Response> {
  const page = currentPageUrl(pageUrl);
  const share = readVercelShareFromPageUrl(page);

  if (!isSameOriginLiffApiPath(input) || !share) {
    return fetch(input, init);
  }

  const url = resolveLiffPreviewFetchUrl(input, page);
  return fetch(url, {
    ...init,
    credentials: 'include',
  });
}
