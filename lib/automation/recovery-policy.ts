export const AUTOMATION_PRIMARY_ATTEMPTS = 2;
export const AUTOMATION_RETRY_DELAY_MS = 30_000;

export type RecoveryDecision =
  | { action: 'complete' }
  | { action: 'retry'; nextAttemptAt: Date }
  | { action: 'fallback' };

/**
 * 第一次失敗排定重試；第二次失敗立即進入安全替代方案。
 * attempts 是「包含本次」的失敗次數。
 */
export function decideRecovery(
  attempts: number,
  succeeded: boolean,
  now = new Date(),
): RecoveryDecision {
  if (succeeded) return { action: 'complete' };
  if (attempts < AUTOMATION_PRIMARY_ATTEMPTS) {
    return {
      action: 'retry',
      nextAttemptAt: new Date(now.getTime() + AUTOMATION_RETRY_DELAY_MS),
    };
  }
  return { action: 'fallback' };
}

export function normalizeAutomationError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error || '未知錯誤');
  return text.replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]').slice(0, 500);
}
