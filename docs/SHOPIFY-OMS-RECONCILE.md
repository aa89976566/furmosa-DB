# OMS 第五階段：管理員漏單比對／補同步

目前為本機程式；未連 Shopify、未同步實際訂單、未部署。不是全量漏單保證。

## 已完成

- 訂單頁新增只對 HQ admin 顯示的折疊面板，使用既有 Button/Input 與 Next server action。
- 「檢查漏單」只讀 Shopify 和 HQ，不寫入訂單或同步紀錄。
- 「重新同步至 HQ」抓最近 1～25 筆，不以付款、SKU、履約狀態篩選；使用原有 intake/upsert，絕不呼叫 Shipment 或物流供應商。
- 每筆結果分開：缺少、一致、不同、新增、更新、重複、來源較舊、版本衝突、舊流程、失敗。
- 同步批次開始／結束寫入既有 StatusAuditLog；每筆使用 ShopifyWebhookEvent 留下 reconcile 前綴事件，不需要額外 migration。
- 在同一訂單鎖內跳過已存在、尚未納入 OMS 的舊訂單，避免補同步把舊出貨流程強行改成新流程。
- 限制讀取筆數、8 秒網路逾時、20 秒迴圈啟動預算；部分失敗保留已成功結果。重試不建立重複訂單。
- 已抓取整批的內容會先驗證，再開始寫入。Shopify 401/403/429、無效 ID 或資料格式有明確訊息，不回傳 token 或供應商原始錯誤內容。
- 網域限定設定中的 `*.myshopify.com`，固定 HTTPS 與 API 路徑，拒絕重新導向，token 只存在伺服器。

## 安全與環境

- `.env.example` 新增空白 `SHOPIFY_ADMIN_ACCESS_TOKEN` 和預設 false 的 `SHOPIFY_RECONCILE_TEST_MODE`。
- Server action 每次讀 HQ session 與 DB 使用者角色，僅 admin 可操作；沒有修改 middleware/auth，也沒有 POS session 混用。
- test mode 未啟用或 VERCEL_ENV=production 時拒絕操作。本版不提供 production 啟用路徑。
- test mode 是管理員完成環境隔離確認後的開關，不是自動驗證 DB 已隔離的證明。不要只是打開開關就接正式 DB。
- Preview 還需要已核准的隔離 DB、migration、測試店/測試憑證和部署分支確認。

## API 選擇與限制

本版為對齊既有 webhook JSON 的 REST 相容介面，使用 `2026-07/orders.json`、status=any、created_at desc 及最多 25 筆。需先確認商店既有 custom app 支援 REST 與 read_orders；尚未確認實際 app 或 token。

REST Admin API 已屬 legacy，不能把此介面當作所有新 Shopify app 均可使用的保證。如果現有 app 無此能力，需新增 GraphQL 轉換器並驗證明細分頁完整性，不能直接假設可部署。

官方參考：[Shopify Order REST 文件](https://shopify.dev/docs/api/admin-rest/latest/resources/order)、[Shopify Order 權限與近 60 天存取限制](https://shopify.dev/docs/api/admin-graphql/2026-01/objects/Order)。一般 read_orders 只涵蓋近 60 天；更舊資料需要額外權限。

- 最近 N 筆是小批次補救，不是全店／所有時間健康保證。尚未實作跨頁巡檢、排程或失敗事件重播。
- complete 表示本批次已逐筆處理，不代表無衝突或全店無漏單；畫面逐筆列出結果。
- 同時間戳卻不同快照仍維持阻擋，未建立管理員強制覆蓋功能。
- 既有舊 Shopify 訂單僅列出並跳過，尚未提供受控批次納入 OMS 的 backfill。
- 同步開始後被平台強制中斷時，可能只留下 STARTED 紀錄；個別訂單事件可供核對。
- 不會自動送出貨、回寫 Shopify fulfillment 或發送收單推播。

## 驗證

74 項 Shopify/orders/搜尋測試通過，新增 9 項包含權限、純比對零寫入、未付款未知商品、批次紀錄失敗、部分失敗、預算中斷、網域/API 保護，以及鎖內保留舊流程。

TypeScript 全專案仍有 25 個原有錯誤，這次未增加。未執行 build、migration、backfill、git push、部署、真實 DB/Shopify 整合測試或瀏覽器驗收。

## 檔案

- `lib/shopify/reconcile.ts`
- `lib/shopify/intake.ts`
- `lib/shopify/__tests__/reconcile.test.ts`
- `lib/shopify/__tests__/intake.test.ts`
- `app/(main)/orders/reconcile-actions.ts`
- `app/(main)/orders/page.tsx`
- `components/orders/shopify-reconcile-form.tsx`
- `components/orders/shopify-reconcile-panel.tsx`
- `.env.example`

累積未完成：多規格對應、完整自動檢查、物流／Shopify fulfillment 串接、隔離 DB 整合測試及 Vercel Preview。
