/**
 * 正式小範圍寫入閘門。
 * Preview 一律拒絕。Production 預設關閉，且只允許指定 HQ 操作 MER-DEMO。
 * 五家真店一律拒絕寫入。
 */

export const IDENTITY_WRITE_OPERATIONS = ['confirm', 'revoke'] as const;
export type IdentityWriteOperation = (typeof IDENTITY_WRITE_OPERATIONS)[number];

export const LIMITED_ROLLOUT_MERCHANT_ID = 'MER-DEMO';

/** 總部指定可寫入的 HQ 帳號（與 seed 系統帳號相同）。POS 不含在內。 */
export const DESIGNATED_HQ_WRITER_EMAILS = [
  'admin@furmosa.com',
  'finance@furmosa.com',
  'ops@furmosa.com',
  'wh@furmosa.com',
] as const;

export const BLOCKED_REAL_STORE_MERCHANT_IDS = [
  'MER-0019',
  'MER-0020',
  'MER-0016',
  'MER-0017',
  'MER-0010',
] as const;

export const PREVIEW_READONLY_MESSAGE = '預覽模式不會儲存變更';
export const PRODUCTION_FEATURE_OFF_MESSAGE = '正式環境尚未開放寫入店家身分';
export const NO_ALLOWLIST_MESSAGE = '尚未指定可寫入的 HQ 帳號';
export const FORBIDDEN_ACTOR_MESSAGE = '這個總部帳號不能寫入店家身分';
export const BLOCKED_REAL_STORE_MESSAGE = '五家真店尚未批准寫入';
export const LIMITED_TARGET_MESSAGE = '這次只允許 MER-DEMO';

export type IdentityWriteDeniedReason =
  | 'preview_readonly'
  | 'feature_off'
  | 'no_allowlist'
  | 'forbidden_actor'
  | 'blocked_real_store'
  | 'limited_target';

export type IdentityWriteEnv = {
  VERCEL_ENV?: string | undefined;
  PARTNER_STORE_IDENTITY_WRITES?: string | undefined;
  PARTNER_STORE_IDENTITY_WRITERS?: string | undefined;
  [key: string]: string | undefined;
};

export type IdentityWriteDecision =
  | { allowed: true }
  | { allowed: false; reason: IdentityWriteDeniedReason; error: string };

export function parseAllowlistedHqEmails(raw?: string): string[] {
  const fromEnv = (raw ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (fromEnv.length > 0) return fromEnv;
  return DESIGNATED_HQ_WRITER_EMAILS.map((email) => email.toLowerCase());
}

export function isAllowlistedHqEmail(email: string | undefined, env: IdentityWriteEnv = process.env): boolean {
  const allowlist = parseAllowlistedHqEmails(env.PARTNER_STORE_IDENTITY_WRITERS);
  if (!email) return false;
  return allowlist.includes(email.trim().toLowerCase());
}

export function isBlockedRealStoreMerchantId(merchantId: string): boolean {
  return BLOCKED_REAL_STORE_MERCHANT_IDS.includes(
    merchantId.trim().toUpperCase() as (typeof BLOCKED_REAL_STORE_MERCHANT_IDS)[number],
  );
}

export function isLimitedRolloutMerchantId(merchantId: string): boolean {
  return merchantId.trim().toUpperCase() === LIMITED_ROLLOUT_MERCHANT_ID;
}

export function decideIdentityWrite(
  operation: IdentityWriteOperation,
  env: IdentityWriteEnv = process.env,
  actorEmail?: string,
): IdentityWriteDecision {
  if (!IDENTITY_WRITE_OPERATIONS.includes(operation)) {
    return { allowed: false, reason: 'feature_off', error: PRODUCTION_FEATURE_OFF_MESSAGE };
  }
  if (env.VERCEL_ENV === 'preview') {
    return { allowed: false, reason: 'preview_readonly', error: PREVIEW_READONLY_MESSAGE };
  }
  if (env.VERCEL_ENV === 'production') {
    if (env.PARTNER_STORE_IDENTITY_WRITES !== 'enabled') {
      return { allowed: false, reason: 'feature_off', error: PRODUCTION_FEATURE_OFF_MESSAGE };
    }
    if (!isAllowlistedHqEmail(actorEmail, env)) {
      return { allowed: false, reason: 'forbidden_actor', error: FORBIDDEN_ACTOR_MESSAGE };
    }
    return { allowed: true };
  }
  return { allowed: true };
}

export function denyIdentityWrite(
  operation: IdentityWriteOperation,
  env: IdentityWriteEnv = process.env,
  actorEmail?: string,
): { ok: false; error: string; reason: IdentityWriteDeniedReason } | null {
  const decision = decideIdentityWrite(operation, env, actorEmail);
  if (!decision.allowed) {
    return { ok: false, error: decision.error, reason: decision.reason };
  }
  return null;
}

export function denyMerchantWrite(
  merchantId: string,
  env: IdentityWriteEnv = process.env,
): { ok: false; error: string; reason: IdentityWriteDeniedReason } | null {
  if (isBlockedRealStoreMerchantId(merchantId)) {
    return { ok: false, error: BLOCKED_REAL_STORE_MESSAGE, reason: 'blocked_real_store' };
  }
  if (env.VERCEL_ENV === 'production' && !isLimitedRolloutMerchantId(merchantId)) {
    return { ok: false, error: LIMITED_TARGET_MESSAGE, reason: 'limited_target' };
  }
  return null;
}
