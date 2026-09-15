# 補貨單 0008 規格修正 - 執行指南

## 目前狀態
- **Sandbox Branch**: `sandbox/2f0a2177-5350-41a0-ac6e--6iyu`
- **Commit 1 (b960b3b)**: RestockRequestItem 規格欄位支援 & 驗證邏輯 (10 檔案修改)
- **Commit 2 (fbea691)**: 補貨單 0008 精準 migration + 安全測試 (2 檔案新增)
- **Status**: 已 commit,尚未 push/merge/deploy

## 執行步驟

### 1️⃣ 執行前驗證 (Production DB 檢查清單)

在執行 migration 前,請在 production Supabase 執行以下查詢確認數據:

```sql
-- 查詢補貨單 0008 現狀
SELECT 
  s.id as shipment_id,
  s.shipment_number,
  m.name as merchant_name,
  si.id as shipment_item_id,
  si.product_name,
  si.quantity,
  si.weight_grams as current_weight,
  COUNT(*) OVER (PARTITION BY s.id) as item_count
FROM shipments s
JOIN shipment_items si ON s.id = si.shipment_id
JOIN merchants m ON s.merchant_id = m.id
WHERE s.shipment_number LIKE '%0008'
  AND s.type = 'merchant_restock'
ORDER BY s.shipment_number, si.product_name;
```

**預期結果** (必須全部滿足,否則 migration 會 ROLLBACK):
- shipment_number: `SHP-202609-0008` (或當月 0008)
- merchant_name: `泡泡堂`
- 四個品項:
  - product_name=`原味雞霸`, quantity=`4`, current_weight=`NULL`
  - product_name=`豬耳朵條`, quantity=`3`, current_weight=`NULL`
  - product_name=`雞肉南瓜乾`, quantity=`3`, current_weight=`NULL`
  - product_name=`鴨喉嚨`, quantity=`4`, current_weight=`NULL`
- item_count: `4` (恰好 4 個品項)

### 2️⃣ Migration 執行 (Prisma Migrate)

```bash
# 推送 sandbox branch 到 GitHub
git push origin sandbox/2f0a2177-5350-41a0-ac6e--6iyu

# 在本地或 CI/CD 環境執行 migration
# 確保 DATABASE_URL 和 DIRECT_URL 都指向 production Supabase

npx prisma migrate deploy
```

Migration 檔案位置: `prisma/migrations/20260915_update_restock_0008_weight_grams_50g/migration.sql`

**Migration 做了什麼:**
- 檢驗店家 = '泡泡堂'
- 檢驗補貨單編號 = SHP-YYYYMM-0008
- 檢驗品項數 = 4 + 四個品項名稱與數量精準吻合
- 若任何條件失敗 → EXCEPTION + ROLLBACK (零修改)
- 若全部通過 → UPDATE weight_grams = 50 (RestockRequestItem & ShipmentItem)
- 執行後再次驗證修改了恰好 4 條記錄

### 3️⃣ Migration 後驗證 (Production DB 檢查)

Migration 執行成功後,執行同樣的查詢確認修改:

```sql
-- 查詢修改後結果
SELECT 
  s.id as shipment_id,
  s.shipment_number,
  m.name as merchant_name,
  si.id as shipment_item_id,
  si.product_name,
  si.quantity,
  si.weight_grams as updated_weight
FROM shipments s
JOIN shipment_items si ON s.id = si.shipment_id
JOIN merchants m ON s.merchant_id = m.id
WHERE s.shipment_number LIKE '%0008'
  AND s.type = 'merchant_restock'
ORDER BY s.shipment_number, si.product_name;
```

**預期結果:**
- 四個品項的 updated_weight 都應是 `50`
- quantity 保持不變 (4, 3, 3, 4)
- 其他欄位無變化

### 4️⃣ 檢查 RestockRequestItem 修改

```sql
-- 驗證 RestockRequestItem 同步修改
SELECT 
  rri.id as restock_item_id,
  p.name as product_name,
  rri.requested_quantity,
  rri.approved_quantity,
  rri.weight_grams as updated_weight
FROM restock_request_items rri
JOIN restock_requests rr ON rri.restock_request_id = rr.id
JOIN products p ON rri.product_id = p.id
JOIN shipments s ON rr.shipment_id = s.id
WHERE s.shipment_number LIKE '%0008'
  AND s.type = 'merchant_restock';
```

**預期結果:**
- 四個品項的 weight_grams 都應是 `50`

### 5️⃣ Merge to Main & Deploy

Migration 確認成功後:

```bash
# 創建 PR: sandbox branch → main
gh pr create --base main --head sandbox/2f0a2177-5350-41a0-ac6e--6iyu \
  --title "feat: 補貨單規格支援與 0008 修正" \
  --body "
- RestockRequestItem 新增 weightGrams 欄位,支援多規格商品選擇與驗證
- SELF_SELECT 補貨申請強制多規格商品選擇規格
- HQ/POS 顯示規格標籤(如'原味雞霸 50g')
- 精準 migration 修正補貨單 0008 四個品項為 50g
- Migration Fail-Safe 設計:條件不符全部 ROLLBACK
"

# 或手動在 Railway/GitHub UI 創建 PR

# Approve & Merge (after code review)

# Deploy to production (Railway UI 或 CI/CD)
```

## 資料保護機制說明

Migration 使用 **Fail-Safe** 原則,確保:

✓ **條件檢驗**:
  - 店家名稱 = '泡泡堂'
  - shipmentNumber 格式 = `SHP-\d{6}-0008`
  - 品項數 = 4
  - 四個品項名稱與數量精準吻合

✓ **Transaction 原子性**:
  - BEGIN...COMMIT + EXCEPTION 處理
  - 任何驗證失敗 → ROLLBACK 整個 transaction
  - 不會出現「修改一部分,另一部分失敗」

✓ **數據完整性**:
  - 只修改 weightGrams,不觸及 quantity
  - 不修改訂單編號、店家、日期等關鍵欄位
  - RestockRequestItem 與 ShipmentItem 同步修改

✓ **邊界條件**:
  - 多個 0008 補貨單 → 全部修改(若都符合條件)
  - 缺失品項或數量錯誤 → 全部 ROLLBACK
  - 重複執行 migration → 冪等(已是 50 不重複修改)

## 測試清單

測試文件: `lib/restock-request/__tests__/restock-0008-migration-safety.test.ts` (20 項測試點)

運行測試:
```bash
npm test -- lib/restock-request/__tests__/restock-0008-migration-safety.test.ts
```

## 回滾計劃

若 migration 失敗或需要回滾:

```bash
# 回滾最後一個 migration
npx prisma migrate resolve --rolled-back 20260915_update_restock_0008_weight_grams_50g

# 或使用 Supabase UI 手動執行反向 SQL:
# UPDATE restock_request_items SET weight_grams = NULL WHERE weight_grams = 50
# UPDATE shipment_items SET weight_grams = NULL WHERE weight_grams = 50
```

## 時間表

| 步驟 | 工作 | 時間 |
|------|------|------|
| 1 | 執行前驗證(查詢 DB) | 5 分鐘 |
| 2 | Migration 執行 | 2-5 分鐘 |
| 3 | 驗證修改結果 | 5 分鐘 |
| 4 | Code review & Merge | 15-30 分鐘 |
| 5 | Deploy to Production | 5-10 分鐘 |
| **總計** | | **30-60 分鐘** |

---

**準備就緒。等待執行指令。**

