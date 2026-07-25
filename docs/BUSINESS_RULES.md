# Furmosa Business Rules（從程式碼整理）

每條格式：規則｜實作位置｜資料表／API｜風險｜測試  
**多處實作** 特別標註。

---

## A. 身分與隔離

### A1. HQ 與 POS Session 不得互用
- **規則：** HQ cookie 不能進 `/pos`；merchant cookie 不能進 HQ。  
- **位置：** `middleware.ts`, `lib/merchant-auth/edge.ts` (`decidePosAccess`, `decideHqAccess`)  
- **資料：** Cookie `furmosa_session` / `furmosa_merchant_session`  
- **風險：** 若 middleware matcher 漏路徑 → 越權  
- **測試：** `lib/merchant-auth/__tests__/merchant-auth.test.ts`（middleware guards）

### A2. Merchant 資料範圍只信 session
- **規則：** 查詢／mutation 的 `merchantId` 來自 session，忽略客戶端偽造。  
- **位置：** `lib/merchant-auth/access.ts` (`getAuthenticatedMerchantId`, `assertMerchantAccess`)；POS appointments／restock actions  
- **資料：** `MerchantUser`, `Appointment`, `RestockRequest`, …  
- **風險：** 漏用 session 的 HQ 或新 API → IDOR  
- **測試：** merchant-auth isolation helpers；restock isolation helpers  

### A3. User.role 未做路由閘道（待確認產品意圖）
- **規則（schema）：** `admin` / `staff` / `finance` / `warehouse`  
- **實作：** JWT 帶 `role`（`lib/auth.ts`）；**未發現**依 role 拒絕 HQ action 的統一中介層  
- **風險：** 任何登入員工可達多數 HQ mutation  
- **測試：** 無 RBAC 測試  

---

## B. Booking

### B1. 顧客預約店，不是員工
- **規則：** 無 Technician 實體；共用班表。  
- **位置：** `docs/BOOKING-MVP-PLAN.md`；`MerchantSettings.booking*`；`lib/booking/availability.ts`  
- **資料：** `Appointment`, `MerchantSettings`  
- **風險：** 誤加分班破壞憲法  
- **測試：** availability unit tests  

### B2. 顧客不可超約；店家可超約
- **規則：** customer `allowOverbook=false`；merchant create `allowOverbook` 預設 true。  
- **位置：** `lib/booking/service.ts` (`submitCustomerBooking`, `createMerchantAppointment`)；公開頁 `audience: 'customer'` 隱藏滿格  
- **資料：** `Appointment.isOverbooked`, capacity fields  
- **風險：** 列表 API 若用錯 audience → 顧客見滿格或可寫入  
- **測試：** `booking.test.ts` capacity／visibility  

### B3. 店家確認後成立
- **規則：** 顧客送出 → `requested`；確認 → `confirmed`。手動新增直接 `confirmed`。  
- **位置：** `submitCustomerBooking`, `confirmAppointment`, `createMerchantAppointment`  
- **資料：** `Appointment.status`, `confirmedAt`  
- **風險：** 繞過確認即履約（產品禁止）  
- **測試：** labels；狀態轉換無 DB integration 測  

### B4. 容量競態需 Serializable
- **規則：** 容量檢查與 create 同一 Serializable transaction。  
- **位置：** `lib/booking/service.ts` `$transaction(..., { isolationLevel: 'Serializable' })`  
- **風險：** 改回非交易／低隔離 → 雙預約  
- **測試：** capacity math unit；**無**並發 integration  

### B5. 佔用狀態
- **規則：** `requested` + `confirmed` + `reschedule_proposed` 佔格。  
- **位置：** `lib/booking/constants.ts` `APPOINTMENT_OCCUPYING_STATUSES`  
- **風險：** `reschedule_proposed` **寫入路徑未找到**（待確認死狀態）  
- **測試：** constants 間接  

### B6. LINE 通知鏈（Round 2）
- **規則：** 送出→顧客已收到＋店家新單；確認→顧客已確認；T−1d／T−2h 提醒；冪等時間戳；失敗不回滾預約。  
- **位置：** `lib/booking/notify.ts`, `notify-copy.ts`, `reminders.ts`；觸發於 service；cron + POS throttle  
- **資料：** `lineNotify*At`, `lineReminder*At`, `Customer.lineUserId`, `MerchantSettings.bookingNotifyLineUserId`  
- **風險：** 無 lineUserId 時標記已處理＝靜默略過；重複觸發靠冪等  
- **測試：** copy／window unit；**無** push mock integration  

---

## C. Restock（一鍵叫貨）

### C1. 僅 JAR_EXCHANGE 品項
- **規則：** 叫貨商品須 `productCategory = JAR_EXCHANGE`。  
- **位置：** `lib/restock-request/service.ts` (`assertJarExchangeProducts`)  
- **資料：** `Product.productCategory`, `RestockRequestItem`  
- **測試：** `restock-request.test.ts` product category  

### C2. 不直接扣庫存；轉 Shipment
- **規則：** 核准建立 `merchant_restock` Shipment／Order；防重複 `shipmentId`。  
- **位置：** `approveAndConvertRestockRequest`；`lib/merchant-restock-order.ts`  
- **資料：** `RestockRequest`, `Shipment`, `Order`  
- **風險：** 重複核准 → 雙出貨（程式有 claim／idempotent，仍屬高風險區）  
- **測試：** labels／validation unit；**無**端到端核准測  

