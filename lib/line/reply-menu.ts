import { buildMainMenuMessages } from '@/lib/line/flex-menu';
import { shouldSendMenu } from '@/lib/line/menu-throttle';
import {
  getOnboardingPromptFlags,
  mergePromptMarks,
  recordOnboardingPrompts,
  type OnboardingPromptFlags,
  type OnboardingPromptMarks,
} from '@/lib/line/prompt-throttle';
import { replyLineMessage, type LineReplyMessage } from '@/lib/line/reply';

type MenuReplyOpts = {
  registered?: boolean;
  promptFlags?: OnboardingPromptFlags;
  /** 內文已顯示的開戶／存罐提示（送出後寫入節流） */
  bodyPromptMarks?: OnboardingPromptMarks;
  /**
   * 主選單冷卻中是否仍回內文。
   * 功能型回覆（存罐、開戶提示）設 true；純導覽/歡迎設 false 避免洗版。
   */
  alwaysReplyBody?: boolean;
};

function menuPromptMarks(
  registered: boolean | undefined,
  flags: OnboardingPromptFlags,
  menuSent: boolean,
): OnboardingPromptMarks | undefined {
  if (!menuSent) return undefined;
  return {
    register: !registered && flags.showRegister ? true : undefined,
    jar: flags.showJar ? true : undefined,
  };
}

async function recordReplyPrompts(
  lineUserId: string,
  bodyMarks?: OnboardingPromptMarks,
  menuMarks?: OnboardingPromptMarks,
) {
  const merged = mergePromptMarks(bodyMarks, menuMarks);
  await recordOnboardingPrompts(lineUserId, merged);
}

/**
 * 回覆「文字 +（視情況）主選單」。
 * 若 24 小時內已對此用戶發過主選單，就只回文字，不重複附上選單。
 * `extra` 可放非主選單的額外訊息（例如圖卡），一律會送出。
 */
export async function replyLineTextWithMenu(
  replyToken: string,
  lineUserId: string,
  text: string,
  opts?: MenuReplyOpts & { extra?: LineReplyMessage[] },
) {
  const registered = opts?.registered;
  const flags = opts?.promptFlags ?? (await getOnboardingPromptFlags(lineUserId));
  const messages: LineReplyMessage[] = [{ type: 'text', text }];
  if (opts?.extra?.length) messages.push(...opts.extra);

  const menuSent = await shouldSendMenu(lineUserId);
  if (menuSent) {
    messages.push(
      ...buildMainMenuMessages({
        registered,
        showJarHint: flags.showJar,
        showRegisterHint: !registered && flags.showRegister,
      }),
    );
  }

  await replyLineMessage(replyToken, messages);
  await recordReplyPrompts(
    lineUserId,
    opts?.bodyPromptMarks,
    menuPromptMarks(registered, flags, menuSent),
  );
}

/**
 * 回覆主選單（內文在選單泡泡內）。
 * 若 24 小時內已對此用戶發過主選單，就只回內文純文字，不重複附上選單。
 */
export async function replyMenuHub(
  replyToken: string,
  lineUserId: string,
  opts: { body: string; registered?: boolean } & MenuReplyOpts,
) {
  const registered = opts.registered;
  const flags = opts.promptFlags ?? (await getOnboardingPromptFlags(lineUserId));
  const menuSent = await shouldSendMenu(lineUserId);

  if (menuSent) {
    await replyLineMessage(
      replyToken,
      buildMainMenuMessages({
        registered,
        body: opts.body,
        showJarHint: flags.showJar,
        showRegisterHint: !registered && flags.showRegister,
      }),
    );
  } else if (opts.alwaysReplyBody !== false) {
    await replyLineMessage(replyToken, [{ type: 'text', text: opts.body }]);
  } else {
    return;
  }

  await recordReplyPrompts(
    lineUserId,
    opts.bodyPromptMarks,
    menuPromptMarks(registered, flags, menuSent),
  );
}
