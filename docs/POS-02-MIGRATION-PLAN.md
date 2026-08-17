# POS-02 Migration Plan

> **地位：** POS-02 以後若要落庫，必須先過的閘門與順序。本輪**零資料庫變更**。
> **版本：** v0.2
> **日期：** 2026-08-17
> **承接：** PR #126 head `fc067be26a9df60c94d4e04b6ca9081f42cb9caf`
> **配對：** `docs/POS-02-PERSISTENCE-PROPOSAL.md` v0.2
> **合約：** POS-01 仍是 canonical。本檔不覆蓋 POS-01。
> **本輪硬禁止：** 不改 schema、不新增 `prisma/migrations`、不跑 migrate／db push／seed／SQL／Supabase、**不產生可對 Production 執行的 migration SQL**、不讀寫正式資料、不部署

---

## 0. 用白話說

正式庫的搬家紀錄和 Git 對不齊（drift）。沒對齊之前，不准為 POS 建表。

即使以後建了表：

- 真實店家在 cutover 前**不能**寫新帳（no-real-POS gate）。
- 新帳只在 Preview／shadow 比對。
- 出問題時：停新寫、讀回舊帳；**不刪**已經寫進 V2 的不可變列。

本輪只改這份說明，資料庫一行都不動。

---

## 1. 本輪範圍（零 DB 變更）

| 可以 | 不可以 |
|------|--------|
| 寫這兩份 docs | 改 `schema.prisma`、加 migration |
| 寫「以後 Preview 用」的**查詢規格** | 把規格當成 Production migration 去跑 |
| 把 drift／Store／Float 標成 blocker | 連正式庫或 Preview 執行 |
| | merge、deploy、進 schema／POS-03 |

`git diff` 相對 POS-01 branch **只能多這兩個 docs**。

---

## 2. Prerequisite：drift 未 reconcile 不可建 migration

`origin/main` 最後一筆 migration 仍是 `20260729170000_refill_flavours_stock`。
Draft PR **#112–#115** 記錄 Production `_prisma_migrations` 另有 12 筆 `202608*`，repo 沒有對應檔。

**未關閉前：禁止建立任何 POS expand migration（含空表）。**

對齊步驟（本輪只定義，不執行；動正式庫要另開人工授權）：

```text
readonly snapshot → repo／schema／ledger 三方 diff
→ missing / applied / divergent / manual
→ 人工核准 → disposable Preview 演練
→ backup／forward-only／validation
→ 通過後才允許 POS expand 的 Preview 演練
```

不可 replay 已套用 ledger、不可 `db push` 正式庫、不可把 #114 證據當 active migration。

---

## 3. No-real-POS gate

在 **writer 切齊 + shadow 通過 + 人工 cutover** 之前：

- 真實店家 POS／HQ 入口**不得** insert `PosSale`、`PosRefund*`、`PosFinancialLedgerEntry`、`PosInventoryLedger`、`PosSettlementV2`
- 程式應有明確 feature flag（以後實作）：`POS_V2_WRITES = preview_only`
- 違反此 gate＝漏結算（新帳有、舊 `Settlement` 沒加到）

Shadow 允許：只讀複製／離線比對，不取代 HQ 月結出口。

---

## 4. Writer-by-writer cutover

與提案 §2.3、§3.1 同一張表。Cutover **不是**「先讓 POS 寫新表、HQ 慢慢改」。

建議順序（每步自己 Preview → 人工 gate）：

1. Drift reconcile
2. Expand 新表（**建表當下就有** CHECK／FK／EXCLUDE／trigger；見提案 §9）
3. `MerchantStock` nullable `onHand`／`reserved`／`stockReady`（**無 DEFAULT 0**）
4. Float／quantity backfill + quarantine
5. Shadow compare（舊 txn 加總 vs 投影 V2；不混 Float+Int）
6. 代收：`MerchantSaleSnapshot` shadow（Order 仍權威）
7. **同一窗口**切會動同一 stock 列的 writers，或關掉未切的入口
8. 打開真實 POS 寫入（解除 no-real-POS）
9. HQ 月結改讀 `PosSettlementV2`（不再加總 legacy txn 當 POS 成交）
10. 很久以後才 contract（刪 Float、停 quantity 寫入）

| Writer | Cutover 日之前 | Cutover 日 |
|--------|----------------|------------|
| HQ 店內 sale／quick sale | legacy txn | 改 PosSale **或**關閉 |
| HQ adjust／return | legacy | ledger **或**阻擋進 POS available |
| Shipment 入庫 | legacy quantity | 只 delivered → ledger+onHand |
| Refill | 獨立，不進寄賣結算 | 維持獨立 |
| POS 店內 | **阻擋寫新帳** | PosSale |
| 退款 | 阻擋 | PosRefund completed 鏈 |
| LINE／ECPay | Order 權威 | Order 權威 + snapshot |

未切齊 → **明確阻擋**該 writer 碰 `onHand`／POS 結算，不准默默雙寫。

---

## 5. Expand／backfill／verify（修正 v0.1 的錯誤）

### 5.1 新表

- 新 POS 表的約束在 **CREATE 當時**就存在。
- 只有 **legacy 舊列**的 CHECK 可用 `NOT VALID` 再 `VALIDATE`。
- 不在舊 `Settlement` 上加 Int 當 V2。V2 是新表。

### 5.2 MerchantStock 餘額

