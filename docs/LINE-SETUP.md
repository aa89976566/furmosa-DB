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
| `綁定 CUST-0001` 或 `綁定 0912345678` | 寫入 `Customer.lineUserId` |
| 8 位數字 | 換罐序號兌換 |
| `點數` | 查餘額 |
| `說明` | 使用說明 |

## 安全提醒

勿將 token 提交 Git。若曾外洩，請至 LINE Developers 重新發行 Channel access token。
