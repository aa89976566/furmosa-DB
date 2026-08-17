# POS-02 Migration Plan

> **地位：** POS-02 以後若要落庫，必須先過的閘門與順序。本輪**零資料庫變更**。
> **版本：** v0.1
> **日期：** 2026-08-17
> **承接：** PR #126 head `fc067be26a9df60c94d4e04b6ca9081f42cb9caf`
> **配對：** `docs/POS-02-PERSISTENCE-PROPOSAL.md`
> **本輪硬禁止：** 不改 schema、不新增 `prisma/migrations`、不跑 `prisma migrate`／`db push`／seed／SQL／Supabase、不產生可對 Production 執行的 SQL、不讀寫正式資料、不部署

---

## 0. 用白話說

現在正式資料庫的「搬家紀錄本」和 Git 裡的搬家檔**對不齊**。
在對齊並經人工核准之前，**不准**為 POS 加新表或改舊欄。

本檔只寫：以後要怎麼對齊、怎麼分階段、什麼情況要隔離（quarantine）、誰按最後一顆按鈕。
本輪只提交這份說明，**資料庫一行都不動**。

---

## 1. 本輪範圍（零 DB 變更）

| 可以 | 不可以 |
|------|--------|
| 寫這兩份 docs | 改 `prisma/schema.prisma` |
| 給三方 review | 新增任何 `prisma/migrations/**` |
| 把 drift 標成 blocker | 跑 migrate／db push／seed／introspect |
| | 連 Supabase／Production／Preview 做寫入 |
| | 產出「拿去正式庫執行」的 SQL 檔 |
| | merge、deploy、進 POS-03 |

驗證本輪：`git diff` 相對 POS-01 branch **只能多這兩個 docs**。

---

## 2. Prerequisite blocker：Production migration drift

### 2.1 為什麼先擋住

`origin/main` 的 `prisma/migrations/` 最後一筆仍是 `20260729170000_refill_flavours_stock`。
Draft **PR #112–#115**（2026-08-14 事件）記錄：Production `_prisma_migrations` 另有 **12 筆已完成的 `202608*`**，repo **沒有**對應資料夾。

相關 Draft（皆未核准 merge／deploy）：

| PR | 用途 |
|----|------|
| #112 | 事故紀錄 |
| #113 | 往前對齊設計（不可 replay 已套用的 ledger） |
| #114 | 證據封存（byte 對 byte；**不是** active migration） |
| #115 | schema 能否表達 vs 能否放行 |

在這 4 個閘門關閉前，任何 POS 新表都可能：

- 撞到正式庫已有、repo 沒有的物件
- 讓 `migrate deploy` 以為要重放已套用的變更
- 把 drift 藏進 POS 遷移裡

**本提案判定：production migration drift ＝ POS-02 落庫的 prerequisite blocker。未解除前不得開始 expand。**

### 2.2 文件與程式也不完全一致（只記錄）

- `DEPLOY.md` 曾寫 build 會跑 `migrate deploy`。
- 現行 `package.json` build 是 `prisma generate && next build`（測試也鎖住「build 零寫入」）。
- 部分功能用 runtime DDL 補償（例如活動 schema ensure）。POS **不准**再走這條。

本輪不重寫那些舊文件。

---

## 3. Reconciliation（對齊）— 必須先做完

正式步驟（全部要**另開人工授權**才碰正式庫；本輪只定義，不執行）：

```text
1. Production ledger／schema 的 readonly snapshot
2. 與 repo migrations、prisma/schema.prisma 做三方 diff
3. 每筆分類：missing / applied / divergent / manual
4. 人工核准分類與處置
5. 只在 disposable Preview DB 演練（可丟棄）
6. 備妥 backup、forward-only、roll-forward、validation
7. 通過後才允許 POS expand 進入 Preview 演練
```

### 3.1 分類定義

| 類 | 意思 | 處置原則 |
|----|------|----------|
| missing | repo 有、正式 ledger 沒套 | 不可在正式庫「補跑舊檔」除非人工證明安全；優先 Preview |
| applied | 正式已套、repo 沒檔 | **不可 replay**。先補文件／baseline，不重跑 SQL |
| divergent | 兩邊都有但內容不同 | 停。人工比對。不准自動選一邊 |
| manual | 人手改過、或 runtime DDL | 進 quarantine 清單，POS 遷移不可依賴它自動消失 |

