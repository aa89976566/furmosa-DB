import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { describe, it } from 'node:test';

const ORIGIN = 'https://furmosa.test';
const DEST_PATH = '/pos/login';
const FORBIDDEN_COPY = ['匠寵驗證', '優惠碼', '請選擇店家', '核銷', 'store-redeem'];

const cookieReads: string[] = [];
const authReads: string[] = [];

const harness = globalThis as typeof globalThis & {
  __MW_COOKIE_READS__: string[];
  __MW_AUTH_READS__: string[];
};

harness.__MW_COOKIE_READS__ = cookieReads;
harness.__MW_AUTH_READS__ = authReads;

const loader = `
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'next/server') {
    return {
      shortCircuit: true,
      url: 'data:text/javascript,' + encodeURIComponent(` + '`' + `
        export class NextResponse extends Response {
          static redirect(url) {
            const loc = typeof url === 'string' ? url : String(url);
            return new NextResponse(null, { status: 307, headers: { Location: loc } });
          }
          static next() {
            return new NextResponse(null, { status: 200, headers: { 'x-middleware-next': '1' } });
          }
          static json(data, init = {}) {
            return new NextResponse(JSON.stringify(data), {
              status: init.status ?? 200,
              headers: { 'content-type': 'application/json' },
            });
          }
        }
      ` + '`' + `),
    };
  }
  if (specifier === '@/lib/auth-edge') {
    return {
      shortCircuit: true,
      url: 'data:text/javascript,export const SESSION_COOKIE_NAME="furmosa_session";export async function verifySessionEdge(){globalThis.__MW_AUTH_READS__.push("hq");return null}',
    };
  }
  if (specifier === '@/lib/merchant-auth/edge') {
    return {
      shortCircuit: true,
      url: 'data:text/javascript,export const MERCHANT_SESSION_COOKIE_NAME="furmosa_merchant_session";export async function verifyMerchantSessionEdge(){globalThis.__MW_AUTH_READS__.push("pos");return null}export function decidePosAccess({pathname,hasMerchantSession}){if(pathname==="/pos/login"||pathname.startsWith("/pos/login/"))return hasMerchantSession?{action:"redirect",pathname:"/pos"}:{action:"next"};if(!hasMerchantSession)return{action:"redirect",pathname:"/pos/login",next:pathname};return{action:"next"}}export function decideHqAccess({pathname,hasHqSession,isPublic}){if(!hasHqSession&&!isPublic)return{action:"redirect",pathname:"/login",next:pathname};return{action:"next"}}',
    };
  }
  return nextResolve(specifier, context);
}
`;

const previewSurfaceGateUrl = new URL(
  './lib/grooming-voucher-preview/preview-surface-gate.ts',
  import.meta.url,
).href;

const loaderWithPreviewGate = loader.replace(
  'return nextResolve(specifier, context);',
  `if (specifier === '@/lib/grooming-voucher-preview/preview-surface-gate') {
    return { shortCircuit: true, url: ${JSON.stringify(previewSurfaceGateUrl)} };
  }
  return nextResolve(specifier, context);`,
);

register(`data:text/javascript,${encodeURIComponent(loaderWithPreviewGate)}`, pathToFileURL(import.meta.url));

const { middleware } = await import('./middleware.ts');

function makeReq(url: string, opts: { trapCookies: boolean }) {
  const nextUrl = new URL(url) as URL & { clone: () => URL };
  nextUrl.clone = () => {
    const copied = new URL(nextUrl.toString()) as URL & { clone: () => URL };
    copied.clone = nextUrl.clone;
    return copied;
  };
  return {
    url,
    nextUrl,
    cookies: {
      get(name: string) {
        cookieReads.push(String(name));
        if (opts.trapCookies) {
          throw new Error(`cookies must not be read (${name})`);
        }
        return undefined;
      },
    },
  };
}

async function invoke(url: string, trapCookies = false) {
  cookieReads.length = 0;
  authReads.length = 0;
  return middleware(makeReq(url, { trapCookies }) as never);
}

function headerBlob(res: Response): string {
  return [...res.headers.entries()].flat().join('\n');
}

async function assertRetiredRedirect(url: string, markers: string[]) {
  const res = await invoke(url, true);
  assert.equal(res.status, 307);
  const location = res.headers.get('location');
  assert.ok(location);
  const dest = new URL(location);
  assert.equal(dest.origin, ORIGIN);
  assert.equal(dest.pathname, DEST_PATH);
  assert.equal(dest.search, '');
  assert.equal(dest.hash, '');
  assert.equal(cookieReads.length, 0);
  assert.equal(authReads.length, 0);

  const body = await res.text();
  const hay = `${location}\n${headerBlob(res)}\n${body}`;
  for (const marker of [...markers, ...FORBIDDEN_COPY]) {
    if (!marker) continue;
    assert.equal(hay.includes(marker), false, `leaked ${marker}`);
  }
}

async function assertNotRetiredRedirect(url: string) {
  const res = await invoke(url, false);
  const location = res.headers.get('location');
  if (location) {
    const dest = new URL(location, ORIGIN);
    const isBarePosLogin =
      dest.pathname === DEST_PATH && dest.search === '' && dest.hash === '';
    assert.equal(isBarePosLogin, false, `${url} must not use retired redirect`);
  }
}

describe('retired store-redeem middleware redirect', () => {
  it('redirects exact /store-redeem before auth and without query', async () => {
    await assertRetiredRedirect(`${ORIGIN}/store-redeem`, []);
  });

  it('drops malicious query on /store-redeem', async () => {
    const marker = 'leak-query-118';
    await assertRetiredRedirect(
      `${ORIGIN}/store-redeem?store=${marker}&token=${marker}&next=https://evil.example`,
      [marker, 'evil.example', 'store=', 'token='],
    );
  });

  it('redirects /store/<one segment> without echoing the marker', async () => {
    const marker = 'fake-marker-118';
    await assertRetiredRedirect(`${ORIGIN}/store/${marker}`, [marker]);
  });

  it('redirects encoded and malformed single segments', async () => {
    await assertRetiredRedirect(`${ORIGIN}/store/${encodeURIComponent('<script>alert(1)')}`, [
      '<script>',
      'alert(1)',
    ]);
    await assertRetiredRedirect(`${ORIGIN}/store/foo%20bar`, ['foo bar', 'foo%20bar']);
  });

  it('does not intercept /store, nested /store paths, POS login, coupons, or HQ', async () => {
    await assertNotRetiredRedirect(`${ORIGIN}/store`);
    await assertNotRetiredRedirect(`${ORIGIN}/store/a/b`);
    await assertNotRetiredRedirect(`${ORIGIN}/store/foo/bar`);
    await assertNotRetiredRedirect(`${ORIGIN}/pos/login`);
    await assertNotRetiredRedirect(`${ORIGIN}/api/coupons`);
    await assertNotRetiredRedirect(`${ORIGIN}/dashboard`);
  });

  it('keeps a static contract that the early pathname rule exists', () => {
    const src = readFileSync(new URL('./middleware.ts', import.meta.url), 'utf8');
    assert.match(src, /RETIRED_STORE_REDEEM_DESTINATION = '\/pos\/login'/);
    assert.match(src, /isRetiredPublicStoreRedeemPath/);
    assert.match(src, /No cookies, session, or DB/);
    assert.equal(src.includes('FALLBACK_STORE_TOKENS'), false);
  });
});
