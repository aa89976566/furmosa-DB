# Test Strategy

**執行：** `npm test` → Node test runner + `tsx`，路徑見 `package.json` `scripts.test`。  
**原則：** 只記錄**現存**測試；不虛構覆蓋。

---

## 1. 目前已有測試（29 檔）

| 區域 | 檔案 | 覆蓋焦點 |
|------|------|----------|
| Merchant auth | `lib/merchant-auth/__tests__/merchant-auth.test.ts` | JWT、登入、隔離、middleware 決策、product settings |
| Booking | `lib/booking/__tests__/booking.test.ts` | 班表、滿格、labels、容量規則、LINE copy／提醒窗 |
| Restock | `lib/restock-request/__tests__/restock-request.test.ts` | 品類、labels、隔離、驗證規則 |
| Orders parse | `lib/orders/__tests__/parse-restock-form.test.ts` | carrier／restock form |
| LINE | `lib/line/__tests__/*.test.ts` | parse、throttle、register、flex menu… |
| Jar | `lib/jar-exchange/__tests__/*` | codes、revenue、redeem（**需 DB**） |
| Coupons | `lib/coupons/__tests__/*` | 券碼、店面額 |
| 共用 | `lib/__tests__/*` | pagination、runtime-cache、job-throttle、KPI freshness、revenue filters、carrier、taipei-date、commission、search… |

**不存在：** Playwright／Cypress E2E、`*.test.tsx` 元件測、API route 整合測（除間接）。

---

## 2. 缺少的測試（優先）

| 缺口 | 為什麼重要 |
|------|------------|
| Booking Serializable 並發雙預約 | 容量正確性 |
| Restock approve 冪等（雙擊） | 防雙 Shipment |
| merchant_restock 入庫冪等 | 防雙加庫存 |
| LINE webhook 簽名失敗／成功 | 安全 |
| Coupons redeem 競態 | 防雙核銷 |
| POS IDOR（A 讀 B 預約） | 隔離 |
| HQ action 未登入 | 授權 |
| Cron 無 secret 在 production | 安全 |
| 公開 `/book` 滿格不可見 | 產品規則 |

---

## 3. 核心流程測試矩陣

| 流程 | Unit | Integration | E2E |
|------|------|-------------|-----|
| HQ 登入 | 部分（password helpers 間接） | 缺 | 缺 |
| POS 登入／隔離 | ✅ | 缺 DB | 缺 |
| 叫貨→核准→Shipment | labels／validation ✅ | 缺 | 缺 |
| 出貨入庫 | 缺 | 缺 | 缺 |
| 顧客預約→確認 | availability ✅ | 缺 | 缺 |
| LINE 兑碼 | 有檔（需 DB） | 不穩定無 DB | 缺 |
| 券核銷 API | 面額 unit | 缺 API | 缺 |
| 提醒 cron | window windows ✅ | 缺 push mock | 缺 |

---

## 4. 分層建議

| 層 | 放什麼 | Mock |
|----|--------|------|
| Unit | pure functions、狀態標籤、窗計算、parse | 無 IO |
| Integration | Prisma + 測試 DB；transaction 行為 | LINE／Push HTTP |
| E2E | 登入→關鍵 CTA | 外部服務 staging |

---

## 5. 建議 Mock 的外部服務

- LINE Reply／Push／ID Token verify  
- Web Push  
- Vercel Runtime Cache（已有 fallback；測 memory 路徑）  
- Cron 呼叫端（直接 call handler + fake auth header）

---

## 6. 測試資料

- `prisma/seed.ts`：示範帳號／方案（**勿在文件寫密碼**）  
- `scripts/create-merchant-user.ts`：建 POS 帳號  
- Integration：建議獨立 test database URL（待確認 CI 是否已有 — **目前無 CI workflow 檔於 repo 根**）

---

## 7. 必須優先的 Regression Tests

1. Merchant A 無法讀寫 B 的 Appointment／Restock（service 層）  
2. Customer booking 滿格拒絕 + 並發僅一成功  
3. Restock approve 第二次不新建 Shipment  
4. LINE webhook invalid signature → 401  
5. `AUTH_SECRET` 缺失時 production 行為（待實作強制後測）

---

## 8. 業務規則 ↔ 測試狀態（摘要）

| 規則（見 BUSINESS_RULES） | 測試 |
|---------------------------|------|
| A1 Session 分離 | ✅ unit |
| A2 Merchant scope | ✅ unit |
| A3 RBAC | ❌ |
| B1–B4 Booking | 部分 unit |
| B6 LINE notify | copy／window only |
| C1–C3 Restock | 部分 unit |
| D2 入庫冪等 | ❌ |
| E1–E3 Jar／券 | 部分；E2 需 DB |
| F3 付款 webhook | N/A（未實作） |
