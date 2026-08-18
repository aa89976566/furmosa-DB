import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), rel), 'utf8');
}

describe('merchant POS preview access contract', () => {
  it('keeps the route at /preview/merchant-pos', () => {
    const page = read('app/preview/merchant-pos/page.tsx');
    assert.match(page, /MerchantPosPreviewApp/);
    assert.equal(page.includes('/pos/'), false);
  });

  it('does not widen public access or change existing HQ login', () => {
    const middleware = read('middleware.ts');
    assert.match(
      middleware,
      /const PUBLIC_PATHS = \['\/login', '\/store', '\/store-redeem', '\/book'\]/,
    );
    assert.equal(middleware.includes('/preview'), false);
    assert.match(middleware, /decideHqAccess/);
    assert.equal(middleware.includes("pathname.startsWith('/preview')"), false);
  });
});
