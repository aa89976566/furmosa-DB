/**
 * 早安 opt-in postback：HMAC 防偽 + 過期／重播防護
 * data 格式：morning=1&mode=<storageMode>&uid=<lineUserId>&exp=<unix>&n=<nonce>&sig=<hex>
 */

import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { resolveAuthSecret } from '@/lib/auth-secret';
import type { MorningContentMode } from '@/lib/line/morning/constants';

/** 新會員主選（不含 legacy alternate） */
export const MORNING_OPTIN_STORAGE_MODES = [
  'jokes',
  'news',
  'news_first_fact_fallback',
  'news_first_fact_or_humor_fallback',
  'off',
] as const;
export type MorningOptinStorageMode = (typeof MORNING_OPTIN_STORAGE_MODES)[number];

const USED_NONCES = new Map<string, number>();
const NONCE_TTL_MS = 45 * 60 * 1000;
const DEFAULT_TTL_SEC = 30 * 60;

function pruneNonces(now = Date.now()) {
  for (const [n, exp] of USED_NONCES) {
    if (exp <= now) USED_NONCES.delete(n);
  }
}

function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export function isMorningOptinStorageMode(
  v: string,
): v is MorningOptinStorageMode {
  return (MORNING_OPTIN_STORAGE_MODES as readonly string[]).includes(v);
}

export function buildMorningOptinPostbackData(input: {
  mode: MorningOptinStorageMode;
  lineUserId: string;
  now?: Date;
  ttlSec?: number;
  nonce?: string;
  secret?: string;
}): { data: string; nonce: string; exp: number } {
  const now = input.now ?? new Date();
  const exp = Math.floor(now.getTime() / 1000) + (input.ttlSec ?? DEFAULT_TTL_SEC);
  const nonce = input.nonce ?? randomBytes(8).toString('hex');
  const secret = input.secret ?? resolveAuthSecret();
  const base = `morning=1&mode=${input.mode}&uid=${encodeURIComponent(input.lineUserId)}&exp=${exp}&n=${nonce}`;
  const sig = signPayload(base, secret);
  return { data: `${base}&sig=${sig}`, nonce, exp };
}

export type VerifyMorningOptinResult =
  | {
      ok: true;
      mode: MorningOptinStorageMode;
      lineUserId: string;
      nonce: string;
    }
  | { ok: false; reason: string };

export function verifyMorningOptinPostback(input: {
  data: string;
  expectedLineUserId: string;
  now?: Date;
  secret?: string;
  /** 若提供，nonce 必須吻合（綁定當次提示） */
  expectedNonce?: string | null;
}): VerifyMorningOptinResult {
  const nowSec = Math.floor((input.now ?? new Date()).getTime() / 1000);
  pruneNonces();

  const params = new URLSearchParams(input.data);
  if (params.get('morning') !== '1') {
    return { ok: false, reason: 'not_morning_optin' };
  }
  const mode = params.get('mode') ?? '';
  const uid = params.get('uid') ?? '';
  const expRaw = params.get('exp') ?? '';
  const nonce = params.get('n') ?? '';
  const sig = params.get('sig') ?? '';
  if (!isMorningOptinStorageMode(mode)) {
    return { ok: false, reason: 'invalid_mode' };
  }
  if (!uid || uid !== input.expectedLineUserId) {
    return { ok: false, reason: 'uid_mismatch' };
  }
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < nowSec) {
    return { ok: false, reason: 'expired' };
  }
  if (!nonce || !sig) {
    return { ok: false, reason: 'missing_nonce_or_sig' };
  }
  if (input.expectedNonce && input.expectedNonce !== nonce) {
    return { ok: false, reason: 'nonce_mismatch' };
  }
  if (USED_NONCES.has(nonce)) {
    return { ok: false, reason: 'replay' };
  }

  const secret = input.secret ?? resolveAuthSecret();
  const base = `morning=1&mode=${mode}&uid=${encodeURIComponent(uid)}&exp=${exp}&n=${nonce}`;
  const expected = signPayload(base, secret);
  if (!safeEqualHex(sig, expected)) {
    return { ok: false, reason: 'bad_signature' };
  }

  USED_NONCES.set(nonce, Date.now() + NONCE_TTL_MS);
  return { ok: true, mode, lineUserId: uid, nonce };
}

/** 測試用：清空重播快取 */
export function resetMorningOptinNonceCacheForTests() {
  USED_NONCES.clear();
}

/** Quick-reply 按鈕（label ≤20 字） */
export function buildMorningOptinQuickReplyItems(lineUserId: string): {
  items: Array<{
    type: 'action';
    action: {
      type: 'postback';
      label: string;
      data: string;
      displayText: string;
    };
  }>;
  nonce: string;
} {
  const sharedNonce = randomBytes(8).toString('hex');
  const specs: Array<{ mode: MorningOptinStorageMode; label: string; displayText: string }> = [
    { mode: 'jokes', label: '1 僅毛孩笑話', displayText: '僅毛孩笑話' },
    { mode: 'news', label: '2 新鮮事｜跳過', displayText: '寵物新鮮事；沒有就跳過' },
    {
      mode: 'news_first_fact_fallback',
      label: '3 新鮮事｜冷知識',
      displayText: '新鮮事；沒有可看冷知識',
    },
    {
      mode: 'news_first_fact_or_humor_fallback',
      label: '4 新鮮事到日常',
      displayText: '新鮮事；沒有冷知識再日常',
    },
    { mode: 'off', label: '5 先不用', displayText: '先不用' },
  ];
  const items = specs.map((s) => {
    const { data } = buildMorningOptinPostbackData({
      mode: s.mode,
      lineUserId,
      nonce: sharedNonce,
    });
    return {
      type: 'action' as const,
      action: {
        type: 'postback' as const,
        label: s.label,
        data,
        displayText: s.displayText,
      },
    };
  });
  return { items, nonce: sharedNonce };
}

/** 給 upsert 用的 contentMode 型別守衛 */
export function asUpsertContentMode(
  mode: MorningOptinStorageMode,
): Exclude<MorningContentMode, 'unset'> {
  return mode;
}
