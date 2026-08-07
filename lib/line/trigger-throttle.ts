import { isMenuOnCooldown } from '@/lib/line/menu-throttle';
import { prisma } from '@/lib/prisma';

/** 可節流的觸發型回覆（24 小時內同類型只回一次） */
export type LineTriggerKey =
  | 'welcome'
  | 'help'
  | 'bind_help'
  | 'unboxing'
  | 'activity'
  | 'contact'
  | 'menu_fallback'
  | 'recovery';

/**
 * 被動觸發：不主動回覆的 kind。
 * greeting／unknown 改走節流 recovery 卡，不再靜默。
 */
export const PASSIVE_AUTO_REPLY_KINDS = new Set<string>([]);

export function isPassiveAutoReply(kind: string): boolean {
  return PASSIVE_AUTO_REPLY_KINDS.has(kind);
}

type TriggerReplyMap = Partial<Record<LineTriggerKey, string>>;

function parseTriggerMap(raw: unknown): TriggerReplyMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as TriggerReplyMap;
}

async function readTriggerMap(lineUserId: string): Promise<TriggerReplyMap> {
  const state = await prisma.lineMenuState.findUnique({ where: { lineUserId } });
  return parseTriggerMap(state?.triggerReplyAt);
}

/**
 * 此觸發類型是否仍可回覆（未在 24 小時冷卻內）。
 */
export async function shouldSendTriggerReply(
  lineUserId: string,
  trigger: LineTriggerKey,
  now: Date = new Date(),
): Promise<boolean> {
  if (!lineUserId) return true;
  try {
    const map = await readTriggerMap(lineUserId);
    const last = map[trigger];
    if (!last) return true;
    const lastAt = new Date(last);
    if (Number.isNaN(lastAt.getTime())) return true;
    return !isMenuOnCooldown(lastAt, now);
  } catch {
    return true;
  }
}

export async function recordTriggerReply(
  lineUserId: string,
  trigger: LineTriggerKey,
  now: Date = new Date(),
): Promise<void> {
  if (!lineUserId) return;
  try {
    const map = { ...(await readTriggerMap(lineUserId)), [trigger]: now.toISOString() };
    await prisma.lineMenuState.upsert({
      where: { lineUserId },
      create: {
        lineUserId,
        lastMenuSentAt: new Date(0),
        triggerReplyAt: map,
      },
      update: { triggerReplyAt: map },
    });
  } catch {
    // 節流失敗不阻擋回覆
  }
}

/**
 * 觸發型回覆：冷卻中則略過；成功送出後記錄時間戳。
 */
export async function replyTriggerOnce(
  lineUserId: string,
  trigger: LineTriggerKey,
  reply: () => Promise<void>,
): Promise<boolean> {
  if (!(await shouldSendTriggerReply(lineUserId, trigger))) return false;
  await reply();
  await recordTriggerReply(lineUserId, trigger);
  return true;
}
