# Furmosa HQ / Furmosa OS — Claude Code 交接主文件

> **先讀本檔**，再依需求深入 `docs/`。  
> 本文件描述 **2026-07-25** 以 repository 現況為準的系統。  
> **第一階段原則：** 分析與文件；未明確批准前，不改業務邏輯、不重構、不改 schema、不跑 destructive migration。

---

## 1. 系統名稱與目的

**Furmosa HQ（`package.json` name: `furmosa-hq`）** — 寵物食品／美容寄賣與換罐會員的總部營運後台，並延伸 **Merchant POS**、**公開預約**、**LINE 換罐／通知**。

一句話：把散落的寄賣、訂單、庫存、結算、換罐點數與店家叫貨／預約，收斂成單一 Next.js + Postgres 系統。

---

## 2. 目前系統狀態

| 領域 | 狀態 | 依據 |
|------|------|------|
| HQ Admin（訂單／出貨／商品／寄賣／結算／換罐） | 上線營運中 | `app/(main)/*`, `DEPLOY.md` |
| Phase 0 效能（索引／Dashboard 快取） | ✅ | `prisma/migrations/20260723120000_perf_hot_path_indexes`, `lib/runtime-cache.ts` |
| Phase 1 MerchantUser POS 登入與隔離 | ✅ | `lib/merchant-auth/*`, `prisma/.../merchant_user` |
| Phase 2 RestockRequest 一鍵叫貨 | ✅ | `lib/restock-request/*`, `docs/PHASE-2-ACCEPTANCE.md` |
| Phase 2.5 Merchant Experience／Flow | ✅ 凍結 | `docs/MERCHANT-POS-FLOW.md`, `docs/FURMOSA-EXPERIENCE-BIBLE-v1.md` |
| Booking Round 1（班表／預約／公開頁） | ✅ | `lib/booking/*`, `docs/BOOKING-MVP-PLAN.md` |
| Booking Round 2（LINE 確認／提醒） | ✅ | `lib/booking/notify.ts`, `lib/line/push.ts` |
| Round 3 Refill／Payment／Jar 完整鏈 | ⏳ 未實作 ECPay | Domain Spec 有規格；code 無付款 gateway |
| HQ `User.role` 細粒度授權 | 待確認／實質未閘道 | JWT 有 `role`；多數 HQ action 只驗「有 session」 |

生產部署：**Vercel + Supabase Postgres**（見 `DEPLOY.md`、`vercel.json`）。  
README 仍寫「預設 SQLite」— **與現況不符**（`prisma/schema.prisma` 為 `postgresql`）。

---

## 3. 使用者類型與權限

| 類型 | 進入點 | Session | 隔離規則 |
|------|--------|---------|----------|
| HQ 員工 | `/login` → `/dashboard` | Cookie `furmosa_session`（`lib/auth.ts`） | middleware 要求 HQ JWT |
| 店家 POS | `/pos/login` → `/pos` | Cookie `furmosa_merchant_session`（`lib/merchant-auth/session.ts`） | **僅** merchant cookie；HQ cookie 不可進入 POS |
| 顧客（公開預約） | `/book/[merchantKey]` | 無 HQ/POS session；可選 LIFF idToken | 不洩漏他店預約 |
| LINE 會員 | Bot webhook + `/liff/*` | LINE User ID／ID Token | 綁定 `Customer.lineUserId` |
| 合作店核銷頁 | `/store`, `/store-redeem` + `POST /api/coupons` | 無登入；以 `storeId` slug 驗證 | middleware 對 `/api/coupons` 放行 |
| Cron | `/api/cron/*` | `Authorization: Bearer CRON_SECRET` | middleware 放行；handler 自驗 |

**禁止：** 以客戶端傳入的 `merchantId` 決定資料範圍 — 必須用 `getAuthenticatedMerchantId()`（`lib/merchant-auth/access.ts`）。

---

## 4. 核心業務規則（精簡；詳見 `docs/BUSINESS_RULES.md`）

