import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), rel), 'utf8');
}

const PUBLIC_PATHS = ['/login', '/store', '/store-redeem', '/book'] as const;
const MERCHANT_POS_PREVIEW_PATH = '/preview/merchant-pos';

function isExactPublicMerchantPosPreviewPath(pathname: string): boolean {
  return pathname === MERCHANT_POS_PREVIEW_PATH || pathname === `${MERCHANT_POS_PREVIEW_PATH}/`;
}

function isHqPublicPath(pathname: string): boolean {
  return (
    isExactPublicMerchantPosPreviewPath(pathname) ||
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  );
}

describe('merchant POS preview access contract', () => {
  it('keeps the route at /preview/merchant-pos', () => {
    const page = read('app/preview/merchant-pos/page.tsx');
    assert.match(page, /MerchantPosPreviewApp/);
    assert.equal(page.includes('/pos/'), false);
  });

  it('makes only the exact merchant POS preview path public', () => {
    const middleware = read('middleware.ts');
    assert.match(
      middleware,
      /const PUBLIC_PATHS = \['\/login', '\/store', '\/store-redeem', '\/book'\]/,
    );
    assert.match(middleware, /const MERCHANT_POS_PREVIEW_PATH = '\/preview\/merchant-pos'/);
    assert.match(middleware, /function isExactPublicMerchantPosPreviewPath/);
    assert.match(
      middleware,
      /pathname === MERCHANT_POS_PREVIEW_PATH \|\| pathname === `\$\{MERCHANT_POS_PREVIEW_PATH\}\/`/,
    );
    assert.match(middleware, /isExactPublicMerchantPosPreviewPath\(pathname\)/);
    assert.equal(middleware.includes("pathname.startsWith('/preview')"), false);
    assert.equal(middleware.includes("pathname.startsWith('/preview/merchant-pos')"), false);
    assert.equal(middleware.includes("PUBLIC_PATHS = ["), true);
    assert.equal(/PUBLIC_PATHS = \[[^\]]*preview/.test(middleware), false);

    assert.equal(isHqPublicPath('/preview/merchant-pos'), true);
    assert.equal(isHqPublicPath('/preview/merchant-pos/'), true);
    assert.equal(isHqPublicPath('/preview/merchant-pos/extra'), false);
    assert.equal(isHqPublicPath('/preview/merchant-pos/extra/'), false);
  });

  it('keeps other preview, POS, API and HQ routes protected', () => {
    const stillProtected = [
      '/preview',
      '/preview/',
      '/preview/other',
      '/preview/grooming-voucher',
      '/preview/grooming-voucher/',
      '/pos',
      '/pos/',
      '/pos/login',
      '/api',
      '/api/notifications/subscribe',
      '/api/merchant/refill-orders',
      '/dashboard',
      '/merchants',
      '/customers',
      '/settlements',
    ];
    for (const pathname of stillProtected) {
      assert.equal(isHqPublicPath(pathname), false, pathname);
    }
    assert.equal(isHqPublicPath('/login'), true);
  });

  it('does not add preview credentials or change fixture-only behavior', () => {
    const page = read('app/preview/merchant-pos/page.tsx');
    const banner = read('components/merchant-pos-preview/preview-banner.tsx');
    const middleware = read('middleware.ts');
    const guard = read('lib/merchant-pos-preview/__tests__/static-guard.test.ts');
    assert.match(page, /MerchantPosPreviewApp/);
    assert.match(banner, /PREVIEW_BANNER_PRIMARY/);
    assert.equal(page.includes('process.env'), false);
    assert.equal(page.includes('fetch('), false);
    assert.equal(middleware.includes('PREVIEW_PASSWORD'), false);
    assert.equal(middleware.includes('PREVIEW_USER'), false);
    assert.equal(middleware.includes('BASIC_AUTH'), false);
    assert.match(guard, /prisma/i);
    assert.match(guard, /fetch/);
    assert.match(guard, /use server/);
  });
});