1. 加 nullable `onHand`、`reserved`、`stockReady`——**禁止 `DEFAULT 0`**
2. backfill 合格列；負數／不明保持 null、`stockReady=false`
3. 讀端沒 ready **不可**當成 0 件
4. `quantity` 只 mirror；cutover 後不可獨立寫
5. 再 NOT NULL（僅 ready 列）或分批

### 5.3 Compatibility projection

- `sourceEventId` unique、非權威
- 可重建；不可當結算來源

### 5.4 Shadow compare

比對項目（只記差異，不改正式出口）：

- 同期間 legacy sale 加總 vs shadow PosSale／snapshot 加總（**分開**店收與代收）
- 佣金 snapshot vs 剩餘淨額公式
- onHand（ready 列）vs ledger 重算
- 不得把 legacy Float 與 V2 BigInt 加在同一個「總應付」

---

## 6. Quarantine

### 6.1 Store 歧義

- 一名對多 slug、一 slug 對多 merchant、只靠中文店名、與偏好 MER 編號不一致
- 只進 `MerchantStoreLinkAudit`（quarantined）
- **不准**自動寫 `MerchantStoreBinding`
- 未 verified binding → 券／LINE 對店 fail closed

### 6.2 Float 異常（查詢規格；本輪不執行）

下列是 **Preview 稽核規格**，用來以後找出不能自動 round 的列。
**不是** Production migration，本輪**不要跑**、不要放進 `prisma/migrations`。

目標表（至少）：`MerchantStockTxn.unitPrice`／`commissionAmount`／`companyRevenue`，`Settlement.grossSales`／`commissionAmount`／`payable`，`GroomingCoupon.discountAmount`，`Order.total`／`OrderItem.unitPrice`。

```text
SPEC ONLY — do not execute this round — not a production migration

1) NaN
   WHERE <float_col> IS NOT NULL AND <float_col> <> <float_col>

2) Infinity / -Infinity
   WHERE <float_col> IN ('Infinity'::float8, '-Infinity'::float8)

3) 非整數（有小數）
   WHERE <float_col> IS NOT NULL
     AND <float_col> = <float_col>
     AND <float_col> NOT IN ('Infinity'::float8, '-Infinity'::float8)
     AND <float_col> <> trunc(<float_col>)

4) round-trip 失真（float8 ↔ numeric）
   WHERE <float_col> IS NOT NULL
     AND <float_col> = <float_col>
     AND <float_col>::numeric <> <float_col>
     -- 或 ::text::float8 <> 原值

5) 與 POS-01 公式不一致（僅已能解讀為整數者）
   成交與佣金皆通過 1–4 後：
   commission 應等於 round(gross * rate / 100)
   對不上 → quarantine，禁止 Math.round 硬塞進 Int 欄
```

不合格列：**不得**自動四捨五入進 V2。

---

## 7. Rollback 定義

Rollback **不是**刪 V2、也不是倒回 Production schema。

允許：

- 關掉 `POS_V2_WRITES`（停新寫）
- HQ 結算讀回 legacy txn／舊 `Settlement`（若尚未切出口）
- 修規則後 roll-forward

禁止：

- DELETE `PosFinancialLedgerEntry`／`PosInventoryLedger`／已 completed 退款
- 為了「乾淨」truncate V2
- 把已套用的 drift ledger replay 掉

若 cutover 後發現錯：用 **下一期 adjustment** 或新 reversal，不改已核准 V2 金額。

---

## 8. Production 人工 gate（本輪不得觸發）

1. Drift #112–#115（或核准替代）已關
2. POS-01 contract bump（O1＋completed＋分型）已合併，或明確豁免紀錄
3. Preview 演練：約束、複合 FK、冪等衝突、O1 rollback、Float 規格查出 quarantine
4. 所有同 stock writer 切齊或阻擋清單已簽
5. no-real-POS 解除授權
6. backup、監控、roll-forward 負責人

本文件不附正式庫 SQL。

---

## 9. 監控

負庫存、同 key 不同 fingerprint、跨店 FK 失敗、ledger 不平衡、超額退款、佣金公式不符、已鎖期被改、quarantine 增加、bindings 被非 hq_manual 寫入、`_prisma_migrations` 再分岔、真實店家在 flag 關閉時寫入 V2。

---

## 10. Acceptance checklist（要有證據才 PASS）

| 項 | 結果 | 證據 |
|----|------|------|
| 本輪零 DB／零正式 migration SQL | **PASS** | 僅 2 docs；§6.2 標 SPEC ONLY |
| drift 未 reconcile 不可建 migration | **PASS** | §2 |
| writer-by-writer cutover | **PASS** | §4 |
| shadow compare、不混 Float+Int | **PASS** | §5.4 |
| no-real-POS gate | **PASS** | §3 |
| onHand 不 default 0 | **PASS** | §5.2 |
| Store／Float quarantine、不自動綁、不自動 round | **PASS** | §6 |
| rollback＝停寫／回舊讀，不刪 V2 | **PASS** | §7 |
| 豬窩 ID 未猜 | **PASS** | 無正式 ID backfill |
| POS-01 未被本檔覆蓋 | **PASS** | 開頭＋提案 §1 |

---

## 11. 仍未決／停止點

- O3
- POS-01 contract bump 未開
- Drift 未關

不進 schema、不進 POS-03、不執行任何 SQL、等待 review。
