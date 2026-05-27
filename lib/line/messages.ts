export const LINE_WELCOME_TEXT = `歡迎來到匠寵罐罐存款 🐾

把空罐序號傳上來，幫毛孩記帳、累積罐罐點數。
第一次來請點下方「加入會員」填表單開戶（不是辦會員喔）。`;

export const LINE_BIND_HELP_TEXT = `開戶 = 把這個 LINE 跟毛孩檔案對起來。
請點下方「加入會員（填表單）」完成。

若無法開啟表單，可改傳：綁定 0912345678`;

export const LINE_HELP_TEXT = `【匠寵罐罐存款】

• 加入會員 → 點下方按鈕填表單
• 存空罐 → 直接傳 8 位序號
• 會員資料 → 點按鈕看點數與罐數
• 兌換獎勵 → 點按鈕選項目

也可打字：點數、獎勵、存罐攻略`;

export function lineBindRequiredText() {
  return `序號收到了，但還不知道是哪位毛孩的罐罐 🤔\n請先點下方「加入會員」填表單開戶。`;
}

export function lineUnknownText() {
  return `小管家沒看懂這句～\n請點下方按鈕，或傳 8 位序號存罐。`;
}

/** 文字備援（Rich Menu 選用） */
export const LINE_RICH_MENU_A = {
  register: '如何綁定',
  profile: '會員資料',
  rewards: '獎勵',
  guide: '存罐攻略',
} as const;