1. **Booking：** 顧客預約的是 **店（Merchant）**，不是美容師；顧客不可超約；店家／HQ 可手動超約；店家確認後才 `confirmed`（Constitution：`docs/BOOKING-MVP-PLAN.md`）。
2. **Restock：** RestockRequest **不直接扣庫存**；核准後轉既有 `merchant_restock` Shipment；防重複建 Shipment（`lib/restock-request/service.ts`）。
3. **寄賣庫存：** `merchant_restock` 在 Shipment `shipped` 或 `delivered` 入庫（`lib/merchant-restock-inventory.ts`）；一般寄賣銷售另走 MerchantStockTxn。
4. **換罐：** 序號兑碼入點；店家驗舊／顧客 LINE 登新罐規則以 Domain Spec 為準；**加點在顧客登新罐後**（規格）；現行兑碼路徑見 `lib/jar-exchange/*`。
5. **HQ／POS session 分離**（`middleware.ts` + `lib/merchant-auth/edge.ts`）。
6. **Experience：** 未有後端能力的畫面不填假資料（Experience Bible）。

---

## 5. 技術棧

| 層 | 技術 | 版本依據 |
|----|------|----------|
| Framework | Next.js App Router | `next` ^14.2.15（`package.json`） |
| UI | React 18, Tailwind, shadcn/ui (Radix) | `components/ui/*` |
| ORM | Prisma 5 | `@prisma/client` ^5.20 |
| DB | PostgreSQL（Supabase） | `schema.prisma` datasource |
| Auth | bcryptjs + jose JWT cookie | `lib/auth.ts`, `lib/merchant-auth/*` |
| LINE | Messaging API + LIFF | `lib/line/*` |
| Deploy | Vercel Cron（每日 2 條） | `vercel.json` |
| 測試 | Node test runner + tsx | `npm test` |
| 驗證 | Zod（部分表單） | `package.json` |

---

## 6. 專案啟動

```bash
# 需求：Node 20+、已設定 .env（見 docs/ENVIRONMENT.md；值勿提交）
npm install
npx prisma generate
npx prisma migrate deploy   # 連線真實 DB 時；勿對 production 隨意 reset
npm run dev                 # prisma generate + next dev（WATCHPACK_POLLING）
```

詳見 `README.md`、`DEPLOY.md`。種子帳號僅供開發 — **production 必須輪替**（勿在對話中重述密碼）。

---

## 7. 測試／Lint／Build

| 指令 | 用途 |
|------|------|
| `npm test` | 單元／部分整合（`lib/**/__tests__`） |
| `npx tsc --noEmit` | 型別檢查 |
| `npm run lint` | `next lint` |
| `npx prisma validate` | Schema 驗證 |
| `npm run build` | generate + migrate deploy（可 skip）+ `next build` |

**注意：** 本機無 DB 時，jar-exchange 整合測與部分靜態預渲染可能失敗；以 Vercel Preview 為準。

---

## 8. 主要資料夾

| 路徑 | 職責 |
|------|------|
| `app/(main)/` | HQ 受保護頁面與 server actions |
| `app/pos/` | Merchant POS |
| `app/book/` | 公開預約 |
| `app/liff/` | LINE LIFF 頁 |
| `app/api/` | REST：auth、LINE、cron、coupons、notifications、admin |
| `app/store*` | 合作店核銷相關頁 |
| `components/` | UI／領域元件 |
| `features/dashboard/` | Dashboard 查詢 |
| `lib/` | 領域服務、auth、LINE、booking、restock… |
| `prisma/` | schema、migrations、seed |
| `docs/` | Domain／Experience／本交接文件 |
| `scripts/` | 運維腳本（含建 POS 帳號） |

---

## 9. 修改程式碼前必須遵守

