import { CDN_PUBLIC_HTML, CDN_PUBLIC_HTML_LONG } from '@/lib/cdn-headers';

/** 完全匿名：不需讀任何 session cookie */
const ANONYMOUS_PUBLIC_PREFIXES = [
  '/store-redeem',
  '/store',
  '/liff',
  '/manifest.webmanifest',
  '/sw.js',
  '/icons/',
] as const;

export function isAnonymousPublicPath(pathname: string): boolean {
  return ANONYMOUS_PUBLIC_PREFIXES.some((p) => {
    if (p.endsWith('/')) return pathname.startsWith(p);
    return pathname === p || pathname.startsWith(`${p}/`);
  });
}

export function isHqLoginPath(pathname: string): boolean {
  return pathname === '/login' || pathname.startsWith('/login/');
}

export function isPosLoginPath(pathname: string): boolean {
  return pathname === '/pos/login' || pathname.startsWith('/pos/login/');
}

/** 靜態資產／manifest 用較長 CDN TTL */
export function publicHtmlCacheControl(pathname: string): string {
  if (
    pathname === '/manifest.webmanifest' ||
    pathname === '/sw.js' ||
    pathname.startsWith('/icons/') ||
    isHqLoginPath(pathname)
  ) {
    return CDN_PUBLIC_HTML_LONG;
  }
  return CDN_PUBLIC_HTML;
}

/**
 * 登入殼：沒有 cookie 時可直接 CDN HIT；
 * 有 cookie 才需要驗證／導向（不可被公開快取）。
 */
export function shouldBypassAuthForPublicShell(input: {
  pathname: string;
  hasHqCookie: boolean;
  hasMerchantCookie: boolean;
}): 'public-cdn' | 'check-auth' {
  if (isAnonymousPublicPath(input.pathname)) return 'public-cdn';
  if (isHqLoginPath(input.pathname) && !input.hasHqCookie) return 'public-cdn';
  if (isPosLoginPath(input.pathname) && !input.hasMerchantCookie) return 'public-cdn';
  return 'check-auth';
}