### 3.2 不可做

- 把 Production ledger reset 成跟 main 一樣
- 把 #114 證據 SQL 當 active migration 拿去 deploy
- 為了 POS 方便而 `db push` 正式庫
- 本輪產生「正式庫用」SQL

---

## 4. POS 落庫順序（drift 解除之後）

一律 **expand → backfill → verify → dual-read／shadow compare → cutover → 很久以後才 contract**。
每一步自己可往前修（roll-forward），不設計「把正式庫倒回前一版 schema」當主方案。

### 4.1 Expand（只加、不拆舊）

以後才允許的方向（仍須 Preview 演練＋正式人工 gate）：

- 新增 `Pos*` 表（空表、有 unique／FK）
- `MerchantStock` **加** `onHand`／`reserved`（先可 null 或與 `quantity` 雙寫）
- `Settlement` **加** 整數欄，Float 舊欄留下
- 點數 ledger **加** source type 與冪等，不改舊列語意
- **不**在 expand 刪 Float、不改 `commissionRate` 語意、不刪 `MerchantStockTxn`

加入 unique／composite 的順序：

1. 先加可空欄、新表、一般 index
2. backfill
3. verify 零 quarantine
4. 再加 `NOT NULL` 與複合 FK
5. 最後才加會擋寫入的 `UNIQUE`（先在 Preview 用驗證查詢證明沒有重複）

若先加 UNIQUE 再清資料，正式寫入會爆。

### 4.2 Backfill

- 舊 Float → 新 Int：只有**已經是整數**的值才能寫入新欄。
- `quantity` → `onHand`：僅當 `quantity >= 0`。負庫存進 quarantine，不自動改成 0。
- `reserved` 初始 0（舊系統沒有保留量）。
- Store↔Merchant：只寫 `MerchantStoreLinkAudit`，status＝`proposed` 或 `quarantined`。名稱相同**不是**核准。
- 豬窩 slot：保持 `UNDECIDED`／null。

### 4.3 Verify

每一批 backfill 要過：

- 新 Int 欄＝舊 Float 當且僅當 Float 為整數且與公式一致
- `onHand + 檢查 reserved` 與 ledger 重算一致（POS 新帳開始後）
- 無跨店 FK
- 無重複 idempotency key
- settlement 整數加總＝該期 POS snapshot 加總（shadow）

任一失敗：那一列進 quarantine，**整批不算過**。

### 4.4 Dual-read／shadow compare

- 讀：同時看舊 Float／舊 txn 與新 Int／`Pos*`，只記差異，不改正式結算出口
- 寫：POS 新成交**只寫 Pos\***；必要時投影給 HQ 看，但 HQ 舊結算仍讀舊 txn，直到 cutover 被核准
- 禁止「POS 寫 PosSale 又寫一筆 MerchantStockTxn 當第二套佣金真相」

### 4.5 Cutover

人工核准後：

- POS 與新結算**只信**整數 snapshot
- 舊 Float 改為唯讀相容
- `approved` 結算改走 POS 鎖定規則

### 4.6 以後才 Contract

- 刪舊 Float、刪 `quantity` 別名、加硬性 CHECK
- 必須在 cutover 穩定且 quarantine 清空之後
- **不是 POS-02 本輪，也不是 POS-03 預設工作**

---

## 5. Quarantine（隔離，不准自動修）

### 5.1 舊 Float

進 quarantine 的例子：

- `1000.1`、`299.999999`、`NaN` 類值
- `commissionAmount` 與 `round(成交×費率)` 對不上
- sale 有金額、佣金是 null，卻被舊程式用「現在的商品規則」重算過

**不得**為了讓 unique／NOT NULL 過關而自動 `Math.round`。

### 5.2 Store mapping

進 quarantine 的例子：

- 一個 Merchant 名稱對到多個 Store slug
- 一個 slug 對到多個 Merchant
- 只靠「豬窩」「妞妞」或其他中文店名對上
- Production 實際 `MER-xxxx` 與 repo 偏好編號不一致

