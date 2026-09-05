# 專案工作規則

## 溝通方式

- 使用繁體中文向我說明。
- 假設我不是專業工程師。
- 執行前先用簡單文字說明準備做什麼。
- 如果需求不清楚，先提出問題，不要自行猜測重要需求。
- 每次只處理一個明確的小任務。

## 程式修改規則

- 修改前先閱讀相關檔案。
- 不要一次重寫整個系統。
- 不要刪除既有功能，除非我明確要求。
- 優先修改既有元件，不要建立大量重複元件。
- 完成後說明修改了哪些檔案。
- 完成後檢查是否有錯誤。
- 如果測試失敗，不要宣稱工作已完成。

## 網頁設計規則

- 不要自行改變已確定的顏色、字體和版面。
- 優先使用既有 UI 元件。
- 所有頁面都必須支援手機和桌機。
- 同類型按鈕必須保持相同外觀。
- 同類型表單、卡片和標題必須保持一致。
- 沒有設計稿時，先提出簡單版面方案，不要直接製作整個網站。
- 如果有參考圖片，必須按照圖片比對間距、顏色、字級和排列。

## 安全規則

- 不要把 API Key、密碼或其他秘密寫入程式碼。
- 不要把秘密寫入瀏覽器前端程式。
- 不要在未經我同意的情況下操作正式資料。
- 不要在未經我同意的情況下部署到正式環境。
- 不要在未經我同意的情況下安裝大量套件。

## 工作流程

每一個功能依照以下順序處理：

1. 閱讀需求和相關檔案。
2. 如果準備把實作指令送給 Cursor，必須先把同一個小任務交給 Claude 審查，取得 Claude 的具體回覆後才可繼續；不得以自己的模擬意見代替聯繫 Claude。
3. 依照 Claude 回覆修正 Cursor 指令，並保持一次只有一個明確動作、清楚的修改範圍、禁止事項與驗收條件。
4. 說明準備如何實作。
5. 等需求明確後才把指令送給 Cursor 或修改程式。
6. 完成程式修改。
7. 執行檢查或測試。
8. 說明結果、修改檔案和待確認事項。

## Cursor 與 Claude 協作規則

- 每一次送出新的 Cursor prompt 前，都必須實際聯繫 Claude 審查該次 prompt。
- Claude 必須檢查：任務是否過大、是否可能破壞既有功能、遺漏案例、安全風險、測試範圍，以及是否有更簡單的做法。
- 收到 Claude 回覆後，必須先吸收修正，再送給 Cursor；若 Claude 指出需求仍不明確或有重大風險，暫停並向使用者說明。
- 不得先送 Cursor 再補問 Claude，也不得把多個功能合併成一個大型 prompt。
- Cursor 回覆後，由目前的執行者獨立檢查修改檔案、差異與測試結果；不得只依賴 Cursor 自己宣稱完成。

## Furmosa DB 技術架構

- 固定使用 Next.js 14 App Router、React、TypeScript、Tailwind CSS、shadcn/ui、Prisma、PostgreSQL 與 Supabase。
- 不得擅自更換框架、ORM、資料庫或建立平行的新系統。
- 優先使用既有的 components、lib、features 與資料結構。
- 建立新元件前，先檢查是否已有可重用元件。

## 登入與權限

- HQ 與 POS 是兩套不同的登入機制。
- 不得混用 HQ 和 POS 的 cookie、session 或驗證邏輯。
- 修改 middleware.ts、lib/auth、lib/auth-edge、lib/auth-secret 或 lib/merchant-auth 前，必須先說明影響範圍。
- 不得為了方便測試而繞過登入或權限驗證。

## 資料庫安全

- 未經使用者明確同意，不得修改 schema.prisma。
- 未經使用者明確同意，不得執行 migration、db push、seed、資料匯入、資料刪除或正式資料修改。
- 不得自行重設、清空或重建資料庫。
- 資料庫結構變更必須先提出變更計畫、影響範圍與回復方式。
- 金額欄位相關修改必須特別檢查 Float 精度與結算影響。

## 正式環境與秘密資料

- API Key、JWT Secret、LINE Secret、綠界金鑰與資料庫連線不得寫進程式碼或提交版本控制。
- 不得顯示、複製或回報秘密值。
- 未經明確同意，不得操作 Vercel Production、Supabase 正式資料庫或正式環境變數。
- 未經明確同意，不得部署、執行正式 cron 或同步正式資料庫設定。
- 不得在正式環境建立示範帳號或示範資料。

