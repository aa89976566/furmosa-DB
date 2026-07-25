# LINE Messaging API 設定說明

## 資訊架構（跟著傑克過一天）

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

外面比較好玩。社區／UGC／活動：

- 嗷嗚計劃
- 活動
- 開箱任務
- 限定合作
- 優惠企劃

### ② 預約美容

Coming soon——禁止「建設中」。用好玩的占位，例如：

- 洗澡水還沒放滿。
- 美容師快到了。
- 還在吹毛。

### ③ 換罐計劃

瓶子才是主角。六張卡（未開戶／已開戶都會看到；序號／會員未開戶會擋去開戶）：

1. 開戶  
2. 我的會員  
3. 輸入序號  
4. 我的換罐紀錄  
5. 合作美容店  
6. 換罐說明  

### ④ 回家

不是首頁，是家。

- https://www.furmosa.com  
- Instagram @furmosa_food  

### 部署 Rich Menu

```bash
LINE_CHANNEL_ACCESS_TOKEN=你的token npx tsx scripts/deploy-line-rich-menu.ts
```

請設定 `NEXT_PUBLIC_APP_URL`（正式網域），Flex 才能載入卡片插畫。

---

## 換罐計劃 Flex

**未開戶**：開戶為主 CTA；點序號／會員 → 開戶閘門。  
**已開戶**：輸入序號為主 CTA。

### 輸入序號（未開戶）

> 先開戶。  
> 沒戶頭，罐進不來。

＋唯一按鈕【立刻開戶】  
開戶完成後**自動回到輸入序號提示**。

---

## 環境變數

| 變數 | 說明 |
|------|------|
| `LINE_CHANNEL_SECRET` | Channel secret |
| `LINE_CHANNEL_ACCESS_TOKEN` | Channel access token（長期） |
| `NEXT_PUBLIC_APP_URL` | 正式網域（Flex 圖片） |
| `LINE_BRAND_WEBSITE_URL` | 預設 `https://www.furmosa.com` |
| `LINE_BRAND_INSTAGRAM_URL` | 預設 `https://www.instagram.com/furmosa_food/` |
