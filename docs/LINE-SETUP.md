# LINE Messaging API 設定說明

實際 **Channel secret**、**Channel access token**、**Channel ID**、**LIFF ID** 請只放在：

- 本機：專案根目錄 `.env`（已 gitignore）
- 上線：Vercel → Project → Settings → Environment Variables

## 環境變數名稱

| 變數 | 說明 |
|------|------|
| `LINE_CHANNEL_SECRET` | Basic settings → Channel secret |
| `LINE_CHANNEL_ACCESS_TOKEN` | Messaging API → Channel access token（長期） |
| `LINE_CHANNEL_ID` | **LINE Login 頻道** Basic settings → Channel ID（驗證 LIFF ID Token；不是 Messaging API Bot） |
| `LINE_LIFF_ID` | 單一 LIFF 時可共用（選填） |
| `LINE_LIFF_ID_REGISTER` | 加入會員頁 LIFF ID |
| `LINE_LIFF_ID_PROFILE` | 會員資料與存罐紀錄 LIFF ID |
| `LINE_LIFF_ID_REWARDS` | 兌換獎勵 LIFF ID |

## Webhook URL

```
https://你的-vercel-網域/api/line/webhook
```

本機測試（ngrok）：

```
https://xxxx.ngrok-free.app/api/line/webhook
```

## 驗證是否讀到設定

```
GET /api/line/webhook
```

回傳 `"configured": true` 表示 runtime 已讀到 Channel secret / token（改 env 後需 Redeploy）。

## LIFF 建立步驟（LINE Developers）

建議建立 **3 個 LIFF**（Compact 或 Full 皆可），Endpoint URL 指到正式網域：

| 用途 | Endpoint URL |
|------|----------------|
| 加入會員 | `https://你的網域/liff/register` |
| 會員資料與存罐紀錄 | `https://你的網域/liff/profile` |
| 兌換獎勵 | `https://你的網域/liff/rewards` |

Scope：`profile`（需取得 ID Token）。  
將各 LIFF 的 App ID 填入對應的 `LINE_LIFF_ID_*` 環境變數。

## 對話框內按鈕（Flex + 多步驟對話，已內建）

主選單固定三顆按鈕（**不跳轉 LIFF**）：

| 按鈕 | 行為 |
|------|------|
| **加入會員** | 在對話裡依序：輸入稱呼 → 點選毛孩種類 → 名字／手機 → 確認送出 → 寫入 DB |
| **金庫** | 回覆點數與累積罐數 |
| **兌換** | 氣泡內列出獎勵，點「兌換 1」等按鈕 |

LINE **無法**在氣泡內嵌 HTML 輸入框；「填表單」= 對話引導 + 氣泡內**選項按鈕** + 打字輸入。  
LIFF 頁面仍保留作備援（選用 env）。

資料庫需有 `LineChatSession` 表（migration `20260530120000_line_chat_session`）。

## Rich Menu（選用，非必要）

| 按鈕文字 | 動作 | 目標 |
|----------|------|------|
| 加入會員（註冊） | URI | `https://liff.line.me/{LINE_LIFF_ID_REGISTER}` |
| 會員資料與存罐紀錄 | URI | `https://liff.line.me/{LINE_LIFF_ID_PROFILE}` |
| 兌換獎勵 | URI | `https://liff.line.me/{LINE_LIFF_ID_REWARDS}` |

文字備援（使用者仍可打字）：

| 訊息 | 行為 |
|------|------|
| `如何綁定` / `開戶存罐罐` | 引導開戶（LIFF 為主） |
| 8 位數字 | 存罐入帳 |
| `會員資料` / `點數` | 罐罐點數 + 累積罐數 |
| `獎勵` / `兌換 1` | 獎勵清單 / 兌換 |
| `存罐攻略` / `說明` | 完整說明 |

## API（LIFF 後端）

| 路徑 | 說明 |
|------|------|
| `POST /api/line/liff/register` | 註冊／更新會員（body 含 `idToken`） |
| `POST /api/line/liff/me` | 會員儀表板 + 獎勵清單 |
| `POST /api/line/liff/redeem` | 兌換獎勵（`rewardIndex` 為清單編號 1、2…） |

## 匠寵正式環境（2026-05 參考）

**LINE Login 頻道** Channel ID：`2009953429`

| 用途 | LIFF ID | Rich Menu URI |
|------|---------|---------------|
| 加入會員 | `2009953429-1mrFjT2V` | https://liff.line.me/2009953429-1mrFjT2V |
| 會員資料與存罐紀錄 | `2009953429-xnxlaC87` | https://liff.line.me/2009953429-xnxlaC87 |
| 兌換獎勵 | `2009953429-8UJ2ZY5L` | https://liff.line.me/2009953429-8UJ2ZY5L |

Endpoint（建 LIFF 時填）：

- `https://furmosa-db.vercel.app/liff/register`
- `https://furmosa-db.vercel.app/liff/profile`
- `https://furmosa-db.vercel.app/liff/rewards`

Vercel 請設定上表四個變數（`LINE_CHANNEL_ID` + 三個 `LINE_LIFF_ID_*`），**Messaging API** 的 `LINE_CHANNEL_SECRET` / `LINE_CHANNEL_ACCESS_TOKEN` 維持匠寵 Bot 那組。改 env 後 **Redeploy**。

## 安全提醒

勿將 token 提交 Git。若曾外洩，請至 LINE Developers 重新發行 Channel access token。
