# LINE Messaging API 設定說明

## 資訊架構（一定要對）

底部 **Rich Menu 是三張直向大卡**，不是六宮格 icon 功能列。

```
┌──────────────────────────────┐
│ ♻️ 換罐計畫 · 一罐一罐累積。   │
├──────────────────────────────┤
│ 🔥 一起搞事 · 最近又有新鮮事。 │
├──────────────────────────────┤
│ 🌿 野放中 · 看看匠寵跑去哪。   │
└──────────────────────────────┘
         ↓ 各開卡片式 Flex carousel
```

視覺語言：白底留白、手繪插畫 hero、整卡可點（一個 CTA），不用灰底按鈕列。

| 世界 | 只放什麼 | 禁止出現 |
|------|----------|----------|
| 換罐計畫 | 會員制度（開戶／序號／罐庫） | UGC、開箱活動、社群導購 |
| 一起搞事 | 品牌活動 | 點數、序號、開戶 |
| 野放中 | 官網／社群／店家／故事 | 兌換、序號 |

若聊天室底部仍是「訂閱爆罐／領福利／產品導購」六宮格，代表 **OA Manager 的 Rich Menu 還沒換掉**，不是 webhook 文案問題。

### 部署三格 Rich Menu

圖檔：`public/line/rich-menu-three-worlds.png`（2500×1686，三列大卡）  
卡片插畫：`public/line/cards/*.png`（可用 `python3 scripts/generate-line-art.py` 重畫）

```bash
LINE_CHANNEL_ACCESS_TOKEN=你的token npx tsx scripts/deploy-line-rich-menu.ts
```

三列動作皆為傳訊息：`換罐計畫`／`一起搞事`／`野放中` → webhook 回卡片 carousel。

請設定 `NEXT_PUBLIC_APP_URL`（正式網域），Flex 才能載入卡片插畫。

---

## 換罐計畫 Flex（依是否開戶變形）

**未開戶**

1. 什麼是換罐 ⭐  
2. 幫毛孩開戶（主按鈕）  
3. 合作店家  
4. 常見問題  

**已開戶**

1. 輸入序號（主按鈕）  
2. 毛孩罐庫  
3. 換罐紀錄  
4. 什麼是換罐  

### 輸入序號（未開戶）

只顯示：

> 先幫毛孩開戶  
> 完成後就能開始累積罐罐。

＋唯一按鈕【立即開戶】  
開戶完成後**自動回到輸入序號提示**，不必再按一次。

### 什麼是換罐

介紹 → 流程 → 合作店家 → FAQ（Flex 內點選）

---

## 環境變數

| 變數 | 說明 |
|------|------|
| `LINE_CHANNEL_SECRET` | Channel secret |
| `LINE_CHANNEL_ACCESS_TOKEN` | Channel access token（長期） |
| `LINE_CHANNEL_ID` | LINE Login Channel ID |
| `LINE_LIFF_ID_*` | LIFF（備援） |
| `LINE_BRAND_*_URL` | 野放中外連（選填） |

Webhook：`https://你的網域/api/line/webhook`

---

## 開戶順序（對話）

主人：暱稱 → 手機 → 美容合作店  
毛孩：名字 → 種類 → 品種 → 生日（選填）  
→ 確認完成

新活動只加 `lib/line/brand-worlds.ts` 的 `CHAOS_ITEMS`／`CHAOS_COPY`。
