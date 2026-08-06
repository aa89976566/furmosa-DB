import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RefillError } from '@/lib/refill/errors';
import {
  LINE_ID_TOKEN_INVALID_CODE,
  LIFF_REFILL_REAUTH_GUARD_KEY,
  buildLiffRefillRedirectUri,
  clearLiffReauthGuard,
  isRecoverableLineIdTokenFailureMessage,
  mapToLineIdTokenInvalidError,
  markLiffReauthGuard,
  readLiffReauthGuard,
  shouldAttemptLiffReauth,
} from '@/lib/refill/liff-auth-recovery';

describe('isRecoverableLineIdTokenFailureMessage', () => {
  it('accepts IdToken expired', () => {
    assert.equal(isRecoverableLineIdTokenFailureMessage('IdToken expired.'), true);
    assert.equal(isRecoverableLineIdTokenFailureMessage('IdToken expired'), true);
  });

  it('rejects audience / config errors (re-login cannot fix)', () => {
    assert.equal(isRecoverableLineIdTokenFailureMessage('Invalid IdToken Audience'), false);
    assert.equal(isRecoverableLineIdTokenFailureMessage('缺少環境變數 LINE_CHANNEL_ID'), false);
  });

  it('rejects unrelated messages', () => {
    assert.equal(isRecoverableLineIdTokenFailureMessage('系統忙碌中，請稍後再試。'), false);
    assert.equal(isRecoverableLineIdTokenFailureMessage(''), false);
  });
});

describe('mapToLineIdTokenInvalidError', () => {
  it('maps expired Error to LINE_ID_TOKEN_INVALID RefillError', () => {
    const mapped = mapToLineIdTokenInvalidError(new Error('IdToken expired.'));
    assert.ok(mapped instanceof RefillError);
    assert.equal(mapped!.code, LINE_ID_TOKEN_INVALID_CODE);
    assert.equal(mapped!.status, 401);
  });

  it('returns null for DB-like / generic errors', () => {
    assert.equal(mapToLineIdTokenInvalidError(new Error('Connection reset')), null);
    assert.equal(mapToLineIdTokenInvalidError(new Error('Invalid IdToken Audience')), null);
  });

  it('passes through existing RefillError auth codes', () => {
    const existing = new RefillError('請先登入 LINE', 'NOT_LOGGED_IN', 401);
    assert.equal(mapToLineIdTokenInvalidError(existing), existing);
  });
});

describe('buildLiffRefillRedirectUri', () => {
  it('preserves path and non-empty _vercel_share', () => {
    const href =
      'https://preview.example/liff/refill?storeId=abc&_vercel_share=tok123&paid=1';
    assert.equal(
      buildLiffRefillRedirectUri(href),
      'https://preview.example/liff/refill?storeId=abc&_vercel_share=tok123&paid=1',
    );
  });

  it('does not invent _vercel_share when absent', () => {
    assert.equal(
      buildLiffRefillRedirectUri('https://preview.example/liff/refill?storeId=x'),
      'https://preview.example/liff/refill?storeId=x',
    );
  });

  it('drops empty _vercel_share', () => {
    assert.equal(
      buildLiffRefillRedirectUri('https://preview.example/liff/refill?_vercel_share='),
      'https://preview.example/liff/refill',
    );
  });
});

describe('shouldAttemptLiffReauth + guard', () => {
  it('allows one attempt for LINE_ID_TOKEN_INVALID only', () => {
    assert.equal(shouldAttemptLiffReauth(LINE_ID_TOKEN_INVALID_CODE, false), true);
    assert.equal(shouldAttemptLiffReauth(LINE_ID_TOKEN_INVALID_CODE, true), false);
    assert.equal(shouldAttemptLiffReauth('NO_BOOKING', false), false);
    assert.equal(shouldAttemptLiffReauth(undefined, false), false);
  });

  it('sessionStorage guard mark/read/clear', () => {
    const mem = new Map<string, string>();
    const storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v);
      },
      removeItem: (k: string) => {
        mem.delete(k);
      },
    };
    assert.equal(readLiffReauthGuard(storage), false);
    markLiffReauthGuard(storage);
    assert.equal(mem.get(LIFF_REFILL_REAUTH_GUARD_KEY), '1');
    assert.equal(readLiffReauthGuard(storage), true);
    clearLiffReauthGuard(storage);
    assert.equal(readLiffReauthGuard(storage), false);
  });
});
