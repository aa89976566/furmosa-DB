import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionEdge } from '@/lib/auth-edge';
import {
  MERCHANT_SESSION_COOKIE_NAME,
  decideHqAccess,
  decidePosAccess,
  verifyMerchantSessionEdge,
} from '@/lib/merchant-auth/edge';
import { CDN_PUBLIC_HTML, CDN_PUBLIC_HTML_LONG } from '@/lib/cdn-headers';

/** 純公開路徑：不讀 cookie，讓後續靜態／ISR HTML 可被 CDN 命中 */
const ANONYMOUS_PUBLIC_PREFIXES = [
  '/store-redeem',
  '/store',
  '/liff',
  '/manifest.webmanifest',
  '/sw.js',
  '/icons/',
];

const HQ_PUBLIC_PATHS = ['/login', '/store', '/store-redeem'];

function withPublicHtmlCache(
  res: NextResponse,
  control: string = CDN_PUBLIC_HTML,
): NextResponse {
  res.headers.set('Cache-Control', control);
  // Vercel CDN 優先讀取此標頭（與瀏覽器 Cache-Control 分離）
  res.headers.set('CDN-Cache-Control', control);
  res.headers.set('Vercel-CDN-Cache-Control', control);
  return res;
}

function isAnonymousPublicPath(pathname: string): boolean {
  return ANONYMOUS_PUBLIC_PREFIXES.some((p) => {
    if (p.endsWith('/')) return pathname.startsWith(p);
    return pathname === p || pathname.startsWith(`${p}/`);
  });
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/line') ||
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/api/coupons') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(svg|png|jpg|jpeg|webp|ico|css|js|webmanifest)$/)
  ) {
    return NextResponse.next();
  }

  // 匿名公開頁：完全不碰 session cookie → 邊緣可直接走 CDN HTML HIT
  if (isAnonymousPublicPath(pathname)) {
    const longLived =
      pathname === '/manifest.webmanifest' ||
      pathname === '/sw.js' ||
      pathname.startsWith('/icons/');
    return withPublicHtmlCache(
      NextResponse.next(),
      longLived ? CDN_PUBLIC_HTML_LONG : CDN_PUBLIC_HTML,
    );
  }

  // ----- POS: merchant session only (HQ cookie never elevates) -----
  if (pathname === '/pos' || pathname.startsWith('/pos/')) {
    const merchantToken = req.cookies.get(MERCHANT_SESSION_COOKIE_NAME)?.value;
    const merchantSession = await verifyMerchantSessionEdge(merchantToken);
    const decision = decidePosAccess({
      pathname,
      hasMerchantSession: Boolean(merchantSession),
    });

    if (decision.action === 'redirect') {
      const url = req.nextUrl.clone();
      url.pathname = decision.pathname;
      url.search = '';
      if (decision.next) url.searchParams.set('next', decision.next);
      const redirect = NextResponse.redirect(url);
      redirect.headers.set('Cache-Control', 'private, no-store');
      return redirect;
    }

    // POS 登入頁本身可短快取（未登入流量）
    if (pathname === '/pos/login' || pathname.startsWith('/pos/login/')) {
      return withPublicHtmlCache(NextResponse.next());
    }

    const res = NextResponse.next();
    res.headers.set('Cache-Control', 'private, no-store');
    return res;
  }

  // ----- HQ admin -----
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionEdge(token);
  const isPublic = HQ_PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
  const decision = decideHqAccess({
    pathname,
    hasHqSession: Boolean(session),
    isPublic,
  });

  if (decision.action === 'redirect') {
    const url = req.nextUrl.clone();
    url.pathname = decision.pathname;
    url.search = '';
    if (decision.next) url.searchParams.set('next', decision.next);
    const redirect = NextResponse.redirect(url);
    redirect.headers.set('Cache-Control', 'private, no-store');
    return redirect;
  }

  // /login：未登入才會走到這裡 → 允許 CDN 短快取登入殼層
  if (pathname === '/login' || pathname.startsWith('/login/')) {
    return withPublicHtmlCache(NextResponse.next(), CDN_PUBLIC_HTML_LONG);
  }

  const res = NextResponse.next();
  res.headers.set('Cache-Control', 'private, no-store');
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
