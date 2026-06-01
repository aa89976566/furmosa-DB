import { prisma } from '@/lib/prisma';

// 主選單冷卻時間：24 小時內不重複發送主選單給同一位用戶
export const MENU_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * 純函式：判斷距離上次發送是否仍在冷卻時間內。
 * 上次時間不存在（從未發過）→ 不在冷卻內。
 */
export function isMenuOnCooldown(
  lastMenuSentAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!lastMenuSentAt) return false;
  return now.getTime() - lastMenuSentAt.getTime() < MENU_COOLDOWN_MS;
}

/**
 * 判斷現在是否該對此 LINE 用戶發送主選單。
 *
 * - 從未發過、或距離上次已超過冷卻時間 → 回傳 true，並把時間戳更新為「現在」。
 * - 24 小時內已發過 → 回傳 false（呼叫端應略過選單，只回必要文字）。
 *
 * 任何錯誤都保底回傳 true，避免用戶看不到選單而卡住。
 */
export async function shouldSendMenu(
  lineUserId: string,
  now: Date = new Date(),
): Promise<boolean> {
  if (!lineUserId) return true;
  try {
    const state = await prisma.lineMenuState.findUnique({ where: { lineUserId } });
    if (isMenuOnCooldown(state?.lastMenuSentAt, now)) {
      return false;
    }
    await prisma.lineMenuState.upsert({
      where: { lineUserId },
      create: { lineUserId, lastMenuSentAt: now },
      update: { lastMenuSentAt: now },
    });
    return true;
  } catch {
    return true;
  }
}
