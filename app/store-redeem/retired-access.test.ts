import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { describe, it } from 'node:test';

const RETIRED_DESTINATION = '/pos/login';
const forbiddenHits: string[] = [];

const harness = globalThis as typeof globalThis & {
  __RETIRED_REDIRECTS__: string[];
  __RETIRED_FORBIDDEN__: string[];
};

harness.__RETIRED_REDIRECTS__ = [];
harness.__RETIRED_FORBIDDEN__ = forbiddenHits;

const loader = `
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'next/navigation') {
    return {
      shortCircuit: true,
      url: 'data:text/javascript,export function redirect(url){globalThis.__RETIRED_REDIRECTS__.push(String(url));const err=new Error("NEXT_REDIRECT");err.digest="NEXT_REDIRECT;replace;"+String(url)+";307;";throw err;}',
    };
  }
  if (specifier === '@/lib/stores/list-redeem-stores') {
    return {
      shortCircuit: true,
      url: 'data:text/javascript,export async function listRedeemStores(){globalThis.__RETIRED_FORBIDDEN__.push("listRedeemStores");throw new Error("listRedeemStores unreachable")}',
    };
  }
  if (specifier === '@/lib/stores/verify-store-access') {
    return {
      shortCircuit: true,
      url: 'data:text/javascript,export async function verifyStoreAccessSegment(){globalThis.__RETIRED_FORBIDDEN__.push("verifyStoreAccessSegment");throw new Error("verifyStoreAccessSegment unreachable")}',
    };
  }
  if (specifier === '@/lib/prisma') {
    return {
      shortCircuit: true,
      url: 'data:text/javascript,export const prisma=new Proxy({},{get(){globalThis.__RETIRED_FORBIDDEN__.push("prisma");throw new Error("prisma unreachable")}})',
    };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.startsWith('file:') && url.endsWith('.tsx')) {
    const source = readFileSync(fileURLToPath(url), 'utf8');
    return { format: 'module', source, shortCircuit: true };
  }
  return nextLoad(url, context);
}
`;

register(`data:text/javascript,${encodeURIComponent(loader)}`, pathToFileURL(import.meta.url));

const { default: StoreRedeemPage } = await import('./page.tsx');
const { default: StoreAccessRedeemPage } = await import('../store/[access]/page.tsx');

function redirectLocation(error: unknown): string {
  assert.ok(error && typeof error === 'object');
  const digest = String((error as { digest?: string }).digest ?? '');
  assert.match(digest, /^NEXT_REDIRECT;/);
  const parts = digest.split(';');
  const location = parts[2] ?? '';
  assert.ok(location, 'redirect location missing');
  return location;
}

async function assertRetiredRedirect(run: () => Promise<unknown>, marker: string) {
  harness.__RETIRED_REDIRECTS__.length = 0;
  forbiddenHits.length = 0;

  await assert.rejects(run, (error: unknown) => {
    const location = redirectLocation(error);
    assert.equal(location, RETIRED_DESTINATION);
    assert.equal(location.includes('?'), false);
    assert.equal(location.includes('#'), false);
    if (marker) assert.equal(location.includes(marker), false);
    return true;
  });

  assert.deepEqual(harness.__RETIRED_REDIRECTS__, [RETIRED_DESTINATION]);
  assert.deepEqual(forbiddenHits, []);
}

function trappedBox(label: string, marker: string): object {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        throw new Error(`${label} must not be read (${String(prop)}:${marker})`);
      },
      ownKeys() {
        throw new Error(`${label} must not be enumerated (${marker})`);
      },
    },
  );
}

describe('legacy public store redeem pages are retired', () => {
  it('redirects /store-redeem before reading any searchParams', async () => {
    const marker = '__LEAK_STORE_REDEEM_QUERY__';
    await assertRetiredRedirect(
      () =>
        StoreRedeemPage({
          searchParams: trappedBox('searchParams', marker),
        } as never),
      marker,
    );
  });

  it('redirects /store-redeem for malicious query-shaped props', async () => {
    const marker = 'https://evil.example/phish';
    await assertRetiredRedirect(
      () =>
        StoreRedeemPage({
          searchParams: {
            store: marker,
            token: marker,
            next: marker,
            access: `zhuwo_zhonghe-${marker}`,
          },
        } as never),
      marker,
    );
  });

  it('redirects /store/[access] before reading path tokens', async () => {
    const marker = '__LEAK_STORE_ACCESS_PATH__';
    await assertRetiredRedirect(
      () =>
        StoreAccessRedeemPage({
          params: trappedBox('params', marker),
        } as never),
      marker,
    );
  });

  it('redirects /store/[access] for known-format, malformed, and malicious access', async () => {
    const cases = [
      'zhuwo_zhonghe-not-a-live-token',
      'slug-only',
      '-',
      '',
      '//evil.example',
      'javascript:alert(1)',
      '__LEAK_STORE_ACCESS_MALFORMED__',
    ];

    for (const access of cases) {
      await assertRetiredRedirect(
        () => StoreAccessRedeemPage({ params: { access } } as never),
        access,
      );
    }
  });
});
