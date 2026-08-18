import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionEdge } from '@/lib/auth-edge';
import {
  MERCHANT_SESSION_COOKIE_NAME,
  decideHqAccess,
  decidePosAccess,
  verifyMerchantSessionEdge,
} from '@/lib/merchant-auth/edge';

const PUBLIC_PATHS = ['/login', '/store', '/store-redeem', '/book'];

/** Fixture-only Merchant POS preview. Exact match only — never prefix /preview. */
const MERCHANT_POS_PREVIEW_PATH = '/preview/merchant-pos';

/**
 * Next.js 未開 trailingSlash。尾斜線只當同一頁等價路徑，
 * 不用 startsWith，避免 /preview/merchant-pos/extra 被誤開。
 */
function isExactPublicMerchantPosPreviewPath(pathname: string): boolean {
  return pathname === MERCHANT_POS_PREVIEW_PATH || pathname === `${MERCHANT_POS_PREVIEW_PATH}/`;
}

const RETIRED_STORE_REDEEM_DESTINATION = '/pos/login';

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

  // Pathname-only. No cookies, session, or DB. Runs before HQ/POS auth.
  if (isRetiredPublicStoreRedeemPath(pathname)) {
    return redirectRetiredStoreRedeem(req);
  }

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/line') ||
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/api/coupons') ||
    pathname.startsWith('/api/health') ||
    pathname.startsWith('/api/refill') ||
    pathname.startsWith('/api/payments/ecpay') ||
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
  const isPublic =
    isExactPublicMerchantPosPreviewPath(pathname) ||
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
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
