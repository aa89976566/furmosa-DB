/**
 * LINE reply/push choke — mock fetch，synthetic env only。
 * afterEach 完整還原 fetch 與本檔碰過的 env 鍵。
 */
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { replyLineText } from '@/lib/line/reply';
import { pushLineMessages } from '@/lib/line/push';

const SYNTHETIC_TOKEN = 'synthetic-line-token-DO-NOT-LEAK';
const SYNTHETIC_SECRET = 'synthetic-line-secret-DO-NOT-LEAK';
const SYNTHETIC_USER_ID = `U${'a'.repeat(32)}`;
const SYNTHETIC_REPLY_TOKEN = 'synthetic-reply-token-DO-NOT-LEAK';
const SYNTHETIC_MESSAGE = 'synthetic-payload-text-DO-NOT-LEAK';

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
    fetchCalls.push(typeof input === 'string' || input instanceof URL ? String(input) : input.url);
    return new Response('{}', { status: 200 });
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
    SYNTHETIC_REPLY_TOKEN,
    SYNTHETIC_MESSAGE,
  ]) {
    assert.equal(blob.includes(probe), false, `must not leak ${probe.slice(0, 12)}…`);
  }
}

describe('LINE reply choke (postReply)', () => {
  it('production+enabled calls fetch exactly once', async () => {
    setEnv('APP_ENV', 'production');
    setEnv('EXTERNAL_EFFECTS_MODE', 'enabled');
    await replyLineText(SYNTHETIC_REPLY_TOKEN, SYNTHETIC_MESSAGE);
    assert.equal(fetchCalls.length, 1);
    assert.match(fetchCalls[0]!, /api\.line\.me\/v2\/bot\/message\/reply/);
  });

  for (const caseName of [
    'preview',
    'local',
    'test',
    'missing_app_env',
    'disabled',
  ] as const) {
    it(`deny ${caseName}: fetch 0 and does not throw`, async () => {
      if (caseName === 'missing_app_env') {
        setEnv('APP_ENV', undefined);
        setEnv('EXTERNAL_EFFECTS_MODE', 'enabled');
      } else if (caseName === 'disabled') {
        setEnv('APP_ENV', 'production');
        setEnv('EXTERNAL_EFFECTS_MODE', 'disabled');
      } else {
        setEnv('APP_ENV', caseName);
        setEnv('EXTERNAL_EFFECTS_MODE', 'enabled');
      }

      await assert.doesNotReject(() =>
        replyLineText(SYNTHETIC_REPLY_TOKEN, SYNTHETIC_MESSAGE),
      );
      assert.equal(fetchCalls.length, 0);
      assertNoSensitiveLeak(consoleChunks);
    });
  }
});

describe('LINE push choke', () => {
  it('production+enabled calls fetch exactly once', async () => {
    setEnv('APP_ENV', 'production');
    setEnv('EXTERNAL_EFFECTS_MODE', 'enabled');
    const result = await pushLineMessages(SYNTHETIC_USER_ID, [
      { type: 'text', text: SYNTHETIC_MESSAGE },
    ]);
    assert.deepEqual(result, { ok: true });
    assert.equal(fetchCalls.length, 1);
    assert.match(fetchCalls[0]!, /api\.line\.me\/v2\/bot\/message\/push/);
  });

  for (const caseName of [
    'preview',
    'local',
    'test',
    'missing_app_env',
    'disabled',
  ] as const) {
    it(`deny ${caseName}: fetch 0 and skipped:true`, async () => {
      if (caseName === 'missing_app_env') {
        setEnv('APP_ENV', undefined);
        setEnv('EXTERNAL_EFFECTS_MODE', 'enabled');
      } else if (caseName === 'disabled') {
        setEnv('APP_ENV', 'production');
        setEnv('EXTERNAL_EFFECTS_MODE', 'disabled');
      } else {
        setEnv('APP_ENV', caseName);
        setEnv('EXTERNAL_EFFECTS_MODE', 'enabled');
      }

      const result = await pushLineMessages(SYNTHETIC_USER_ID, [
        { type: 'text', text: SYNTHETIC_MESSAGE },
      ]);
      assert.equal(fetchCalls.length, 0);
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.skipped, true);
        assert.equal(result.error, '外部副作用已停用');
        assertNoSensitiveLeak([result.error, ...consoleChunks]);
      }
    });
  }
});
