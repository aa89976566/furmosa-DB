# LINE 原生對話購物 v1（凍結 Prompt）

- Base commit: `055f755ee08b8ab733b82f1869f8e9ef99e5c22c`
- Claude review: `https://claude.ai/chat/016608ee-905f-4b3a-aea5-727e917bfecd`
- 目標：把既有 LINE 購物入口改成「文字問題＋Quick Reply＋少量商品輪播」，加入購物車後顯示小計、配送方式、運費與免運差額；結帳仍沿用既有逐題流程與人工轉帳待核帳。

## 白名單

- `lib/line/shop-flex.ts`
- `lib/line/shop-checkout.ts`
- `lib/line/postback-actions.ts`
- `lib/line/handle-event.ts`（僅保留既有文字入口相容）
- `lib/line/__tests__/shop-flex.test.ts`
- `lib/line/__tests__/shop-checkout.test.ts`
- 本 Prompt 文件

## 禁止範圍

- 不改 `shop-catalog.ts` 的 Shopify 讀取、快取與分類。
- 不改 Prisma schema、migration、套件、環境變數或正式資料。
- 不改建單、HQ tier 驗證、`checkoutKey` 防重複、付款狀態、庫存或末五碼寫入邏輯。
- 不改換罐流程、登入、Rich Menu 設定或正式 LINE channel。
- 不部署、不合併。

## 固定行為

1. 「線上購物」先回文字問題與 postback Quick Reply。
2. 類別最多顯示 5 張商品卡；更多商品用 LINE 內 postback 翻頁。
3. 加入後顯示商品明細、小計、配送方式＋運費，以及免運差額。
4. 小計 1198：7-ELEVEN、運費 60、差額 1；1199 以上：宅配免運、差額 0。
5. 結帳文案標示 1/3、2/3、3/3；狀態轉移與驗證不變。
6. 最後只顯示「待人工核帳」，不得顯示付款成功或已付款。
7. 舊的文字類別入口與 `jd=shop_add`、`jd=shop_checkout` 必須相容。

## 驗收

- LINE 購物單元測試通過。
- TypeScript 檢查不新增錯誤。
- 換罐相關既有測試通過且未修改。
- 差異只在白名單，沒有 schema、migration、dependency 或正式設定變更。

## 延後工作包

- 事件併發與重複點擊抑制。
- 結帳時重新同步 Shopify 價格與可售狀態。
- 可逐欄修改的最終確認狀態機。
- 更完整的手機／末五碼正規化與重複回報處理。
