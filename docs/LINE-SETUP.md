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
| `LINE_BRAND_WEBSITE_URL` | 野放中 → 官網（預設 `https://furmosa.pet`） |
| `LINE_BRAND_INSTAGRAM_URL` | 野放中 → IG |
| `LINE_BRAND_THREADS_URL` | 野放中 → Threads |
| `LINE_BRAND_FACEBOOK_URL` | 野放中 → Facebook |
| `LINE_BRAND_NEWS_URL` | 野放中 → 最新消息 |

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

## 資訊架構（三世界）

底部 **Rich Menu 只放三格**（圖文選單在 LINE Official Account Manager 設定）：

| 格 | 顯示文字 | 建議動作 | Bot 行為 |
|----|----------|----------|----------|
| 1 | ♻️ 換罐計畫 | 傳訊息 `換罐計畫` | 開 Flex：什麼是換罐／幫毛孩開戶／輸入序號／毛孩罐庫 |
| 2 | 🔥 一起搞事 | 傳訊息 `一起搞事` | 開 Flex：嗷嗚、清蛙、本月限定…（可無限加項目） |
| 3 | 🌿 野放中 | 傳訊息 `野放中` | 開 Flex：官網／IG／Threads／FB／最新消息 |

也可改成 postback（Messaging API Rich Menu），data 用：

- `jd=hub_jar`
- `jd=hub_chaos`
- `jd=hub_wild`

### 換罐計畫開戶順序（對話內）

暱稱 → 手機 → 美容合作店 → 毛孩名 → 種類 → 品種 → 生日（選填）→ 確認

未開戶傳 8 碼序號會擋下，並顯示「立即開戶」。

新活動只加 `lib/line/brand-worlds.ts` 的 `CHAOS_ITEMS`／`CHAOS_COPY`，不必改 Rich Menu 三格。

## LIFF（備援）

| 用途 | Endpoint URL |
|------|----------------|
| 加入會員 | `https://你的網域/liff/register` |
| 會員資料與存罐紀錄 | `https://你的網域/liff/profile` |
| 兌換獎勵 | `https://你的網域/liff/rewards` |

Scope：`profile`（需取得 ID Token）。

## API（LIFF 後端）

| 路徑 | 說明 |
|------|------|
| `POST /api/line/liff/register` | 註冊／更新會員（body 含 `idToken`） |
| `POST /api/line/liff/me` | 會員儀表板 + 獎勵清單 |
| `POST /api/line/liff/redeem` | 兌換獎勵（`rewardIndex` 為清單編號 1、2…） |

## 匠寵正式環境（2026-05 參考）

**LINE Login 頻道** Channel ID：`2009953429`

| 用途 | LIFF ID |
|------|---------|
| 加入會員 | `2009953429-1mrFjT2V` |
| 會員資料與存罐紀錄 | `2009953429-xnxlaC87` |
| 兌換獎勵 | `2009953429-8UJ2ZY5L` |

Endpoint：

- `https://furmosa-db.vercel.app/liff/register`
- `https://furmosa-db.vercel.app/liff/profile`
- `https://furmosa-db.vercel.app/liff/rewards`

## 安全提醒

勿將 token 提交 Git。若曾外洩，請至 LINE Developers 重新發行 Channel access token。
