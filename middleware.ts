import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionEdge } from '@/lib/auth-edge';
import {
  MERCHANT_SESSION_COOKIE_NAME,
  decideHqAccess,
  decidePosAccess,
  verifyMerchantSessionEdge,
} from '@/lib/merchant-auth/edge';
import { decideFinanceAccess } from '@/lib/finance/access-policy';

const PUBLIC_PATHS = ['/login', '/store', '/store-redeem', '/book'];

const RETIRED_STORE_REDEEM_DESTINATION = '/pos/login';
const POS_CUSTOM_HOSTNAME = 'pos.furmosa.com';

function requestHostname(req: NextRequest): string {
  const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || req.headers.get('host') || req.nextUrl.host;
  return host.toLowerCase().replace(/:\d+$/, '');
}

function redirectOnSameOrigin(req: NextRequest, pathname: string): NextResponse {
  const url = req.nextUrl.clone();
  const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  url.hostname = requestHostname(req);
  url.port = '';
  if (forwardedProto === 'http' || forwardedProto === 'https') {
    url.protocol = `${forwardedProto}:`;
  }
  url.pathname = pathname;
  url.search = '';
  url.hash = '';
  return NextResponse.redirect(url);
}

/** Exact /store-redeem, or /store/<one segment> (legacy /store/[access] only). */
function isRetiredPublicStoreRedeemPath(pathname: string): boolean {
  if (pathname === '/store-redeem') return true;
  if (!pathname.startsWith('/store/')) return false;
  const segment = pathname.slice('/store/'.length);
  return segment.length > 0 && !segment.includes('/');
}

function redirectRetiredStoreRedeem(req: NextRequest): NextResponse {
  return NextResponse.redirect(
    new URL(RETIRED_STORE_REDEEM_DESTINATION, req.nextUrl.origin),
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPosCustomDomain = requestHostname(req) === POS_CUSTOM_HOSTNAME;

  // Pathname-only. No cookies, session, or DB. Runs before HQ/POS auth.
  if (isRetiredPublicStoreRedeemPath(pathname)) {
    return redirectRetiredStoreRedeem(req);
  }

  // The custom POS hostname is a friendly entry to the existing /pos app.
  // Authentication stays path-based below, so HQ and merchant sessions remain separate.
  if (isPosCustomDomain && (pathname === '/' || pathname === '/login')) {
    return redirectOnSameOrigin(req, pathname === '/login' ? '/pos/login' : '/pos');
  }

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/line') ||
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/api/coupons') ||
    pathname === '/api/health' ||
    pathname.startsWith('/api/refill') ||
    pathname.startsWith('/api/payments/ecpay') ||
    pathname.startsWith('/api/shopify/webhooks/') ||
    (pathname === '/api/storefront/pickup-stores' || pathname === '/api/storefront/pickup-stores/') ||
    pathname.startsWith('/liff') ||
    pathname.startsWith('/book') ||
    pathname.startsWith('/favicon') ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/sw.js' ||
    pathname.startsWith('/icons/') ||
    pathname.match(/\.(svg|png|jpg|jpeg|webp|ico|css|js|webmanifest)$/)
  ) {
    return NextResponse.next();
  }

  if (
    isPosCustomDomain &&
    pathname !== '/pos' &&
    !pathname.startsWith('/pos/') &&
    !pathname.startsWith('/api/merchant/')
  ) {
    return redirectOnSameOrigin(req, '/pos');
  }

  // ----- POS + merchant APIs: merchant session only (HQ cookie never elevates) -----
  if (
    pathname === '/pos' ||
    pathname.startsWith('/pos/') ||
    pathname.startsWith('/api/merchant/')
  ) {
    const merchantToken = req.cookies.get(MERCHANT_SESSION_COOKIE_NAME)?.value;
    const merchantSession = await verifyMerchantSessionEdge(merchantToken);

    if (pathname.startsWith('/api/merchant/')) {
      if (!merchantSession) {
        return NextResponse.json({ error: '請先登入店家帳號' }, { status: 401 });
      }
      return NextResponse.next();
    }

    const decision = decidePosAccess({
      pathname,
      hasMerchantSession: Boolean(merchantSession),
    });

    if (decision.action === 'redirect') {
      const url = req.nextUrl.clone();
      url.pathname = decision.pathname;
      url.search = '';
      if (decision.next) url.searchParams.set('next', decision.next);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // ----- HQ admin -----
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionEdge(token);
  const financeDecision = decideFinanceAccess({
    pathname,
    hasHqSession: Boolean(session),
    role: session?.role ?? null,
  });
  if (financeDecision === 'login') {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  if (financeDecision === 'forbid') {
    const message = '只有最高權限管理員可以查看財務與單位經濟';
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return new NextResponse(message, {
      status: 403,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
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
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
