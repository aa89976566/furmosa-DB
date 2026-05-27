import { CUSTOMER_ID_EXAMPLE } from '@/lib/customers/customer-id';

export const LINE_WELCOME_TEXT = `歡迎來到匠寵罐罐存款 🐾

把空罐序號傳上來，幫毛孩記帳、累積罐罐點數。
第一次來？先「開戶存罐罐」對好檔案就好（不是辦會員喔）。

• 8 位序號 → 存罐入帳
• 小金庫 → 看累積幾罐、多少點
• 獎勵 → 點數能換什麼
• 存罐攻略 → 完整說明`;

export const LINE_BIND_HELP_TEXT = `【開戶存罐罐｜大概 30 秒】

開戶不是辦會員 😮‍💨
只是把「這個 LINE」跟「您家毛孩的檔案」對起來，
之後空罐序號的罐罐點數才會記對人。

請傳其中一種：
・綁定 ${CUSTOMER_ID_EXAMPLE}
・綁定 0912345678

沒有會費，也不會狂發廣告。
對好之後 → 直接傳 8 位序號就會入帳。`;

export const LINE_HELP_TEXT = `【匠寵罐罐存款｜指令】

🔹 第一次（開戶）
綁定 ${CUSTOMER_ID_EXAMPLE}
或：綁定 0912345678
也可傳：如何綁定

🔹 存空罐
直接傳 8 位序號（例：35085664）

🔹 查小金庫（點數 + 累積幾罐）
小金庫

🔹 快速查點數
點數

🔹 看兌換項目
獎勵

🔹 兌換獎勵（依清單上的編號）
兌換 1、兌換 2…

🔹 完整攻略
存罐攻略 或 說明`;

export function lineBindRequiredText() {
  return `序號收到了，但還不知道是哪位毛孩的罐罐 🤔

先「開戶存罐罐」對好檔案，就能開始記帳：

${LINE_BIND_HELP_TEXT}`;
}

export function lineUnknownText() {
  return `小管家沒看懂這句，您可以試：

• 如何綁定（開戶）
• 小金庫（看累積幾罐）
• 存罐攻略

${LINE_HELP_TEXT}`;
}

/** Rich Menu A 建議按鈕對應的 Message 文字 */
export const LINE_RICH_MENU_A = {
  openAccount: '如何綁定',
  guide: '存罐攻略',
  support: '說明',
} as const;