處置：`MerchantStoreLinkAudit.status = quarantined`，等 HQ 人工。POS 核銷在對應核准前，不可用猜的 slug。

### 5.3 負庫存／壞 duplicate

- `MerchantStock.quantity < 0`：不自動歸零
- 同 idempotency key、fingerprint 不同：不取第一筆、不合併

---

## 6. Preview 演練 vs Production 人工 gate

### 6.1 Disposable Preview

drift 對齊方案與 POS expand，都必須先在**可丟棄**的 Preview／複本演練：

- 套用順序、失敗、重試
- unique 衝突
- backfill 後 verify 查詢
- 故意丟進非整數 Float、負庫存、同 key 不同 snapshot，確認會進 quarantine 而不是被 round

Preview 演練**不是**正式授權。

### 6.2 Production 人工 gate（本輪不得觸發）

以後若要動正式庫，每次都要獨立同意，至少包含：

1. drift reconciliation 已關閉（#112–#115 或後續核准替代）
2. Preview 演練紀錄
3. backup 完成
4. 變更範圍＝已核准的 expand（不可夾帶 contract 刪欄）
5. 回報與監控已接
6. 指定 roll-forward（修資料／補 migration），不是「倒回 Production」

本文件**不附**正式庫 SQL。

---

## 7. 監控（cutover 前後都要看）

| 訊號 | 為什麼 |
|------|--------|
| 負庫存（`available < 0`） | 違反 R4 |
| duplicate key／同 key 不同 fingerprint | 冪等被繞過或壞重送 |
| 跨店 reference | merchant 隔離失敗 |
| ledger 不平衡（方向加總對不上 snapshot） | 帳不平 |
| 累計退款 > 原成交 | 超額退款 |
| 佣金累計 ≠ 剩餘淨額公式 | 尾差或壞歷史 line |
| 已鎖期被改寫 | 違反 R5 |
| quarantine 列增加 | backfill／對應有問題 |
| `_prisma_migrations` 與 repo 再分岔 | drift 復發 |

本輪不接監控系統，只規定以後要有這些訊號。

---

## 8. 與 POS-01／本提案的對照

| 合約要求 | 遷移怎麼守 |
|----------|------------|
| 新財務不用 Float | 只在新欄／新表用 Int；舊 Float 共存到 contract |
| 月結只加總 snapshot | cutover 前 shadow 比對；cutover 後停用「重算整月」 |
| 庫存 aggregateId | 用既有 `MerchantStock.id`，不讓 client 指定 |
| 已鎖結算 | 應用層先擋刪 `approved`；DB 硬限制放 expand 後期 |
| O1 | 回庫／損耗是新 ledger op，不改舊 txn 當權威 |
| O3 | 不 backfill 豬窩正式 ID |

---

## 9. Roll-forward（不是 rollback Production）

若 Preview 或以後正式 expand 失敗：

- 停寫入新 POS 路徑
- 修 migration／修 quarantine 規則
- 再演練
- 不把正式庫 schema 倒回當主計畫（正式資料與 12 筆已套用 drift 無法安全 replay）

舊 HQ 結算在 cutover 前仍讀 `MerchantStockTxn`，所以 POS expand 失敗不應停止現行 HQ 月結——前提是沒有雙寫第二套佣金。

---

## 10. Checklist

| 項 | 結果 | 說明 |
|----|------|------|
| 本輪零 DB 變更 | **PASS** | 只新增 docs |
| drift 列為 blocker | **PASS** | §2；#112–#115 未關閉前不准 expand |
| 不產生正式 SQL | **PASS** | 無 SQL 檔、無 migrate |
| Float 不自動 round | **PASS** | §5.1 quarantine |
| Store 歧義 quarantine | **PASS** | §5.2 |
| 豬窩 ID 未猜 | **PASS** | slot 保持空 |
| unique 加入順序 | **PASS** | §4.1 |
| Preview → 人工 Production gate | **PASS** | §6 |
| 監控項目已列 | **PASS** | §7 |

---

## 11. 停止點

本輪交付到此。

- 不進 POS-03
- 不實作 Prisma
- 不對 Preview／Production 執行任何遷移
- 等待 drift 閘門與本設計的三方 review
