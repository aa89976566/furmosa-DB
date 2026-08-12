/**
 * LINE loading/profile choke — mock fetch，synthetic env only。
 * afterEach 完整還原 fetch 與本檔碰過的 env 鍵。
 */
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { showLineLoadingAnimation } from '@/lib/line/loading';
import { fetchLineUserDisplayName } from '@/lib/line/profile';

const SYNTHETIC_TOKEN = 'synthetic-line-token-DO-NOT-LEAK';
const SYNTHETIC_SECRET = 'synthetic-line-secret-DO-NOT-LEAK';
const SYNTHETIC_USER_ID = `U${'b'.repeat(32)}`;
const SYNTHETIC_DISPLAY_NAME = 'synthetic-display-name-DO-NOT-LEAK';

const TOUCHED_ENV_KEYS = [
  'APP_ENV',
  'EXTERNAL_EFFECTS_MODE',
  'LINE_CHANNEL_ACCESS_TOKEN',
  'LINE_CHANNEL_SECRET',
] as const;

const originalFetch = globalThis.fetch;
const originalEnv: Partial<Record<(typeof TOUCHED_ENV_KEYS)[number], string | undefined>> =
  {};

let fetchCalls: string[] = [];
let consoleChunks: string[] = [];
const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
};

function captureConsole(...args: unknown[]) {
  consoleChunks.push(args.map((a) => String(a)).join(' '));
}

function setEnv(key: (typeof TOUCHED_ENV_KEYS)[number], value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function installLineCreds() {
  setEnv('LINE_CHANNEL_ACCESS_TOKEN', SYNTHETIC_TOKEN);
  setEnv('LINE_CHANNEL_SECRET', SYNTHETIC_SECRET);
}

function mockFetchOk() {
  fetchCalls = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url =
      typeof input === 'string' || input instanceof URL ? String(input) : input.url;
    fetchCalls.push(url);
    if (url.includes('/v2/bot/profile/')) {
      return new Response(JSON.stringify({ displayName: SYNTHETIC_DISPLAY_NAME }), {
        status: 200,
      });
    }
    return new Response('{}', { status: 202 });
  }) as typeof fetch;
}

beforeEach(() => {
  for (const key of TOUCHED_ENV_KEYS) {
    if (!(key in originalEnv)) originalEnv[key] = process.env[key];
  }
  consoleChunks = [];
  console.log = captureConsole;
  console.info = captureConsole;
  console.warn = captureConsole;
  console.error = captureConsole;
  mockFetchOk();
  installLineCreds();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of TOUCHED_ENV_KEYS) {
    const prev = originalEnv[key];
    if (prev === undefined) delete process.env[key];
    else process.env[key] = prev;
  }
  console.log = originalConsole.log;
  console.info = originalConsole.info;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  fetchCalls = [];
  consoleChunks = [];
});

function assertNoSensitiveLeak(parts: string[]) {
  const blob = parts.join('\n');
  for (const probe of [
    SYNTHETIC_TOKEN,
    SYNTHETIC_SECRET,
    SYNTHETIC_USER_ID,
    SYNTHETIC_DISPLAY_NAME,
  ]) {
    assert.equal(blob.includes(probe), false, `must not leak ${probe.slice(0, 12)}…`);
  }
}

function applyDenyCase(
  caseName: 'preview' | 'local' | 'test' | 'missing_app_env' | 'missing_mode' | 'disabled',
) {
  if (caseName === 'missing_app_env') {
    setEnv('APP_ENV', undefined);
    setEnv('EXTERNAL_EFFECTS_MODE', 'enabled');
  } else if (caseName === 'missing_mode') {
    setEnv('APP_ENV', 'production');
    setEnv('EXTERNAL_EFFECTS_MODE', undefined);
  } else if (caseName === 'disabled') {
    setEnv('APP_ENV', 'production');
    setEnv('EXTERNAL_EFFECTS_MODE', 'disabled');
  } else {
    setEnv('APP_ENV', caseName);
    setEnv('EXTERNAL_EFFECTS_MODE', 'enabled');
  }
}

const DENY_CASES = [
  'preview',
  'local',
  'test',
  'missing_app_env',
  'missing_mode',
  'disabled',
] as const;

describe('LINE loading choke', () => {
  it('production+enabled calls fetch exactly once', async () => {
    setEnv('APP_ENV', 'production');
    setEnv('EXTERNAL_EFFECTS_MODE', 'enabled');
    const result = await showLineLoadingAnimation(SYNTHETIC_USER_ID, 20);
    assert.equal(result, undefined);
    assert.equal(fetchCalls.length, 1);
    assert.match(fetchCalls[0]!, /api\.line\.me\/v2\/bot\/chat\/loading\/start/);
    assertNoSensitiveLeak(consoleChunks);
  });

  for (const caseName of DENY_CASES) {
    it(`deny ${caseName}: fetch 0 and returns undefined`, async () => {
      applyDenyCase(caseName);
      const result = await showLineLoadingAnimation(SYNTHETIC_USER_ID, 20);
      assert.equal(result, undefined);
      assert.equal(fetchCalls.length, 0);
      assertNoSensitiveLeak(consoleChunks);
    });
  }
});

describe('LINE profile choke', () => {
  it('production+enabled calls fetch exactly once', async () => {
    setEnv('APP_ENV', 'production');
    setEnv('EXTERNAL_EFFECTS_MODE', 'enabled');
    const result = await fetchLineUserDisplayName(SYNTHETIC_USER_ID);
    assert.equal(result, SYNTHETIC_DISPLAY_NAME);
    assert.equal(fetchCalls.length, 1);
    assert.match(fetchCalls[0]!, /api\.line\.me\/v2\/bot\/profile\//);
    assertNoSensitiveLeak(consoleChunks);
  });

  for (const caseName of DENY_CASES) {
    it(`deny ${caseName}: fetch 0 and returns null`, async () => {
      applyDenyCase(caseName);
      const result = await fetchLineUserDisplayName(SYNTHETIC_USER_ID);
      assert.equal(result, null);
      assert.equal(fetchCalls.length, 0);
      assertNoSensitiveLeak(consoleChunks);
    });
  }
});
