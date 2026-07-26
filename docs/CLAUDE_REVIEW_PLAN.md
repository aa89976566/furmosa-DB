# Claude Code Review & Hardening Plan

本計畫供後續 Agent **分階段**檢查與安全修改。  
**任何修改**必須遵守文末「修改守則」。

---

## 全局不可修改區（未批准前）

- 凍結業務語意：Booking 憲法、Restock→Shipment、Jar 兑點一次、HQ／POS session 分離  
- `prisma/migrations/*` destructive／任意 schema 大改  
- Production 資料  
- 與任務無關的依賴大升級  

**高風險模組**（改前加倍測試）：見 `CLAUDE.md` §11。

---

## Phase 0：建立 baseline ✅

| 項 | 內容 |
|----|------|
| **目標** | 可重現的健康檢查；文件與程式對齊認知 |
| **要看的檔案** | `CLAUDE.md`, `package.json`, `docs/*`（本交接包）, `middleware.ts`, `prisma/schema.prisma` |
| **要執行的指令** | `npx prisma validate`, `npx tsc --noEmit`, `npm test`, `npm run lint`（記錄失敗原因） |
| **不可修改** | 業務邏輯；本 Phase 僅可修**純文件錯字**若與任務相符 |
| **預期產出** | baseline 報告：通過／失敗列表；環境是否有 DB |
| **驗收** | 報告存於 PR／對話；已知失敗標「環境」或「產品」 |
| **回滾** | 無程式變更則 N/A |
| **完成** | 2026-07-26 → 見 `docs/PHASE-0-BASELINE.md` |

---

## Phase 1：安全與資料風險

| 項 | 內容 |
|----|------|
| **目標** | 處理 `SECURITY_AUDIT.md` Critical／High |
| **要看的檔案** | `lib/auth.ts`, `lib/auth-edge.ts`, `lib/merchant-auth/*`, `middleware.ts`, `app/api/coupons/route.ts`, `app/api/cron/*`, `app/api/line/webhook/route.ts` |
| **要執行的指令** | 既有 auth／merchant-auth 測試；新增回歸後 `npm test` + `tsc` |
| **不可修改** | 付款／Round 3；無關 UI 大改 |
| **預期產出** | 例如：強制 AUTH_SECRET；cron 強制 secret；錯誤訊息收斂（一次一 PR） |
| **驗收** | 安全項關閉條件寫明；無 secret 進 git |
| **回滾** | `git revert` 單一 commit；確認登入仍可用 |

---

## Phase 2：核心業務規則

| 項 | 內容 |
|----|------|
| **目標** | 驗證 Booking／Restock／入庫／兑點規則未被破壞；補關鍵測 |
| **要看的檔案** | `lib/booking/service.ts`, `lib/restock-request/service.ts`, `lib/merchant-restock-inventory.ts`, `lib/jar-exchange/redeem-*.ts`, `docs/BUSINESS_RULES.md` |
| **要執行的指令** | `npm test`；有測試 DB 時跑 jar-exchange 整合 |
| **不可修改** | 狀態機語意（除非產品解凍） |
| **預期產出** | 回歸測試 PR；發現的不一致列「待確認」 |
| **驗收** | 矩陣中 P0 流程有自動化保護 |
| **回滾** | 還原測試＋邏輯 commit |

---

## Phase 3：資料庫與 API

| 項 | 內容 |
|----|------|
| **目標** | 審查 IDOR、冪等、API 授權一致性 |
| **要看的檔案** | `docs/DATABASE.md`, `docs/API_AND_DATA_FLOW.md`, 所有 `app/api/**`, POS／HQ `actions.ts` |
| **要執行的指令** | `tsc`；針對新 guard 的 unit tests |
| **不可修改** | 未批准的 migration；公開 API 契約大改需明示 |
| **預期產出** | HQ `requireHqUser` 統一（若批准）；coupons 強化方案 |
| **驗收** | 未登入／跨店案例測試紅→綠 |
| **回滾** | revert；確認 middleware 行為 |

---

## Phase 4：效能

| 項 | 內容 |
|----|------|
| **目標** | 依 `PERFORMANCE_AUDIT.md` 做**有量測或明顯證據**的優化 |
| **要看的檔案** | `lib/hot-path-reads.ts`, `lib/runtime-cache.ts`, 長列表頁, `order-form.tsx`（若拆分） |
| **要執行的指令** | `tsc`；相關 unit；Preview 體感／bundle 對照（若可得） |
| **不可修改** | 為效能改寫業務規則；勿加 Hobby-illegal cron |
| **預期產出** | 分頁擴展／cache bust 修復等小 PR |
| **驗收** | 無功能回歸；快取失效正確 |
| **回滾** | revert；清 cache tag |

---

## Phase 5：可維護性

| 項 | 內容 |
|----|------|
| **目標** | `TECH_DEBT.md` P2 結構債（拆檔、命名、文件） |
| **要看的檔案** | 巨型 actions／order-form；`README.md` |
| **要執行的指令** | 全量 `tsc` + `npm test` |
| **不可修改** | 同 PR 混入功能；行為必須等價 |
| **預期產出** | 等價重構 PR + README 對齊 |
| **驗收** | 行為對照清單通過 |
| **回滾** | revert 重構 commit |

---

## Phase 6：測試補強

| 項 | 內容 |
|----|------|
| **目標** | 補 `TEST_STRATEGY.md` §7 regression |
| **要看的檔案** | `lib/**/__tests__`, 被測 service |
| **要執行的指令** | `npm test`；文件化測試 DB 需求 |
| **不可修改** | 為了好測而改 production 行為（除非修 bug） |
| **預期產出** | 新測試檔；CI 建議（若無 workflow：提出草案，不強加） |
| **驗收** | 關鍵規則有紅線測試 |
| **回滾** | 刪測試不影響 prod |

---

## Phase 7：安全重構

| 項 | 內容 |
|----|------|
| **目標** | 在測試網下做較大安全結構（RBAC、CSRF、coupons secret） |
| **要看的檔案** | auth、middleware、所有 mutation 入口 |
| **要執行的指令** | 全套 typecheck／lint／test／Preview build |
| **不可修改** | 未批准對外 API breaking change |
| **預期產出** | 分 PR：RBAC → CSRF → coupons |
| **驗收** | Security 清單關閉；角色矩陣產品簽核 |
| **回滾** | 分 PR revert；feature flag 若有 |

---

## 修改守則（強制）

1. **一次只處理一個問題。**  
2. **修改前先說明計畫**（檔案、風險、測試）。  
3. **優先補測試**（能測的先寫）。  
4. **不混合功能修改與重構。**  
5. **不變更對外 API**，除非明確批准。  
6. **不直接改 production data。**  
7. **不執行 destructive migration。**  
8. **修改後執行** `tsc`、相關 `lint`、`test`；能 build／Preview 則做。  
9. **提供變更檔案清單。**  
10. **提供風險、驗證方式及回滾步驟。**

---

## 建議啟動順序（給下一位 Claude）

```
Phase 0 baseline
  → Phase 1 C1 AUTH_SECRET（最小 diff）
  → Phase 1 H3 Cron secret
  → Phase 6 補 Merchant IDOR + booking 滿格測試
  → Phase 2／3 其餘
```

完成每 Phase 更新 `docs/TECH_DEBT.md` / `SECURITY_AUDIT.md` 狀態（僅文件或同 PR 註記）。
