import { LINE_BTN, LINE_MENU_HINT_GUEST } from '@/lib/line/line-copy';
import type { OnboardingPromptFlags } from '@/lib/line/prompt-throttle';

export const LINE_WELCOME_TEXT = `歡迎來到匠寵 🐾

這裡比較像一本小手帳，不太像客服機器人。

三個入口：
♻️ 換罐計畫
🔥 一起搞事
🌿 野放中

第一次先去「換罐計畫」幫毛孩開戶。`;

/** 依節流狀態組裝訪客歡迎詞 */
export function buildGuestWelcomeText(flags: OnboardingPromptFlags): string {
  const lines = ['歡迎來到匠寵 🐾', ''];
  if (flags.showJar) {
    lines.push('空罐罐底 8 碼傳上來，會進毛孩罐庫。');
  }
  if (flags.showRegister) {
    lines.push(`第一次先點「${LINE_BTN.hubJar}」→「${LINE_BTN.register}」。`);
  }
  if (!flags.showJar && !flags.showRegister) {
    lines.push('下面三個入口，想逛哪個點哪個。');
  }
  return lines.join('\n');
}

export function guestWelcomePromptMarks(flags: OnboardingPromptFlags): {
  register?: boolean;
  jar?: boolean;
} {
  return {
    register: flags.showRegister || undefined,
    jar: flags.showJar || undefined,
  };
}

export const LINE_BIND_HELP_TEXT = `開戶 = 把這個 LINE 跟毛孩檔案對起來。
請點「${LINE_BTN.register}」，依提示填就好。

備援：可傳 綁定 0912345678`;

export const LINE_HELP_TEXT = `【匠寵怎麼玩】

• ${LINE_BTN.hubJar} → 換罐、開戶、序號、罐庫
• ${LINE_BTN.hubChaos} → 正在搞的事（嗷嗚、清蛙…）
• ${LINE_BTN.hubWild} → 官網與社群
• 存罐 → 直接傳 8 位序號（要先開戶）`;

export function lineBindRequiredText() {
  return `序號收到了，可是還不知道是哪位毛孩的罐 🤔\n先點「${LINE_BTN.register}」開個戶。`;
}

export function lineUnknownText(showJarHint = true) {
  if (!showJarHint) {
    return '這句我們沒接住～\n點下面入口再試一次。';
  }
  return `這句我們沒接住～\n點入口，或傳 8 位序號存罐。`;
}

export { LINE_MENU_HINT_GUEST };
