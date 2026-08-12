# Tech Debt Register

優先級：P0 阻擋安全／正確性｜P1 高風險｜P2 中｜P3 整潔

| ID | 優先級 | 項目 | 位置 | 風險 | 建議 | 範圍 | AI 適合？ |
|----|--------|------|------|------|------|------|-----------|
| TD-01 | P0 | AUTH_SECRET fallback | `lib/auth.ts`, `lib/auth-edge.ts` | 偽造 session | 強制 env | 小 | 是（需審） |
| TD-02 | P1 | HQ 無 RBAC | 多數 `(main)/**/actions.ts` | 越權 | 角色矩陣＋guard | 中大 | 半（需產品） |
| TD-03 | P1 | README 過時（SQLite／目錄） | `README.md` | 誤導 onboarding | 對齊 Postgres／POS／book | 小 | 是 |
| TD-04 | P1 | `reschedule_proposed` 死狀態 | `lib/booking/constants.ts` vs service | 文件／code 不一致 | 刪或實作 | 小 | 是 |
| TD-05 | P1 | Coupons API 無節流 | `app/api/coupons/route.ts` | 暴力兑券 | rate limit | 中 | 是 |
| TD-06 | P2 | 超大 order-form | `app/(main)/orders/new/order-form.tsx` | 難維護／bundle | 拆分 | 大 | 半 |
| TD-07 | P2 | 超大 merchant actions | `merchants/[id]/actions.ts` | 混合職責 | 抽 lib | 大 | 半 |
| TD-08 | P2 | Float 金額 | `schema.prisma` 註解 | 精度 | Decimal 專案 | 很大 | 否（專案） |
| TD-09 | P2 | InventoryBalance 寫入不明 | schema vs app | 雙軌庫存 | 釐清 SSOT | 中 | 半 |
| TD-10 | P2 | Restock draft／cancel／auto-approve 未完整 | constants vs service | 死代碼／誤用 | 實作或刪標籤 | 中 | 半 |
| TD-11 | P2 | Domain Spec Round 3 與 code 落差 | `docs/FURMOSA-OS-DOMAIN-SPEC-v1.md` | 誤實作付款 | Stage 標記清楚 | 文件 | 是 |
| TD-12 | P2 | 多數 HQ actions 無 handler 內 auth | 慣例靠 middleware | 誤用 action 於公開 | 統一 `requireHqUser` | 中 | 是 |
| TD-13 | P3 | Zustand 依賴未見主力使用 | `package.json` | 死依賴待確認 | 確認後移除或採用 | 小 | 是 |
| TD-14 | P3 | TODO 極少但文件 TODO 殘留 | `docs/PLAN-pos-booking-system.md` | 噪音 | 更新 Stage | 小 | 是 |
| TD-15 | P3 | 命名：supply→jar-exchange redirect 仍留腳本路徑 | `next.config.mjs`, `app/(main)/supply` | 混淆 | 收斂命名 | 中 | 半 |
| TD-16 | P2 | 測試缺 E2E／關鍵路徑 DB 測 | 見 TEST_STRATEGY | 回歸弱 | 補 matrix | 中 | 半 |
| TD-17 | P2 | 錯誤處理不一致 | actions 回傳 vs throw | UX／洩漏 | 統一 helper | 中 | 是 |
| TD-18 | P3 | `any`／寬鬆型別 | 部分 API body cast | 型別洞 | zod 收斂 | 中 | 是 |

### 重複邏輯（標記）

- 出貨狀態轉換／標籤：`lib/shipment.ts` + UI 多處  
- 電話正規化：booking service 與 `lib/line/bind-customer.ts` 等 **多處**  
- Ensure merchant／store：`lib/stores/ensure-*` 與 cron  

### 文件與程式不一致

| 文件 | 不一致 |
|------|--------|
| `README.md` | SQLite、舊目錄（無 pos／book） |
| `docs/PLAN-pos-booking-system.md` | LINE TODO 過時（Round 2 已做） |
| Experience Bible 早期「禁止寫 Booking」 | 歷史段落；以 BIBLES Stage 為準 |

---

## 建議清債順序

1. TD-01 → TD-05 → TD-03／TD-04（安全＋真相）  
2. TD-12／TD-16（防護網）  
3. TD-06／TD-07（可維護性，獨立 PR）  
