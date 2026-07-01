import type { RegisterDraft } from '@/lib/line/chat-session';
import { REGISTER_SESSION_TTL_MS } from '@/lib/line/chat-session';

/** 同一步驟的驗證提示是否在 24 小時冷卻內 */
export function isRegisterStepPromptOnCooldown(
  draft: RegisterDraft,
  step: string,
  now: Date = new Date(),
): boolean {
  const iso = draft.stepPromptAt?.[step];
  if (!iso) return false;
  const last = new Date(iso);
  if (Number.isNaN(last.getTime())) return false;
  return now.getTime() - last.getTime() < REGISTER_SESSION_TTL_MS;
}

export function markRegisterStepPrompt(
  draft: RegisterDraft,
  step: string,
  now: Date = new Date(),
): RegisterDraft {
  return {
    ...draft,
    stepPromptAt: { ...draft.stepPromptAt, [step]: now.toISOString() },
  };
}
