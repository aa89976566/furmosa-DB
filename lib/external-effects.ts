/**
 * 外部副作用閘門（P0 核心規則，純函式）。
 *
 * - 所有環境值必須由呼叫端注入；本模組不讀取執行環境變數物件。
 * - 預設 fail-closed：缺值／未知值一律 deny。
 * - 現階段僅 production + enabled 可放行；preview/local/test 即使 enabled 也 deny。
 * - 不做 URL／Supabase／LINE／ECPay 指紋解析（沙盒齊備後另案）。
 */

export const APP_ENV_VALUES = ['production', 'preview', 'local', 'test'] as const;
export type AppEnv = (typeof APP_ENV_VALUES)[number];

export const EXTERNAL_EFFECTS_MODE_VALUES = ['enabled', 'disabled'] as const;
export type ExternalEffectsMode = (typeof EXTERNAL_EFFECTS_MODE_VALUES)[number];

export type ExternalEffectsDenyReason =
  | 'missing_app_env'
  | 'invalid_app_env'
  | 'missing_mode'
  | 'invalid_mode'
  | 'mode_disabled'
  | 'non_production_effects_disabled';

/** 注入用輸入；只接受已知鍵，不承載任意 secret 回顯。 */
export type ExternalEffectsEnvInput = {
  APP_ENV?: string;
  EXTERNAL_EFFECTS_MODE?: string;
};

export type ExternalEffectsDecision =
  | {
      allowed: true;
      appEnv: AppEnv;
      mode: 'enabled';
    }
  | {
      allowed: false;
      reason: ExternalEffectsDenyReason;
    };

function normalize(raw: string | undefined): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function parseAppEnv(
  raw: string | undefined,
): { ok: true; value: AppEnv } | { ok: false; reason: 'missing_app_env' | 'invalid_app_env' } {
  const value = normalize(raw);
  if (value === undefined) return { ok: false, reason: 'missing_app_env' };
  if ((APP_ENV_VALUES as readonly string[]).includes(value)) {
    return { ok: true, value: value as AppEnv };
  }
  return { ok: false, reason: 'invalid_app_env' };
}

export function parseExternalEffectsMode(
  raw: string | undefined,
):
  | { ok: true; value: ExternalEffectsMode }
  | { ok: false; reason: 'missing_mode' | 'invalid_mode' } {
  const value = normalize(raw);
  if (value === undefined) return { ok: false, reason: 'missing_mode' };
  if ((EXTERNAL_EFFECTS_MODE_VALUES as readonly string[]).includes(value)) {
    return { ok: true, value: value as ExternalEffectsMode };
  }
  return { ok: false, reason: 'invalid_mode' };
}

/**
 * 決策外部副作用是否允許。
 * 規格（Prompt 2/3）：
 * 1) APP_ENV 必須是 production|preview|local|test
 * 2) EXTERNAL_EFFECTS_MODE 必須是 enabled|disabled；缺值／未知視為不可放行
 * 3) 僅 APP_ENV=production 且 mode=enabled → allowed
 * 4) preview/local/test 即使 mode=enabled → deny（non_production_effects_disabled）
 * 5) 不做指紋解析；不回傳任何傳入字串內容
 */
export function decideExternalEffects(
  env: ExternalEffectsEnvInput,
): ExternalEffectsDecision {
  const appEnvResult = parseAppEnv(env.APP_ENV);
  if (!appEnvResult.ok) {
    return { allowed: false, reason: appEnvResult.reason };
  }

  const modeResult = parseExternalEffectsMode(env.EXTERNAL_EFFECTS_MODE);
  if (!modeResult.ok) {
    return { allowed: false, reason: modeResult.reason };
  }

  if (modeResult.value === 'disabled') {
    return { allowed: false, reason: 'mode_disabled' };
  }

  // mode === 'enabled' beyond this point
  if (appEnvResult.value !== 'production') {
    return { allowed: false, reason: 'non_production_effects_disabled' };
  }

  return {
    allowed: true,
    appEnv: 'production',
    mode: 'enabled',
  };
}

/** 便利 API：是否允許外部副作用。 */
export function allowsExternalEffects(env: ExternalEffectsEnvInput): boolean {
  return decideExternalEffects(env).allowed;
}