1. 先讀相關 **凍結文件**（Domain Spec、Experience Bible、Booking Plan、POS Flow）。
2. **一次只改一個問題**；功能與重構分離。
3. Merchant 資料範圍只用 session `merchantId`。
4. Booking／Restock **不重寫狀態機**，除非產品明確解凍。
5. 修改後跑：`tsc`、相關 `npm test`、必要時 `lint`／Preview build。
6. 不把 secrets、個資、真實 token 寫進 repo 或文件值欄位。
7. Hobby Vercel：**不可**新增超過每日頻率的 cron（見 `docs/ENVIRONMENT.md`）。

---

## 10. 禁止修改事項（未批准前）

- 既有業務狀態機語意（Appointment／Restock／Shipment／Jar 兑點）
- Prisma schema／migration（含 destructive）
- Production 資料
- 套件大版本升級「順便做」
- 複製重做已完成的 Phase 0／1／2
- 開始 Round 3（付款／完整換罐鏈）除非任務明確要求

---

## 11. 高風險模組

| 模組 | 路徑 | 原因 |
|------|------|------|
| Auth／Session | `lib/auth.ts`, `lib/merchant-auth/*`, `middleware.ts` | 繞過＝全站失守 |
| Merchant 隔離 | `lib/merchant-auth/access.ts`, POS actions | IDOR |
| Restock → Shipment | `lib/restock-request/service.ts`, `lib/merchant-restock-*` | 重複出貨／庫存 |
| Booking 容量 | `lib/booking/service.ts`（Serializable tx） | 雙預約 |
| Jar 兑碼／點數 | `lib/jar-exchange/redeem-*.ts` | 重複兑點 |
| LINE webhook | `app/api/line/webhook/route.ts` | 簽名／注入指令 |
| 公開 coupons API | `app/api/coupons/route.ts` | 無 session；靠 store slug |
| Cron | `app/api/cron/*` | `CRON_SECRET` 缺失時的行為 |

---

## 12. 建議 Claude 檢查順序

1. `CLAUDE.md`（本檔）→ `docs/SYSTEM_OVERVIEW.md` → `docs/ARCHITECTURE.md`  
2. `docs/BUSINESS_RULES.md` + 凍結 Domain／Booking／POS Flow  
3. `docs/SECURITY_AUDIT.md`（先處理 Critical／High）  
4. `docs/DATABASE.md` + `prisma/schema.prisma`  
5. `docs/API_AND_DATA_FLOW.md`  
6. `docs/PERFORMANCE_AUDIT.md` / `docs/TECH_DEBT.md`（勿與安全混改）  
7. 依 `docs/CLAUDE_REVIEW_PLAN.md` 分 Phase 執行  

---

## 13. 重要文件索引

| 文件 | 用途 |
|------|------|
| `docs/SYSTEM_OVERVIEW.md` | 問題、旅程、邊界、架構圖 |
| `docs/ARCHITECTURE.md` | 模組、邊界、快取、錯誤處理 |
| `docs/BUSINESS_RULES.md` | 可執行業務規則＋證據 |
| `docs/DATABASE.md` | 表、關係、txn、PII |
| `docs/API_AND_DATA_FLOW.md` | API／actions／sequence |
| `docs/SECURITY_AUDIT.md` | 靜態安全發現 |
| `docs/PERFORMANCE_AUDIT.md` | 效能發現 |
| `docs/TECH_DEBT.md` | 債項與優先級 |
| `docs/TEST_STRATEGY.md` | 測試現況與缺口 |
| `docs/ENVIRONMENT.md` | 環境變數（僅名稱） |
| `docs/CLAUDE_REVIEW_PLAN.md` | 分階段檢視計畫 |
| `docs/FURMOSA-OS-DOMAIN-SPEC-v1.md` | Domain SSOT（凍結） |
| `docs/FURMOSA-EXPERIENCE-BIBLE-v1.md` | UX 憲法 |
| `docs/BOOKING-MVP-PLAN.md` | Booking 凍結規格 |
| `docs/MERCHANT-POS-FLOW.md` | POS 任務流 |
| `docs/BIBLES.md` | 文件地圖／Stage |
| `DEPLOY.md` | Vercel／Supabase 部署 |
| `docs/LINE-SETUP.md` | LINE／LIFF 設定 |
