import { LINE_BTN, LINE_MENU_HINT_GUEST } from '@/lib/line/line-copy';
import type { OnboardingPromptFlags } from '@/lib/line/prompt-throttle';

export const LINE_WELCOME_TEXT = `歡迎來到匠寵罐罐存款 🐾

把空罐序號傳上來，幫毛孩記帳、累積罐罐點數。
第一次請點下方「${LINE_BTN.register}」，在對話裡依序填寫即可。`;

/** 依節流狀態組裝訪客歡迎詞（開戶／存罐提示各最多 24 小時一次） */
export function buildGuestWelcomeText(flags: OnboardingPromptFlags): string {
  const lines = ['歡迎來到匠寵罐罐存款 🐾', ''];
  if (flags.showJar) {
    lines.push('把空罐序號傳上來，幫毛孩記帳、累積罐罐點數。');
  }
  if (flags.showRegister) {
    lines.push(`第一次請點下方「${LINE_BTN.register}」，在對話裡依序填寫即可。`);
  }
  if (!flags.showJar && !flags.showRegister) {
    lines.push('點下方按鈕即可操作。');
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
請點「${LINE_BTN.register}」，依對話提示填寫。

備援：可傳 綁定 0912345678`;

export const LINE_HELP_TEXT = `【匠寵罐罐存款】

• ${LINE_BTN.register} → 填稱呼、毛孩、年齡或生日
• ${LINE_BTN.vault} → 看點數與累積罐數
• ${LINE_BTN.redeem} → 選獎勵兌換
• 存罐 → 直接傳 8 位序號`;

export function lineBindRequiredText() {
  return `序號收到了，但還不知道是哪位毛孩的罐罐 🤔\n請先點「${LINE_BTN.register}」完成開戶。`;
}

export function lineUnknownText(showJarHint = true) {
  if (!showJarHint) {
    return '小管家沒看懂這句～\n請點下方按鈕。';
  }
  return `小管家沒看懂這句～\n請點下方按鈕，或傳 8 位序號存罐。`;
}

export { LINE_MENU_HINT_GUEST };
