# LINE Messaging API 設定說明

實際 **Channel secret** 與 **Channel access token** 請只放在：

- 本機：專案根目錄 `.env`（已 gitignore）
- 上線：Vercel → Project → Settings → Environment Variables

## 環境變數名稱

| 變數 | 說明 |
|------|------|
| `LINE_CHANNEL_SECRET` | Basic settings → Channel secret |
| `LINE_CHANNEL_ACCESS_TOKEN` | Messaging API → Channel access token（長期） |

## Webhook URL

```
https://你的-vercel-網域/api/line/webhook
```

本機測試（ngrok）：

```
https://xxxx.ngrok-free.app/api/line/webhook
```

## 驗證是否讀到設定

瀏覽器或 curl：

```
GET /api/line/webhook
```

回傳 `"configured": true` 表示本機 `.env` 已生效（需重啟 `npm run dev`）。

## Bot 指令（使用者）

| 訊息 | 行為 |
|------|------|
| `開戶存罐罐` / `如何綁定` | 開戶教學（對檔案，非辦會員） |
| 8 位數字 | 存罐入帳 |
| `小金庫` | 罐罐點數 + **累積已換幾罐** + 環保一句 |
| `點數` | 快速查餘額與罐數 |
| `獎勵` | 列出可兌換獎勵 |
| `兌換 1` | 用點數兌換獎勵 |
| `存罐攻略` / `說明` | 完整指令 |

## Rich Menu A（建議）

| 按鈕 | Message 文字 |
|------|----------------|
| 🏦 開戶存罐罐 | `如何綁定` |
| 📖 存罐攻略 | `存罐攻略` |
| 💬 問一下 | 官網或 `說明` |

## 安全提醒

勿將 token 提交 Git。若曾外洩，請至 LINE Developers 重新發行 Channel access token。
