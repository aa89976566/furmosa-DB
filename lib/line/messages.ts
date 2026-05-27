export const LINE_WELCOME_TEXT = `歡迎來到匠寵罐罐存款 🐾

把空罐序號傳上來，幫毛孩記帳、累積罐罐點數。
第一次請點下方「加入會員」，在對話裡依序填寫即可。`;

export const LINE_BIND_HELP_TEXT = `開戶 = 把這個 LINE 跟毛孩檔案對起來。
請點「加入會員」，依對話提示填寫。

備援：可傳 綁定 0912345678`;

export const LINE_HELP_TEXT = `【匠寵罐罐存款】

• 加入會員 → 對話裡填稱呼、毛孩、手機
• 金庫 → 看點數與累積罐數
• 兌換 → 選獎勵項目
• 存罐 → 直接傳 8 位序號`;

export function lineBindRequiredText() {
  return `序號收到了，但還不知道是哪位毛孩的罐罐 🤔\n請先點「加入會員」完成開戶。`;
}

export function lineUnknownText() {
  return `小管家沒看懂這句～\n請點下方三個按鈕，或傳 8 位序號存罐。`;
}