### C3. 狀態
- **規則：** submit→`submitted`；HQ 編輯→`under_review`；reject→`rejected`；approve→`converted_to_shipment`。  
- **位置：** `lib/restock-request/constants.ts`, `service.ts`  
- **風險：** `draft`/`cancelled`/`allowAutoApproveRestock` 標籤存在但完整流程 **待確認**  
- **測試：** status label unit  

---

## D. 出貨與寄賣庫存

### D1. Shipment 狀態流
- **規則：** `pending → packed → shipped → delivered`（或 cancelled）；`nextStatuses` 限制。  
- **位置：** `lib/shipment.ts`；actions `app/(main)/shipments/actions.ts`  
- **資料：** `Shipment.status`  
- **測試：** 無完整狀態機測試（待確認）  

### D2. 寄賣進貨入庫時機
- **規則：** `merchant_restock` 在 **shipped 或 delivered** 寫入 MerchantStock；以 txn note 含 shipmentNumber 做冪等。  
- **位置：** `lib/merchant-restock-inventory.ts`；shipment actions 呼叫  
- **資料：** `MerchantStock`, `MerchantStockTxn`  
- **風險：** 重複呼叫應冪等；改時機影響帳實  
- **測試：** 無專測（待確認）  

### D3. Order ↔ Shipment 同步
- **規則：** 雙向狀態對應（shipped／delivered／cancelled…）。  
- **位置：** `lib/shipment-order-sync.ts`  
- **風險：** 只改一端造成不一致  
- **測試：** 無  

---

## E. 換罐／點數／券

### E1. 序號格式
- **規則：** 8 位數字；拒絕舊 `PET-` 格式。  
- **位置：** `lib/jar-exchange/codes.ts`  
- **測試：** `jar-exchange/__tests__/codes.test.ts`  

### E2. 兑碼入點
- **規則：** unused→used；ledger 追加；負餘額拒絕。  
- **位置：** `lib/jar-exchange/redeem-code.ts`, `points.ts`  
- **資料：** `JarCode`, `MemberPointsLedger`  
- **風險：** 競態雙兑（需看 transaction／claim）  
- **測試：** `jar-exchange.test.ts`（需 DB；無 DB 會 cancel）  

### E3. 美容券面額
- **規則：** 猪窩體系 250、其他合作店 200；綁 store。  
- **位置：** `lib/coupons/store-discount.ts`, `lib/coupons/service.ts`  
- **資料：** `GroomingCoupon`  
- **測試：** `store-discount.test.ts`, `codes.test.ts`  

### E4. 核銷 API
- **規則：** `storeId` 須為有效 partner slug；verify／redeem。  
- **位置：** `app/api/coupons/route.ts`, `lib/stores/partner-stores.ts`  
- **風險：** 無 session；知券碼即可嘗試（需 rate limit 待確認）  
- **測試：** 無 API 層測  

### E5. 寄賣換罐出貨營收 $0
- **規則：** jar exchange consignment 定價特殊。  
- **位置：** `lib/jar-exchange/revenue.ts`  
- **測試：** `revenue.test.ts`  

---

## F. 訂單與付款狀態

### F1. 訂單狀態字串
- **規則：** `draft|confirmed|packed|shipped|delivered|completed|cancelled` + 獨立 `paymentStatus` / `fulfillmentStatus`。  
- **位置：** `lib/labels.ts`；`app/(main)/orders/actions.ts`  
- **資料：** `Order`  
- **風險：** 字串拼錯；無 DB check constraint  
- **測試：** 部分 parse／search unit  

### F2. 可編輯訂單
- **規則：** 非 completed／cancelled；非訂閱衍生。  
- **位置：** `lib/orders/*` `isOrderEditable`  
- **測試：** 待確認  

### F3. 金流 webhook
- **規則（Domain）：** ECPay webhook 後才保留換罐庫存等。  
- **實作：** **本 repo 無 ECPay route**  
- **狀態：** 規格凍結／程式未到 Round 3  

---

## G. 通知時機

| 時機 | 通道 | 位置 |
|------|------|------|
| 預約申請／確認／改期 | LINE Push | `lib/booking/notify.ts` |
| T−1d（台北明天） | LINE；每日 cron | `lib/booking/reminders.ts`, `app/api/cron/maintain-shipments` |
| T−2h | LINE；POS 15min throttle + cron 掃 | `app/pos/page.tsx`, reminders |
| HQ 新訂單 | Web Push | `lib/web-push.ts`, notifications API |
| LINE 選單／兑碼回覆 | Reply | `lib/line/reply*.ts` |

---

## H. 產品設定不可硬編碼（部分）

- `WAITING_FOR_JAR_RESERVATION_DAYS` → `lib/config/product-settings.ts`  
- 測試：merchant-auth「product settings」suite  

---

## I. 不可被一般重構破壞的規則（摘要）

1. Session 分離與 merchant scope  
2. Booking 憲法（店／確認／不超約）  
3. Restock → Shipment 冪等、不直接扣庫  
4. merchant_restock 入庫時機與冪等  
5. Jar 兑碼一次性與點數帳本順序  
6. LINE webhook 簽名驗證  
7. 公開頁不洩漏他店／內部庫存資料  
