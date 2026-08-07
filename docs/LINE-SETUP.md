# LINE Messaging API 設定說明

## 資訊架構（四格漫畫）

底部 **Rich Menu 是四格漫畫（2×2）**，不是功能儀表板、不是六宮格 icon。

```
┌────────────┬────────────┐
│ 一起野放    │ 預約美容    │  → 社區／UGC｜好玩的還沒好
│ 今天發生…  │ 漂亮一下    │
├────────────┼────────────┤
│ 換罐計劃    │ 回家        │  → 會員制度｜furmosa.com＋IG
│ 空罐別忘記  │ 還有很多故事│
└────────────┴────────────┘
```

語氣：Liquid Death 式——好玩、一點叛逆、冷面幽默、絕不公司、台灣自然口語。  
視覺：手繪漫畫、大插畫、圓角卡片、大量留白；無 app icon、無漸層、無企業 UI。

圖檔：`public/line/rich-menu-comic-2x2.jpg`（由原圖 contain＋白邊縮放至 2500×1686，**不裁切**文字）  
原圖：`public/line/comic-menu-2x2-source.png`  
重建：`python3 scripts/prepare-comic-rich-menu.py`

### ① 一起野放

外面比較好玩。選單是垂直按鈕；**點按鈕後**才丟舊輪播 cover 圖，再以短對話氣泡說明（不塞公告標題）。

- **嗷嗚計劃** → 圖 `chaos-frog.png`＋對話 →「青蛙誰在怕」（網址設 `LINE_FROG_PROJECT_URL`）
- **活動中心** → 圖 `chaos-events.png`＋對話 → 邀請毛爸媽丟下一檔想法（bark 口吻）
- **開箱任務** → 圖 `events/jiba-unbox-cover.png`＋對話選項 → 雞霸開箱狀態機

### ② 預約美容

**線上預約美容尚未開放。** Coming soon——禁止「建設中」。用好玩的占位，例如：

- 洗澡水還沒放滿。
- 美容師快到了。
- 還在吹毛。

換罐付款需合作店家先確認美容預約；請毛爸媽先跟店家約，不要暗示可在 LINE 內直接約。

### ③ 換罐計劃

瓶子才是主角。一級選單（未開戶／已開戶相同；序號／換罐未開戶會擋去聊天開戶）：

1. **我要換罐**（主色；伺服器確認開戶後才給 LIFF「開始換罐」）  
2. **幫毛孩開戶**（主路徑在聊天室；`/liff/register` 僅 refill 備援）  
3. **輸入空罐序號**  
4. **了解更多** → 什麼是換罐計劃？／點數換折價／查看合作店家／毛爸媽常問  

### ④ 回家

不是首頁，是家。

文案：到了。狗屋在裡面，院子也還亮著。

- 🏠 進狗屋（官網）→ https://www.furmosa.com  
- 🌿 去院子（Instagram）→ @furmosa_food  

### 部署 Rich Menu

```bash
LINE_CHANNEL_ACCESS_TOKEN=你的token npx tsx scripts/deploy-line-rich-menu.ts
```

請設定 `NEXT_PUBLIC_APP_URL`（正式網域），Flex 才能載入卡片插畫。

---

## 換罐計劃 Flex

**一級**：我要換罐為主 CTA（不直接掛 URI）。  
**未開戶點換罐／序號**：聊天開戶閘門；換罐完成後回「開始換罐」LIFF 按鈕。  
**已開戶點換罐**：單一「開始換罐」LIFF（未設定則友善說明）。

### 輸入空罐序號（未開戶）

> 麻煩先幫毛孩開個戶喔～  
> 開好戶，罐底序號才能幫你記進去。

＋唯一按鈕【立刻開戶】  
若從序號閘道進來，開戶完成後**自動回到輸入空罐序號提示**。

---

## 環境變數

| 變數 | 說明 |
|------|------|
| `LINE_CHANNEL_SECRET` | Channel secret |
| `LINE_CHANNEL_ACCESS_TOKEN` | Channel access token（長期） |
| `NEXT_PUBLIC_APP_URL` | 正式網域（Flex 圖片） |
| `LINE_BRAND_WEBSITE_URL` | 預設 `https://www.furmosa.com` |
| `LINE_BRAND_INSTAGRAM_URL` | 預設 `https://www.instagram.com/furmosa_food/` |
