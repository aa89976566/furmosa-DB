import { buildMainMenuMessages } from '@/lib/line/flex-menu';
import { shouldSendMenu } from '@/lib/line/menu-throttle';
import { replyLineMessage, type LineReplyMessage } from '@/lib/line/reply';

/**
 * 回覆「文字 +（視情況）主選單」。
 * 若 24 小時內已對此用戶發過主選單，就只回文字，不重複附上選單。
 * `extra` 可放非主選單的額外訊息（例如圖卡），一律會送出。
 */
export async function replyLineTextWithMenu(
  replyToken: string,
  lineUserId: string,
  text: string,
  opts?: { registered?: boolean; extra?: LineReplyMessage[] },
) {
  const messages: LineReplyMessage[] = [{ type: 'text', text }];
  if (opts?.extra?.length) messages.push(...opts.extra);
  if (await shouldSendMenu(lineUserId)) {
    messages.push(...buildMainMenuMessages({ registered: opts?.registered }));
  }
  await replyLineMessage(replyToken, messages);
}

/**
 * 回覆主選單（內文在選單泡泡內）。
 * 若 24 小時內已對此用戶發過主選單，就只回內文純文字，不重複附上選單。
 */
export async function replyMenuHub(
  replyToken: string,
  lineUserId: string,
  opts: { body: string; registered?: boolean },
) {
  if (await shouldSendMenu(lineUserId)) {
    await replyLineMessage(
      replyToken,
      buildMainMenuMessages({ registered: opts.registered, body: opts.body }),
    );
  } else {
    await replyLineMessage(replyToken, [{ type: 'text', text: opts.body }]);
  }
}
