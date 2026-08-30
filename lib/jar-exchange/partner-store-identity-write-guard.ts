/**
 * 店家身分寫入閘門。
 * Vercel Preview 一律拒絕，避免讀正式資料時寫回正式庫。
 * Production 預設關閉，第三層上線前不得寫入。
 * 本機／CI 臨時庫才允許確認與撤銷。
 */

export const IDENTITY_WRITE_OPERATIONS = [
  'create_acceptance',
  'confirm',
  'revoke',
  'add',
  'activate',
  'modify',
  'delete',
] as const;

export type IdentityWriteOperation = (typeof IDENTITY_WRITE_OPERATIONS)[number];

export const PREVIEW_READONLY_MESSAGE = '預覽模式不會儲存變更';
export const PRODUCTION_FEATURE_OFF_MESSAGE = '正式環境尚未開放寫入店家身分';
export const WRITE_NOT_IMPLEMENTED_MESSAGE = '這個寫入動作尚未開放';

export type IdentityWriteEnv = {
  VERCEL_ENV?: string;
  PARTNER_STORE_IDENTITY_WRITES?: string;
};

export type IdentityWriteDecision =
  | { allowed: true }
  | { allowed: false; reason: 'preview_readonly' | 'feature_off' | 'not_implemented'; error: string };

const LOCAL_PERSIST_OPS = new Set<IdentityWriteOperation>(['confirm', 'revoke']);

export function decideIdentityWrite(
  operation: IdentityWriteOperation,
  env: IdentityWriteEnv = process.env,
): IdentityWriteDecision {
  if (!IDENTITY_WRITE_OPERATIONS.includes(operation)) {
    return { allowed: false, reason: 'not_implemented', error: WRITE_NOT_IMPLEMENTED_MESSAGE };
  }
  if (env.VERCEL_ENV === 'preview') {
    return { allowed: false, reason: 'preview_readonly', error: PREVIEW_READONLY_MESSAGE };
  }
  if (env.VERCEL_ENV === 'production') {
    if (env.PARTNER_STORE_IDENTITY_WRITES !== 'enabled') {
      return { allowed: false, reason: 'feature_off', error: PRODUCTION_FEATURE_OFF_MESSAGE };
    }
    if (!LOCAL_PERSIST_OPS.has(operation)) {
      return { allowed: false, reason: 'not_implemented', error: WRITE_NOT_IMPLEMENTED_MESSAGE };
    }
    return { allowed: true };
  }
  if (!LOCAL_PERSIST_OPS.has(operation)) {
    return { allowed: false, reason: 'not_implemented', error: WRITE_NOT_IMPLEMENTED_MESSAGE };
  }
  return { allowed: true };
}

export function denyIdentityWrite(
  operation: IdentityWriteOperation,
  env: IdentityWriteEnv = process.env,
): { ok: false; error: string; reason: IdentityWriteDecision['reason'] } | null {
  const decision = decideIdentityWrite(operation, env);
  if (decision.allowed) return null;
  return { ok: false, error: decision.error, reason: decision.reason };
}
