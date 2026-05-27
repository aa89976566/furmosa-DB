export const LINE_WELCOME_TEXT = `歡迎來到匠寵罐罐存款 🐾

把空罐序號傳上來，幫毛孩記帳、累積罐罐點數。
第一次來？請點圖文選單「加入會員（註冊）」完成開戶（不是辦會員喔）。

• 8 位序號 → 存罐入帳
• 會員資料與存罐紀錄 → 看點數與累積幾罐
• 兌換獎勵 → 用點數換好康
• 存罐攻略 → 完整說明`;

export const LINE_BIND_HELP_TEXT = `【開戶存罐罐】

建議用圖文選單按鈕「加入會員（註冊）」填表，系統會自動綁定這個 LINE，不用記任何編號。

若暫時無法開啟表單，仍可傳：
・綁定 0912345678（手機）

沒有會費，也不會狂發廣告。
開戶後 → 直接傳 8 位序號就會入帳。`;

export const LINE_HELP_TEXT = `【匠寵罐罐存款｜怎麼用】

🔹 第一次（開戶）
點選單「加入會員（註冊）」
或傳：如何綁定

🔹 存空罐
直接傳 8 位序號（例：35085664）

🔹 查紀錄（點數 + 累積幾罐）
點選單「會員資料與存罐紀錄」
或傳：會員資料、點數

🔹 兌換獎勵
點選單「兌換獎勵」
或傳：獎勵、兌換 1、兌換 2…

🔹 完整攻略
存罐攻略 或 說明`;

export function lineBindRequiredText() {
  return `序號收到了，但還不知道是哪位毛孩的罐罐 🤔

請先點圖文選單「加入會員（註冊）」完成開戶，之後序號就會記對人。

${LINE_BIND_HELP_TEXT}`;
}

export function lineUnknownText() {
  return `小管家沒看懂這句，您可以試：

• 點選單「加入會員（註冊）」
• 傳 8 位序號存罐
• 存罐攻略

${LINE_HELP_TEXT}`;
}

/** Rich Menu 建議：三顆 LIFF URI 按鈕 + 文字備援 */
export const LINE_RICH_MENU_A = {
  register: '如何綁定',
  profile: '會員資料',
  rewards: '獎勵',
  guide: '存罐攻略',
} as const;
