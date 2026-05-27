export const LINE_WELCOME_TEXT = `歡迎加入匠寵換罐 LINE 服務 🐾

首次使用請先綁定會員，之後即可：
• 傳 8 位返航序號 → 累積點數
• 傳「點數」→ 查餘額
• 傳「獎勵」→ 查看可兌換項目
• 傳「說明」→ 完整指令`;

export const LINE_BIND_HELP_TEXT = `【如何綁定會員】

請在後台先建立您的會員資料，然後在 LINE 傳以下其中一種：

1️⃣ 用會員編號
綁定 CUST-0001

2️⃣ 用註冊手機
綁定 0912345678

綁定成功後，直接傳 8 位返航序號即可兌換點數。
查詢點數請傳：點數`;

export const LINE_HELP_TEXT = `【匠寵換罐 LINE 指令】

🔹 綁定會員（首次必做）
綁定 CUST-0001
或：綁定 0912345678

🔹 兌換返航序號
直接傳 8 位數字（例：35085664）

🔹 查詢點數
點數

🔹 查看獎勵目錄
獎勵

🔹 兌換獎勵（需已綁定且點數足夠）
兌換 1
或：兌換 JAR-RWD-001

🔹 查綁定狀態
會員

🔹 綁定教學
如何綁定

🔹 本說明
說明`;

export function lineBindRequiredText(lineUserId: string) {
  return `請先綁定會員再使用此功能。

${LINE_BIND_HELP_TEXT}

您的 LINE ID：${lineUserId}`;
}

export function lineUnknownText(lineUserId: string) {
  return `無法辨識的訊息，您可以試試：

• 如何綁定
• 點數
• 說明

${LINE_HELP_TEXT}

您的 LINE ID：${lineUserId}`;
}