## 公開入口與金流

- 修改 LIFF、LINE webhook、綠界付款回呼、refill API 或 cron 前，必須先說明安全與資料影響。
- 不得移除 webhook 簽章、付款驗證或授權檢查。
- 金額、付款狀態、退款與會員點數的修改必須有測試。
- 不得使用瀏覽器傳入的金額直接作為最終付款金額，必須由伺服器驗證。

## 測試與建置

- 修改既有功能後，要執行相關測試。
- 在確認指令安全後才能執行 npm test 或 lint。
- build 指令可能涉及資料庫 migration；未經同意不得直接執行 build。
- 不得為了讓測試通過而刪除測試或降低安全檢查。
- 測試失敗時，必須如實回報，不得宣稱工作完成。

## 文件判斷

- README 與程式現況衝突時，不得直接依照舊 README 操作。
- 應先比對目前程式、schema.prisma、package.json、DEPLOY.md 與 .env.example。
- 發現文件過期時先回報，不要順便大幅重寫文件。

## Shopify OMS 不可違反的規則

1. `orders/create` 必須無條件以 Shopify shop + order id upsert 進 HQ。不得依 SKU、付款狀態、配送方式、商品類別或 allowlist 略過訂單。
2. `orders/paid` 與 `orders/updated` 只能更新來源資料與檢查結果，不得作為訂單是否進 HQ 的條件。
3. Shopify webhook 必須驗證簽章，並以 webhook event id/topic 去重、以 shop + order id 保證訂單唯一、防止舊來源版本覆蓋新資料，且保存處理狀態、錯誤與重試次數。若無可靠 queue，必須先持久化事件才能回應成功。
4. OMS 狀態只允許 `NEW -> REVIEW -> READY -> FULFILLMENT_PENDING -> FULFILLED`。READY 只能由通過 blocking checks 後的人工確認產生；付款成功不得自動進入 READY。
5. 異常使用 issue flags，不為每種異常新增 status。每個 flag 必須包含穩定 code、severity、blocking、message、source field 與 rules version；UI 文字不得作為程式判斷依據。
6. 必須保存 Shopify 原始快照、標準化映射結果與 rules version。商品主檔或映射規則變更不得靜默改寫歷史訂單。
7. SKU 映射必須區分唯一符合、無符合、多筆符合及空白 SKU。只有唯一符合可自動對應，其餘必須產生 blocking issue，不得自行猜測商品。
8. 商品溫層與配送方式必須使用 enum 或穩定 code。顯示名稱只能作為受控 fallback；未知值必須產生 issue，不得默認為常溫或任一物流方式。
9. 所有建立出貨、建立物流單、扣庫存及回寫 fulfillment 的入口必須共用同一個伺服器端 READY gate，不得只靠 UI 隱藏按鈕保護。
10. Shopify 來源更新若影響商品、數量、付款、收件或配送，必須重新計算 issues；必要時使既有審核失效並回到 REVIEW。
11. HQ 軟刪除不得刪除 Shopify identity、來源快照或稽核紀錄。後續 webhook 可更新來源資料，但不得自動取消刪除狀態。
12. 非 Shopify 舊流程以 `omsStatus = null` 維持相容。修改列表、搜尋、統計、審核或出貨查詢時，必須增加 legacy regression test。
13. Reconcile 必須支援 dry-run、批次上限、冪等 upsert、差異報告、重試與最後成功時間；正式環境禁止無上限全量同步。
14. 資料結構變更必須先取得使用者同意。未另行批准，不得執行正式 migration、backfill、webhook 變更或物流呼叫。
15. 不得把落後 main 的 Preview 分支直接部署正式環境。正式候選版必須基於最新 main 重整並保留其他既有變更。
16. OMS 開發採工作包制：先凍結規格與驗收矩陣、集中實作、執行一次本地品質閘門、執行一次 Preview 端到端驗收，通過後才準備正式上線。不得因單一文字、間距或小欄位反覆部署。
17. 正常 Shopify 訂單不得要求員工重填已存在的姓名、電話、地址、商品、數量、價格、付款或配送資料。只有缺失、衝突或無法唯一映射的欄位才可顯示人工輸入。
18. OMS 測試至少涵蓋：未付款 create、webhook 重送與亂序、SKU 無／多筆符合、未知配送、溫層衝突、來源更新使審核失效、軟刪除後同步、reconcile 補漏、READY gate，以及舊流程回歸。
