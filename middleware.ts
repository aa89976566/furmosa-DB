import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionEdge } from '@/lib/auth-edge';
import {
  MERCHANT_SESSION_COOKIE_NAME,
  decideHqAccess,
  decidePosAccess,
  verifyMerchantSessionEdge,
} from '@/lib/merchant-auth/edge';
import {
  isAnonymousPublicPath,
  isHqLoginPath,
  isPosLoginPath,
  publicHtmlCacheControl,
  shouldBypassAuthForPublicShell,
} from '@/lib/cdn-route-policy';

const HQ_PUBLIC_PATHS = ['/login', '/store', '/store-redeem'];

function withPublicHtmlCache(res: NextResponse, pathname: string): NextResponse {
  const control = publicHtmlCacheControl(pathname);
  res.headers.set('Cache-Control', control);
  // Vercel CDN 優先讀取此標頭（與瀏覽器 Cache-Control 分離）
  res.headers.set('CDN-Cache-Control', control);
  res.headers.set('Vercel-CDN-Cache-Control', control);
  return res;
}

function privateNoStore(res: NextResponse): NextResponse {
  res.headers.set('Cache-Control', 'private, no-store');
  return res;
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

  const hqCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const merchantCookie = req.cookies.get(MERCHANT_SESSION_COOKIE_NAME)?.value;

  // 匿名／無 cookie 的登入殼：不驗證 JWT → 靜態／ISR HTML 可被 CDN HIT
  const shellMode = shouldBypassAuthForPublicShell({
    pathname,
    hasHqCookie: Boolean(hqCookie),
    hasMerchantCookie: Boolean(merchantCookie),
  });
  if (shellMode === 'public-cdn') {
    return withPublicHtmlCache(NextResponse.next(), pathname);
  }

  // ----- POS -----
  if (pathname === '/pos' || pathname.startsWith('/pos/')) {
    const merchantSession = await verifyMerchantSessionEdge(merchantCookie);
    const decision = decidePosAccess({
      pathname,
      hasMerchantSession: Boolean(merchantSession),
    });

    if (decision.action === 'redirect') {
      const url = req.nextUrl.clone();
      url.pathname = decision.pathname;
      url.search = '';
      if (decision.next) url.searchParams.set('next', decision.next);
      return privateNoStore(NextResponse.redirect(url));
    }

    if (isPosLoginPath(pathname)) {
      return withPublicHtmlCache(NextResponse.next(), pathname);
    }

    return privateNoStore(NextResponse.next());
  }

  // ----- HQ admin -----
  const session = await verifySessionEdge(hqCookie);
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
    return privateNoStore(NextResponse.redirect(url));
  }

  if (isHqLoginPath(pathname) || isAnonymousPublicPath(pathname)) {
    return withPublicHtmlCache(NextResponse.next(), pathname);
  }

  return privateNoStore(NextResponse.next());
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
