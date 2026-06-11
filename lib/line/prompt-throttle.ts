import { prisma } from '@/lib/prisma';
import { isMenuOnCooldown, MENU_COOLDOWN_MS } from '@/lib/line/menu-throttle';

export { MENU_COOLDOWN_MS as PROMPT_COOLDOWN_MS };
export { isMenuOnCooldown as isPromptOnCooldown };

export type OnboardingPromptFlags = {
  showRegister: boolean;
  showJar: boolean;
};

export type OnboardingPromptMarks = {
  register?: boolean;
  jar?: boolean;
};

/**
 * 讀取開戶／存罐提示是否仍應顯示（距上次提示未滿 24 小時則不顯示）。
 */
export async function getOnboardingPromptFlags(
  lineUserId: string,
  now: Date = new Date(),
): Promise<OnboardingPromptFlags> {
  if (!lineUserId) return { showRegister: true, showJar: true };
  try {
    const state = await prisma.lineMenuState.findUnique({ where: { lineUserId } });
    return {
      showRegister: !isMenuOnCooldown(state?.lastRegisterPromptAt, now),
      showJar: !isMenuOnCooldown(state?.lastJarPromptAt, now),
    };
  } catch {
    return { showRegister: true, showJar: true };
  }
}

/**
 * 記錄本次已對用戶顯示的開戶／存罐提示，啟動 24 小時冷卻。
 */
export async function recordOnboardingPrompts(
  lineUserId: string,
  which: OnboardingPromptMarks,
  now: Date = new Date(),
): Promise<void> {
  if (!lineUserId) return;
  if (!which.register && !which.jar) return;
  try {
    await prisma.lineMenuState.upsert({
      where: { lineUserId },
      create: {
        lineUserId,
        lastMenuSentAt: new Date(0),
        ...(which.register ? { lastRegisterPromptAt: now } : {}),
        ...(which.jar ? { lastJarPromptAt: now } : {}),
      },
      update: {
        ...(which.register ? { lastRegisterPromptAt: now } : {}),
        ...(which.jar ? { lastJarPromptAt: now } : {}),
      },
    });
  } catch {
    // 節流失敗不應阻擋回覆
  }
}

/** 合併「內文已顯示」與「選單泡泡已顯示」的提示紀錄 */
export function mergePromptMarks(
  bodyMarks?: OnboardingPromptMarks,
  menuMarks?: OnboardingPromptMarks,
): OnboardingPromptMarks {
  return {
    register: Boolean(bodyMarks?.register || menuMarks?.register),
    jar: Boolean(bodyMarks?.jar || menuMarks?.jar),
  };
}
