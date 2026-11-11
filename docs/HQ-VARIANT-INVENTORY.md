# HQ 聯名組香氣庫存

## 範圍

只擴充啟用規格獨立庫存的商品。其他商品維持現有共用庫存與克數組合流程。MerchantStock、POS、登入及 Shopify webhook 均不修改。

雞排加蠟四款香氣各自對應既有 ProductPriceTier 與 Shopify variant。每組出貨扣該香氣一顆蠟燭。雞排沿用既有 FUR-0002 / 50g 成品，維持現做不扣庫存。蠟燭成本190、雞排40、組合230元；價格399元。

## 資料與防護

- 新增規格倉別餘額與不可修改的交易帳冊；舊餘額不搬移、不清零。
- 開帳與扣帳使用相同交易鎖。來源事件唯一；已直接扣帳訂單不能再經出貨單重扣。
- 取消依原始交易規格、數量、單位及快照回補一次；不依當下售價或配方重算。
- 啟用時間之前的訂單，包括其後建立的出貨單，不補扣、不回填歷史訂單。
- Shopify 訂單保留原有 OMS 人工審核與來源版本檢查。已扣帳明細不可改寫。
- 負庫存沿用 HQ 提醒模式；本變更不新增 Shopify 庫存同步程式，亦不把 HQ 數量覆蓋至 Shopify。

## 發布與開帳

1. CI 完整 typecheck/test 與隔離 Preview 驗證通過。
2. 依 config/deployment-targets.json，以 Deploy Production 鎖定 exact PR/head SHA，standard plan 僅執行本次新增結構 migration。
3. scripts/ops/initialize-collab-wax-variants.sql 是另行控制的資料開帳操作，不在 build、migration 或啟動程序自動執行。使用者已指定四款各20顆；仍需透過核准的專用 runner/plan 執行及驗證。
4. 初始化會核對商品、四款SKU/variant、價格、成本、雞排成品及既有餘額；部分開帳或有非零舊庫存則拒絕。重跑不重設已售出的餘額。
5. 開帳後唯讀核對四款各20顆及四筆開帳交易，確認後才可報告 HQ 庫存完成。初始化不會上架 Shopify 草稿商品。

開帳依使用者指定數量，非已實際盤點。待辦為正式發布、開帳與正式讀回驗證；不能把分支推送或測試通過視為正式完成。

## 回復

可先回復舊版應用程式，但保留新增表及扣帳/回補函式。已存在交易時不得刪表、清帳或將餘額重設20；必要時暫停新出貨，逐筆依原帳冊核對。未開帳前只新增結構，不影響舊商品。

## 驗證

node --test lib/__tests__/variant-inventory*.test.mjs：18項隔離 PostgreSQL 測試，涵蓋既有克數配方、香氣庫存、重送、回補、歷史訂單、OMS gate、跨來源防重與帳冊保護。Prisma schema validate 已通過；完整專案 typecheck/build 交由 CI，局部檔案環境無法替代完整驗證。
