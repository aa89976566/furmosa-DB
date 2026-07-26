import { expandLineMessages } from '@/lib/line/expand-messages';
import { getLineChannelAccessToken, isLineWebhookConfigured } from '@/lib/line/config';
import type { LineReplyMessage } from '@/lib/line/reply';

/** Push 與 Reply 共用訊息型別 */
export type LinePushMessage = LineReplyMessage;

export type PushLineOptions = {
  /** 預設 true：文字換行拆成多則氣泡 */
  expand?: boolean;
};

/**
 * LINE Messaging API Push（主動通知）。
 * 未設定 Channel Token 時回傳 skipped，不丟錯。
 * 超過 5 則時分批送出。
 */
export async function pushLineMessages(
  lineUserId: string,
  messages: LinePushMessage[],
  opts?: PushLineOptions,
): Promise<{ ok: true } | { ok: false; skipped?: boolean; error: string }> {
  const to = lineUserId.trim();
  if (!to.startsWith('U')) {
    return { ok: false, error: 'LINE User ID 格式不正確' };
  }
  if (!isLineWebhookConfigured()) {
    return { ok: false, skipped: true, error: 'LINE Messaging API 未設定' };
  }

  const prepared =
    opts?.expand === false ? messages : expandLineMessages(messages);
  if (prepared.length === 0) return { ok: true };

  try {
    const token = getLineChannelAccessToken();
    for (let i = 0; i < prepared.length; i += 5) {
      const chunk = prepared.slice(i, i + 5);
      const res = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ to, messages: chunk }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        return {
          ok: false,
          error: `LINE Push API 失敗 (${res.status}): ${body.slice(0, 200)}`,
        };
      }
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'LINE Push 失敗',
    };
  }
}

export async function pushLineText(lineUserId: string, text: string) {
  return pushLineMessages(lineUserId, [{ type: 'text', text }]);
}
