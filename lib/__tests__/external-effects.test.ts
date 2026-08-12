/**
 * 外部副作用閘門 — 零 DB／零網路 contract 測試。
 * env 一律以參數注入；測試不讀、不改、不 stub 全域環境變數物件。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  allowsExternalEffects,
  decideExternalEffects,
  parseAppEnv,
  parseExternalEffectsMode,
  type ExternalEffectsDecision,
} from '@/lib/external-effects';

const SENSITIVE_PROBE = 'super-secret-value-should-never-echo';

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
    return out;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectStrings(item, out);
    }
  }
  return out;
}

function assertNoSensitiveEcho(decision: ExternalEffectsDecision) {
  const strings = collectStrings(decision);
  for (const s of strings) {
    assert.equal(
      s.includes(SENSITIVE_PROBE),
      false,
      'decision must not echo arbitrary sensitive input',
    );
  }
}

describe('parseAppEnv', () => {
  it('denies missing APP_ENV', () => {
    assert.deepEqual(parseAppEnv(undefined), {
      ok: false,
      reason: 'missing_app_env',
    });
    assert.deepEqual(parseAppEnv(''), {
      ok: false,
      reason: 'missing_app_env',
    });
    assert.deepEqual(parseAppEnv('   '), {
      ok: false,
      reason: 'missing_app_env',
    });
  });

  it('denies invalid APP_ENV', () => {
    assert.deepEqual(parseAppEnv('prod'), {
      ok: false,
      reason: 'invalid_app_env',
    });
    assert.deepEqual(parseAppEnv('development'), {
      ok: false,
      reason: 'invalid_app_env',
    });
    assert.deepEqual(parseAppEnv(SENSITIVE_PROBE), {
      ok: false,
      reason: 'invalid_app_env',
    });
  });

  it('accepts the four legal APP_ENV values', () => {
    for (const value of ['production', 'preview', 'local', 'test'] as const) {
      assert.deepEqual(parseAppEnv(value), { ok: true, value });
      assert.deepEqual(parseAppEnv(`  ${value}  `), { ok: true, value });
    }
  });
});

describe('parseExternalEffectsMode', () => {
  it('denies missing mode', () => {
    assert.deepEqual(parseExternalEffectsMode(undefined), {
      ok: false,
      reason: 'missing_mode',
    });
    assert.deepEqual(parseExternalEffectsMode(''), {
      ok: false,
      reason: 'missing_mode',
    });
  });

  it('denies invalid mode', () => {
    assert.deepEqual(parseExternalEffectsMode('on'), {
      ok: false,
      reason: 'invalid_mode',
    });
    assert.deepEqual(parseExternalEffectsMode(SENSITIVE_PROBE), {
      ok: false,
      reason: 'invalid_mode',
    });
  });

  it('accepts enabled and disabled', () => {
    assert.deepEqual(parseExternalEffectsMode('enabled'), {
      ok: true,
      value: 'enabled',
    });
    assert.deepEqual(parseExternalEffectsMode('disabled'), {
      ok: true,
      value: 'disabled',
    });
  });
});

describe('decideExternalEffects / allowsExternalEffects', () => {
  it('denies when APP_ENV missing', () => {
    const decision = decideExternalEffects({
      EXTERNAL_EFFECTS_MODE: 'enabled',
    });
    assert.deepEqual(decision, {
      allowed: false,
      reason: 'missing_app_env',
    });
    assert.equal(allowsExternalEffects({ EXTERNAL_EFFECTS_MODE: 'enabled' }), false);
  });

  it('denies when APP_ENV invalid', () => {
    const decision = decideExternalEffects({
      APP_ENV: 'staging',
      EXTERNAL_EFFECTS_MODE: 'enabled',
    });
    assert.deepEqual(decision, {
      allowed: false,
      reason: 'invalid_app_env',
    });
  });

  it('denies when mode missing', () => {
    const decision = decideExternalEffects({ APP_ENV: 'preview' });
    assert.deepEqual(decision, {
      allowed: false,
      reason: 'missing_mode',
    });
  });

  it('denies when mode invalid', () => {
    const decision = decideExternalEffects({
      APP_ENV: 'preview',
      EXTERNAL_EFFECTS_MODE: 'maybe',
    });
    assert.deepEqual(decision, {
      allowed: false,
      reason: 'invalid_mode',
    });
  });

  it('denies when mode is disabled', () => {
    for (const appEnv of ['production', 'preview', 'local', 'test'] as const) {
      const decision = decideExternalEffects({
        APP_ENV: appEnv,
        EXTERNAL_EFFECTS_MODE: 'disabled',
      });
      assert.deepEqual(decision, {
        allowed: false,
        reason: 'mode_disabled',
      });
      assert.equal(
        allowsExternalEffects({
          APP_ENV: appEnv,
          EXTERNAL_EFFECTS_MODE: 'disabled',
        }),
        false,
      );
    }
  });

  it('denies preview/local/test even when mode=enabled', () => {
    for (const appEnv of ['preview', 'local', 'test'] as const) {
      const decision = decideExternalEffects({
        APP_ENV: appEnv,
        EXTERNAL_EFFECTS_MODE: 'enabled',
      });
      assert.deepEqual(decision, {
        allowed: false,
        reason: 'non_production_effects_disabled',
      });
      assert.equal(
        allowsExternalEffects({
          APP_ENV: appEnv,
          EXTERNAL_EFFECTS_MODE: 'enabled',
        }),
        false,
      );
      assert.equal(
        JSON.stringify(decision).includes(appEnv),
        false,
        'non-production deny must not echo APP_ENV value',
      );
    }
  });

  it('allows only when APP_ENV=production and mode=enabled', () => {
    const decision = decideExternalEffects({
      APP_ENV: 'production',
      EXTERNAL_EFFECTS_MODE: 'enabled',
    });
    assert.deepEqual(decision, {
      allowed: true,
      appEnv: 'production',
      mode: 'enabled',
    });
    assert.equal(
      allowsExternalEffects({
        APP_ENV: 'production',
        EXTERNAL_EFFECTS_MODE: 'enabled',
      }),
      true,
    );
  });

  it('never echoes arbitrary sensitive strings in result/reason', () => {
    const cases = [
      decideExternalEffects({
        APP_ENV: SENSITIVE_PROBE,
        EXTERNAL_EFFECTS_MODE: 'enabled',
      }),
      decideExternalEffects({
        APP_ENV: 'preview',
        EXTERNAL_EFFECTS_MODE: SENSITIVE_PROBE,
      }),
      decideExternalEffects({
        APP_ENV: SENSITIVE_PROBE,
        EXTERNAL_EFFECTS_MODE: SENSITIVE_PROBE,
      }),
      decideExternalEffects({
        APP_ENV: 'local',
        EXTERNAL_EFFECTS_MODE: 'disabled',
      }),
      decideExternalEffects({
        APP_ENV: 'preview',
        EXTERNAL_EFFECTS_MODE: 'enabled',
      }),
      decideExternalEffects({
        APP_ENV: 'production',
        EXTERNAL_EFFECTS_MODE: 'enabled',
      }),
    ];
    for (const decision of cases) {
      assertNoSensitiveEcho(decision);
      assert.equal(
        JSON.stringify(decision).includes(SENSITIVE_PROBE),
        false,
      );
    }
  });

  it('requires an explicit EnvInput object (no default env source)', () => {
    // Parameters with defaults are excluded from Function#length.
    // length === 1 means the EnvInput argument is required (no default).
    assert.equal(decideExternalEffects.length, 1);
    assert.equal(allowsExternalEffects.length, 1);

    // Calling without an explicit input must not silently fall back to any
    // ambient env object; it must fail when reading the missing argument.
    assert.throws(
      () => (decideExternalEffects as (env?: unknown) => unknown)(),
      (err: unknown) => err instanceof TypeError,
    );
    assert.throws(
      () => (allowsExternalEffects as (env?: unknown) => unknown)(),
      (err: unknown) => err instanceof TypeError,
    );
  });

  it('decisions depend only on the explicit input object', () => {
    const missingModeInput = { APP_ENV: 'production' as const };
    const nonProdEnabledInput = {
      APP_ENV: 'preview' as const,
      EXTERNAL_EFFECTS_MODE: 'enabled' as const,
    };
    const productionEnabledInput = {
      APP_ENV: 'production' as const,
      EXTERNAL_EFFECTS_MODE: 'enabled' as const,
    };

    const missingMode = decideExternalEffects(missingModeInput);
    const nonProdDenied = decideExternalEffects(nonProdEnabledInput);
    const productionAllowed = decideExternalEffects(productionEnabledInput);

    assert.deepEqual(missingMode, {
      allowed: false,
      reason: 'missing_mode',
    });
    assert.deepEqual(nonProdDenied, {
      allowed: false,
      reason: 'non_production_effects_disabled',
    });
    assert.deepEqual(productionAllowed, {
      allowed: true,
      appEnv: 'production',
      mode: 'enabled',
    });
    assert.notDeepEqual(nonProdDenied, productionAllowed);

    // Re-running with the same explicit objects stays stable (no ambient coupling).
    assert.deepEqual(decideExternalEffects(missingModeInput), missingMode);
    assert.deepEqual(decideExternalEffects(nonProdEnabledInput), nonProdDenied);
    assert.deepEqual(
      decideExternalEffects(productionEnabledInput),
      productionAllowed,
    );
  });
});
