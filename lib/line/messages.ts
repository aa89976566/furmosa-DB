import { LINE_BTN, LINE_MENU_HINT_GUEST } from '@/lib/line/line-copy';
import type { OnboardingPromptFlags } from '@/lib/line/prompt-throttle';

export const LINE_WELCOME_TEXT = `歡迎來到匠寵 🐾

可以直接從下方選單逛商品、看換罐計畫、查會員點數，或問問匠寵。

第一次使用換罐計畫，先進「換罐計畫」幫毛孩開戶。`;

/** 依節流狀態組裝訪客歡迎詞 */
export function buildGuestWelcomeText(flags: OnboardingPromptFlags): string {
  const lines = ['歡迎來到匠寵 🐾', ''];
  if (flags.showJar) {
    lines.push('空罐罐底 8 碼傳上來，會進毛孩名下。');
  }
  if (flags.showRegister) {
    lines.push(`第一次先點「${LINE_BTN.hubJar}」→「${LINE_BTN.register}」。`);
  }
  if (!flags.showJar && !flags.showRegister) {
    lines.push('從下面選單挑一個入口就可以開始。');
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

• 線上購物 → 逛匠寵零食、玩具與生活選物
• ${LINE_BTN.hubJar} → 首罐、續罐、口味、開戶與序號
• 會員點數 → 查目前點數與存罐紀錄
• 申請合作 → 留下店家資料，由真人接續
• 問問匠寵 → 回到功能說明
• ${LINE_BTN.hubChaos} → 活動、開箱任務與一起野放
• 存罐 → 直接傳罐底 8 位序號（要先開戶）`;

export function lineBindRequiredText() {
  return `序號收到了，可是還不知道是哪位毛孩的罐 🤔\n先點「${LINE_BTN.register}」開個戶。`;
}

export function lineUnknownText(showJarHint = true) {
  if (!showJarHint) {
    return '這句我們沒接住～\n點下面那格再試一次。';
  }
  return `這句我們沒接住～\n點一格入口，或傳 8 位序號存罐。`;
}

export { LINE_MENU_HINT_GUEST };
