import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(path.join(root, rel), 'utf8');
}

const AUTH_FILES = [
  'lib/grooming-voucher-preview/preview-auth.ts',
  'lib/grooming-voucher-preview/preview-auth-core.ts',
  'lib/grooming-voucher-preview/preview-surface-gate.ts',
  'app/preview/grooming-voucher/page.tsx',
  'app/preview/grooming-voucher/actions.ts',
  'app/preview/grooming-voucher/layout.tsx',
];

const FORBIDDEN = [
  /from\s+['"][^'"]*(?:prisma|@prisma\/client)['"]/,
  /\bPrismaClient\b/,
  /\bprisma\./,
  /\bfetch\s*\(/,
  /['"`]\/api\//,
  /DATABASE_URL/,
  /schema\.prisma/,
];

describe('grooming preview auth static contract', () => {
  it('new auth files stay off the database and do not fetch', () => {
    for (const file of AUTH_FILES) {
      const src = read(file);
      for (const re of FORBIDDEN) {
        assert.equal(re.test(src), false, `${file} matches ${re}`);
      }
    }
  });

  it('does not embed plaintext password or scrypt material outside tests', () => {
    for (const file of AUTH_FILES) {
      const src = read(file);
      assert.equal(/preview-test-password/.test(src), false, file);
      assert.equal(/n=16384,r=8,p=1\$[A-Za-z0-9_-]{8,}/.test(src), false, file);
      assert.equal(/GROOMING_PREVIEW_PASSWORD\s*=/.test(src), false, file);
    }
  });

  it('wrapper keeps server-only sentinel and only re-exports the core', () => {
    const wrapper = read('lib/grooming-voucher-preview/preview-auth.ts');
    assert.match(wrapper, /^import ['"]server-only['"]/m);
    assert.match(wrapper, /export \* from ['"]\.\/preview-auth-core['"]/);
    assert.equal(wrapper.includes('node:crypto'), false);
    assert.equal(wrapper.includes('createHmac'), false);
    const core = read('lib/grooming-voucher-preview/preview-auth-core.ts');
    assert.equal(core.includes('server-only'), false);
    assert.match(core, /createHmac\(\s*['"]sha256['"]\s*,\s*secretBytes/);
    assert.equal(/createHmac\([^)]*GROOMING_PREVIEW_COOKIE_SECRET/.test(core), false);
    const page = read('app/preview/grooming-voucher/page.tsx');
    const actions = read('app/preview/grooming-voucher/actions.ts');
    assert.match(page, /grooming-voucher-preview\/preview-auth['"]/);
    assert.equal(page.includes('preview-auth-core'), false);
    assert.match(actions, /grooming-voucher-preview\/preview-auth['"]/);
    assert.equal(actions.includes('preview-auth-core'), false);
    for (const file of [
      'components/grooming-voucher-preview/pos-preview-app.tsx',
      'components/grooming-voucher-preview/hq-preview-app.tsx',
      'components/grooming-voucher-preview/preview-banner.tsx',
    ]) {
      const src = read(file);
      assert.equal(src.includes('preview-auth'), false, file);
      assert.equal(src.includes('preview-auth-core'), false, file);
    }
  });

  it('middleware gate has no HMAC or scrypt and only exact-path helper', () => {
    const middleware = read('middleware.ts');
    const gate = read('lib/grooming-voucher-preview/preview-surface-gate.ts');
    assert.match(middleware, /shouldBypassHqForGroomingPreviewSurface/);
    assert.match(middleware, /No cookie\/HMAC here/);
    assert.equal(middleware.includes('createHmac'), false);
    assert.equal(middleware.includes('scrypt'), false);
    assert.equal(middleware.includes('timingSafeEqual'), false);
    assert.equal(middleware.includes("'/preview'"), false);
    assert.equal(gate.includes('createHmac'), false);
    assert.equal(gate.includes('node:crypto'), false);
    assert.equal(gate.includes('timingSafeEqual'), false);
    assert.equal(/scrypt\s*\(/.test(gate), false);
    assert.equal(gate.includes('cookies.get'), false);
    assert.equal(gate.includes('server-only'), false);
    assert.match(gate, /pathname === GROOMING_PREVIEW_PATH/);
    assert.match(gate, /parseGroomingPreviewCookieSecret/);
  });

  it('server page verifies cookie before rendering PosPreviewApp', () => {
    const page = read('app/preview/grooming-voucher/page.tsx');
    assert.match(page, /evaluatePageAccess/);
    assert.match(page, /access === 'app'/);
    assert.match(page, /PosGroomingVoucherPreviewApp/);
    assert.match(page, /notFound\(\)/);
    assert.equal(page.includes('returnUrl'), false);
    assert.equal(page.includes('name="next"'), false);
    assert.equal(page.includes('name="returnUrl"'), false);
  });

  it('login action uses fixed redirect and same-origin server evaluation', () => {
    const actions = read('app/preview/grooming-voucher/actions.ts');
    const serverDirective = ['use', 'server'].join(' ');
    assert.ok(
      actions.includes(`'${serverDirective}'`) || actions.includes(`"${serverDirective}"`),
    );
    assert.match(actions, /evaluateLoginAttempt/);
    assert.match(actions, /evaluateLogout/);
    assert.equal(actions.includes('returnUrl'), false);
    assert.equal(actions.includes('formData.get(\'next\')'), false);
    assert.equal(actions.includes('formData.get("next")'), false);
  });

  it('layout is no-store / force-dynamic', () => {
    const layout = read('app/preview/grooming-voucher/layout.tsx');
    assert.match(layout, /force-dynamic/);
    assert.match(layout, /force-no-store/);
    assert.match(layout, /revalidate = 0/);
  });

  it('does not change existing POS preview page or legacy coupons stub', () => {
    const posPage = read('app/pos/grooming-voucher-preview/page.tsx');
    assert.match(posPage, /PosGroomingVoucherPreviewApp/);
    assert.equal(posPage.includes('preview-auth'), false);
    const coupons = read('app/api/coupons/route.ts');
    assert.match(coupons, /status: 410/);
  });
});
