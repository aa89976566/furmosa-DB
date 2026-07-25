# 換罐計畫地基設計：Location × Program SKU × 庫存事件

> 狀態：設計凍結草案（可直接對應 Prisma schema / migration）  
> 範圍：先定契約，再開功能（營運台閉環、Dashboard、店家 Portal／POS）  
> 對齊系統：Furmosa HQ（寄賣履約 + LINE 換罐忠誠）

---

## 用語對照（台灣現場）

| 文件／程式內部 | 現場說法 | 意思 |
|----------------|----------|------|
| 存罐／序號入點（舊稱「返航」） | **存罐**、掃序號入點 | 客人傳空罐 8 碼序號，換點數 |
| 開戶 | **幫毛孩開戶** | LINE 完成註冊，並選定合作店 |
| 開戶店／signupLocation | **開戶合作店** | 開戶時綁定的那一家店（之後扣庫存、核銷都認這家） |
| jar_redeem 事件 | 存罐扣庫 | 存罐成功後，從開戶店在店庫存扣 1 |

> 文件其餘段落若仍出現「返航」，一律等同「存罐／序號入點」。

---

## 0. 一句話憲法

1. **一間實體店只有一個 Location 真相**（寄賣、開戶、核銷、未來 POS 都掛這裡）。  
2. **換罐商品靠硬標記，不靠名稱前綴「換罐」**。  
3. **每一筆真實事件只寫一條庫存流水**；Dashboard／一鍵補貨只能讀這些流水的結果，不能另造算法當帳本。  
4. **沒開戶就不能累點**：未完成開戶（含未綁開戶合作店）傳序號 → **不給點、不消耗序號**，引導去開戶。

---

## 1. 目標與非目標

### 目標（本設計必須回答）

| 問題 | 答案必須明確 |
|------|----------------|
| 客人開戶綁的是哪一店？ | Location FK，可對到寄賣庫存與核銷 |
| 這組序號對應哪個商品？ | 必填 Product（SKU） |
| 存罐時扣誰的庫存？ | 扣開戶合作店的在店庫存 |
| 沒開戶就傳序號？ | **不累點、序號維持未使用**，引導開戶 |
| 補貨／售出／存罐／盤點怎麼入帳？ | 統一 `StockEvent` 語意（可先映射到現有 `MerchantStockTxn`） |
| 未來 POS 怎麼接？ | 只吃「事件」，不直接改餘額 |

### 非目標（本階段不做）

- 接第三方 POS SDK／硬體  
- 重寫整套寄賣結算  
- 合併美容券與 Reward 目錄為單一引擎（另案）  
- HQ 總倉自動扣帳（可預留事件，但本階段不強制實作）  
- 多幣別、發票、金流對帳

---

## 2. 現況問題（為何要先設計）

| 現況 | 風險 |
|------|------|
| `Merchant`（寄賣）與 `Store`（核銷）雙主檔，靠 slug 同步 | 店名／slug 漂移；開戶字串難追溯 |
| `Customer.signupStore` / `storeId` / `storeName` 無 FK | 改名、併店後對帳斷裂 |
| `JarCode.productSku` 可空；批量產生不寫 SKU | 返航定價／扣庫存猜商品 |
| 換罐商品靠 `name.startsWith('換罐')` | 主檔一改規則全壞 |
| `redeemJarCode` 不扣 `MerchantStock`，Order.`merchantId=null` | 營運台水位會漂 |
| 舊資料可能有會員卻沒綁開戶店 | 若不擋，無法決定扣哪家店的貨 |
| 一鍵補貨 `weightGrams=null` 可能落入錯誤 tier | 多規格商品帳面假缺／假多 |

---

## 3. Location（通路主檔）

### 3.1 決策

**採「Merchant 為實體 Location 真相；Store 降級為核銷憑證投影」**，不做第三張平行主檔。

理由：

- 寄賣庫存、出貨、結算已全部掛在 `Merchant`  
- `Store` 目前僅服務 LINE 開戶清單與核銷 URL（slug + secretToken）  
- 新增第三張 `Location` 表會造成三主檔，遷移成本過高  

### 3.2 目標模型

```
Merchant（Location 真相）
  ├── roles[]：consignment | jar_exchange | pop_up | flagship | partner
  ├── redeemProfile（1:1 投影，取代鬆散 Store 同步）
  │     ├── slug（對外核銷／開戶代碼）
  │     ├── secretToken
  │     └── groomingDiscountAmount（可選覆寫）
  └── stocks / shipments / settlements …

Customer
  ├── signupLocationId → Merchant.id   （FK，永久綁定）
  ├── signupStore / storeId / storeName （過渡期保留，只讀／回填）
```

### 3.3 Schema 變更（建議）

```prisma
// Merchant：既有 types[] 繼續當 roles；新增核銷投影關聯
model Merchant {
  // ...existing fields...
  redeemProfile MerchantRedeemProfile?
  signupCustomers Customer[] @relation("CustomerSignupLocation")
}

/// 核銷／開戶用投影（原 Store 的職責收斂至此）
model MerchantRedeemProfile {
  id                      String   @id @default(cuid())
  merchantId              String   @unique @map("merchant_id")
  slug                    String   @unique
  secretToken             String   @map("secret_token")
  groomingDiscountAmount  Float?   @map("grooming_discount_amount")
  active                  Boolean  @default(true)
  createdAt               DateTime @default(now()) @map("created_at")
  updatedAt               DateTime @updatedAt @map("updated_at")

  merchant Merchant @relation(fields: [merchantId], references: [id], onDelete: Cascade)

  @@map("merchant_redeem_profiles")
}

model Customer {
  // ...existing fields...
  signupLocationId String? @map("signup_location_id")
  signupLocation   Merchant? @relation("CustomerSignupLocation", fields: [signupLocationId], references: [id], onDelete: SetNull)

  // 過渡期保留：
  // signupStore / storeId / storeName
}
```

### 3.4 遷移策略（不中斷 LINE）

| Step | 動作 |
|------|------|
| M1 | 新增 `merchant_redeem_profiles`；由現有 `stores` + `jar_exchange` merchants backfill |
| M2 | `Customer.signupLocationId` backfill：`storeId`(slug) → profile.slug → merchantId |
| M3 | 寫入路徑改寫：開戶／核銷只認 Merchant + RedeemProfile |
| M4 | 讀取相容：舊 `stores` 表改為 view 或 dual-write，穩定後標記 deprecated |
| M5 | 停止寫入 `stores`；文件宣告 Store 表只讀 |

**Slug 規則（凍結）：** `MER-0001` → `mer_0001`（維持現有 `merchantToStoreSlug`）。

### 3.5 解析函式契約

```ts
/** 開戶／返航扣庫存用：customer → Location(Merchant) */
resolveSignupLocation(customerId): Merchant | null

/** 核銷頁：slug → Merchant + RedeemProfile */
resolveLocationByRedeemSlug(slug): { merchant, profile } | null

/** 僅當 types 含 jar_exchange 且 profile.active 才可開戶／核銷 */
assertJarExchangeLocation(merchant): void
```

---

## 4. Program SKU（換罐商品主檔）

### 4.1 決策（已落地於現有欄位）

**不另加 `isJarExchange` boolean。** 系統已有：

```ts
Product.productCategory === 'JAR_EXCHANGE'
```

（見 `lib/product-category.ts`、migration `20260723130000_restock_request`）

營運台／一鍵補貨／序號產生／營收過濾一律查：

```ts
where: { status: 'active', productCategory: 'JAR_EXCHANGE' }
```

名稱前綴「換罐」僅為歷史回填／顯示慣例，**不再是唯一真相**。

### 4.2 JarCode 契約

```prisma
model JarCode {
  id                   String    @id @default(cuid())
  code                 String    @unique
  batchNo              String?   @map("batch_no")
  productId            String    @map("product_id") // 新：必填 FK
  productSku           String    @map("product_sku") // 冗餘快取，與 Product.sku 同步
  tierId               String?   @map("tier_id") // 可選：綁定規格；空=legacy 合計列
  pointValue           Int       @default(1)
  status               String    @default("unused") // unused | used | expired
  redeemedByCustomerId String?
  redeemedAt           DateTime?
  /// 實際扣庫存的 Location（返航當下快照）
  redeemedLocationId   String?   @map("redeemed_location_id")
  createdAt            DateTime  @default(now())

  product            Product   @relation(...)
  redeemedByCustomer Customer? @relation(...)
  redeemedLocation   Merchant? @relation(...)
}
```

**規則：**

| 動作 | 規則 |
|------|------|
| 批量產生序號 | 必須選 `Product`（`productCategory=JAR_EXCHANGE`） |
| 手動建序號 | 同上；禁止自由文字 SKU 不驗證 |
| 既有 `productSku` 為空的碼 | 遷移期標 `needs_sku`；返航前必須補齊或走「指定預設商品」管理動作 |
| 返航定價 | 只看 `productId`（及可選 tier），禁止再 fallback「第一個換罐*」 |

### 4.3 過渡期相容

1. `productCategory=JAR_EXCHANGE` 已由既有 migration 回填（名稱曾以「換罐」開頭者）。  
2. `JarCode.productId` 先可空 → 資料修完後改 NOT NULL。  
3. 新產生／匯入序號必須綁定 JAR_EXCHANGE 商品。

---

## 5. 庫存事件（Stock Event）

### 5.1 決策

**不立刻新建平行餘額表。**  
以現有 `MerchantStock` + `MerchantStockTxn` 為店庫帳本，先**凍結事件語意與寫入規則**；未來 POS／Portal 只產生事件，由同一 writer 入帳。

HQ 總倉（`InventoryBalance`）本階段：

- 補貨出貨：**建議**記一筆 `InventoryTransaction`（銷售出庫／調撥出庫），但可不阻擋出貨  
- 若總倉不足：警告，不硬擋（避免癱瘓現有流程）→ 下階段再改硬擋

### 5.2 事件目錄（語意凍結）

| eventType | 方向 | 觸發點 | 對應 txn.type | 備註 |
|-----------|------|--------|---------------|------|
| `restock_received` | + | Shipment `merchant_restock` → delivered | `restock` | 已存在 |
| `store_sale` | − | 店家現場售出（HQ 或未來 Portal） | `sale` | 已存在；可進結算 |
| `jar_redeem` | − | LINE／後台序號返航 | `sale` 或新值 `jar_redeem` | **新增必做** |
| `adjust_count` | ± | 盤點 | `adjust` | 已存在 |
| `return_to_hq` | − | 退回公司 | `return` | 已存在 |
| `pos_sale`（預留） | − | 外部 POS webhook | `sale` | source=`pos` |

建議在 `MerchantStockTxn` 增加：

```prisma
model MerchantStockTxn {
  // ...existing...
  /// 業務事件：restock_received | store_sale | jar_redeem | adjust_count | return_to_hq | pos_sale
  eventType   String?  @map("event_type")
  /// 來源系統：hq | line | store_portal | pos | cron
  sourceSystem String  @default("hq") @map("source_system")
  /// 冪等鍵：同一外部事件只入帳一次
  idempotencyKey String? @unique @map("idempotency_key")
}
```

### 5.3 存罐扣庫（P1 核心規則）— 已拍板

**開戶門檻（產品決策）：**

| 狀況 | 系統行為 |
|------|----------|
| LINE 尚未開戶（查無會員） | **不累點**；序號不消耗；回覆引導「請先幫毛孩開戶」 |
| 已有會員但沒綁開戶合作店（`signupLocationId` 空） | **不累點**；序號不消耗；引導補完開戶／選店 |
| 已開戶且有開戶店 | 才進入存罐入點＋扣庫存 |

> 重點：沒開好戶就傳序號，**點數一個都不會加**，也**不要先把序號標成已使用**（避免客人開完戶卻序號蒸發）。

```
redeemJarCode(customer, code):
  0. 若無 customer → 拒絕，引導開戶（LINE 既有）
  0b. location = customer.signupLocationId
       若空 → 拒絕入點（不 claim 序號），回覆引導完成開戶／選店
  1. claim JarCode (unused → used)  // 原子更新
  2. product = jarCode.productId（必填）
  3. tierId = jarCode.tierId ?? LEGACY
  4. 寫 MerchantStockTxn:
       eventType=jar_redeem
       sourceSystem=line|hq
       idempotencyKey=`jar_redeem:${jarCode.id}`
       quantity=-1（或依包裝規則）
  5. 更新 MerchantStock.quantity
       若結果 < 0 → 仍成功入點，但寫警示（營運台可見）
  6. 記點數 +（可選）jar_exchange Order，Order.merchantId=location.id
```

**店家庫存不足（已拍板）：**

| 決策 | 行為 |
|------|------|
| 存罐／給點 | **照常成功**（客人體驗不卡） |
| 庫存 | 允許變負數 |
| 後台 | **一定要警示**（哪一店、哪一品、目前數量），催盤點或補貨 |

### 5.4 冪等

所有外部可重送事件必須帶 `idempotencyKey`：

- 存罐：`jar_redeem:{jarCodeId}`  
- POS：`pos_sale:{posTxnId}`  
- 出貨入庫：既有 delivered 入庫邏輯需確認只跑一次（維持現狀並補測試）

### 5.5 一鍵補貨規則（與事件對齊）

| 項目 | 規則 |
|------|------|
| 可補商品 | `Product.productCategory=JAR_EXCHANGE` |
| 建議量 | `qty <= lowThreshold(3)` → 補到 `target(6)`（可後改設定表） |
| 規格 | 單規格自動帶；**多規格必須選 tier**，禁止 `weightGrams=null` 瞎猜 |
| 地址 | `address` 或 7-11 取件資料缺一不可 → 拒絕一鍵，導手動進貨 |
| 入帳時機 | 仍為 delivered → `restock_received`（不改） |

---

## 6. 未來 POS／店家 Portal 介面（只設計契約）

### 6.1 原則

店家端與 POS **不得直接 UPDATE 餘額**；只能投稿事件：

```http
POST /api/partner/stock-events
Authorization: Bearer <location token>
Idempotency-Key: <unique>

{
  "eventType": "pos_sale" | "adjust_count" | "store_sale",
  "productSku": "SKU-xxxxx",
  "tierId": null,
  "quantity": -1,
  "occurredAt": "2026-07-25T12:00:00+08:00",
  "externalRef": "POS-12345",
  "note": "optional"
}
```

伺服端：驗證 Location → 轉 `MerchantStockTxn` writer → 回傳 `balanceAfter`。

### 6.2 階段

| 階段 | 交付 |
|------|------|
| Portal v1 | `/store-redeem` 擴充：本店換罐庫存唯讀 + 回報售出（走同一 writer） |
| POS v1 | 上列 stock-events API + 簽章／token |
| POS v2 | 銷售含金額回傳、對帳報表 |

---

## 7. Dashboard 資訊架構（依本契約重排）

Dashboard **只導航三條線**，細節進專頁：

| 區塊 | 資料來源（契約後） | 主 CTA |
|------|---------------------|--------|
| 今日要做 | 出貨隊列、今日任務、總倉低庫存 | `/shipments`、`/tasks` |
| 錢從哪來 | 營收合格訂單、來源、寄賣排行 | `/orders` |
| 換罐怎麼了 | Location 店庫（JAR_EXCHANGE）、在途補貨、本週存罐數、核銷數、負庫存警示 | `/jar-exchange/ops` |

營運台數字定義：

- **在店庫存** = `MerchantStock` where product.productCategory=JAR_EXCHANGE  
- **本週存罐** = count `MerchantStockTxn.eventType=jar_redeem`（或 JarCode.redeemedAt）同週  
- **低庫存／缺貨警示** = location × jar SKU，qty≤3；**負庫存另標紅**  
- **在途** = jar location 的 `merchant_restock` in pending/packed/shipped  

禁止再用「點數流水人數」冒充店營運健康度（可保留為次級指標）。

---

## 8. 實作里程碑（建議順序）

### Milestone A — Schema 與回填

- [x] Program SKU：沿用 `Product.productCategory = JAR_EXCHANGE`（不必新欄位）  
- [x] `MerchantRedeemProfile` + sync／backfill  
- [x] `Customer.signupLocationId` + backfill script  
- [x] `JarCode.productId` 可空欄位 + 盡力 backfill  
- [x] `MerchantStockTxn.eventType` / `sourceSystem` / `idempotencyKey`

### Milestone B — 寫入路徑改契約

- [ ] 序號產生強制選換罐商品  
- [ ] 開戶寫 `signupLocationId`  
- [ ] 核銷改走 RedeemProfile  
- [ ] 營運台改查 `productCategory=JAR_EXCHANGE`

### Milestone C — 存罐扣庫閉環

- [ ] 未開戶／未綁開戶店：拒絕入點、不消耗序號、引導開戶  
- [ ] `redeemJarCode` 寫 `jar_redeem` txn + 扣庫  
- [ ] Order.merchantId = location  
- [ ] 負庫存警示上營運台  
- [ ] 單元／整合測試：冪等、未開戶、未綁店、無 SKU、負庫存仍入點

### Milestone D — 補貨與 Dashboard 硬化

- [ ] 一鍵補貨：地址必填、多規格必選  
- [ ] Dashboard 三區塊 IA  
- [ ] 廢棄名稱前綴唯一判斷

### Milestone E — Portal／POS 契約

- [ ] stock-events API  
- [ ] store-redeem 庫存唯讀 + 回報售出  

---

## 9. 建議 Prisma migration 草圖（Milestone A）

```sql
-- 1) products
ALTER TABLE "Product" ADD COLUMN "is_jar_exchange" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "jar_default_point_value" INTEGER NOT NULL DEFAULT 1;
UPDATE "Product" SET "is_jar_exchange" = true WHERE "name" LIKE '換罐%';

-- 2) merchant_redeem_profiles（從 stores 回填的應用層腳本另做）
CREATE TABLE "merchant_redeem_profiles" (
  "id" TEXT PRIMARY KEY,
  "merchant_id" TEXT NOT NULL UNIQUE REFERENCES "Merchant"("id") ON DELETE CASCADE,
  "slug" TEXT NOT NULL UNIQUE,
  "secret_token" TEXT NOT NULL,
  "grooming_discount_amount" DOUBLE PRECISION,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);

-- 3) customers
ALTER TABLE "Customer" ADD COLUMN "signup_location_id" TEXT
  REFERENCES "Merchant"("id") ON DELETE SET NULL;
CREATE INDEX ON "Customer"("signup_location_id");

-- 4) jar_codes
ALTER TABLE "jar_codes" ADD COLUMN "product_id" TEXT;
ALTER TABLE "jar_codes" ADD COLUMN "tier_id" TEXT;
ALTER TABLE "jar_codes" ADD COLUMN "redeemed_location_id" TEXT;
-- product_sku：既有可空 → 應用層補齊後再 SET NOT NULL

-- 5) merchant stock txns
ALTER TABLE "MerchantStockTxn" ADD COLUMN "event_type" TEXT;
ALTER TABLE "MerchantStockTxn" ADD COLUMN "source_system" TEXT NOT NULL DEFAULT 'hq';
ALTER TABLE "MerchantStockTxn" ADD COLUMN "idempotency_key" TEXT UNIQUE;
```

> 實際 migration 檔名／Postgres 型別以 repo 既有風格為準；回填腳本放 `scripts/backfill-jar-location-sku.ts`。

---

## 10. 驗收標準（Definition of Done）

### 主檔

- [ ] 每個 `jar_exchange` Merchant 恰有 1 筆 active RedeemProfile  
- [ ] 新開戶 Customer 必有 `signupLocationId`  
- [ ] 新產生 JarCode 必有 `productId` 且商品 `productCategory=JAR_EXCHANGE`

### 庫存與開戶

- [ ] 未開戶／未綁開戶店傳序號：0 點、序號仍 unused、有引導文案  
- [ ] 同序號重送存罐不會雙扣（idempotency）  
- [ ] 存罐後該開戶店該 SKU 庫存 −1（或規定量）  
- [ ] 庫存不足時仍入點，營運台出現警示  
- [ ] 營運台數字 = 上述流水聚合，無第二套算法

### 補貨

- [ ] 缺地址無法一鍵補貨  
- [ ] 多規格未選 tier 無法一鍵補貨  

### 文件

- [ ] README 模組路徑與本設計一致  
- [ ] 宣告「換罐前綴」僅顯示慣例  

---

## 11. 產品決策狀態

| # | 問題 | 決策 |
|---|------|------|
| 1 | 店家庫存不夠，客人還能存罐嗎？ | **可以入點**；庫存可變負；**後台一定警示** |
| 2 | 沒開戶（或沒綁開戶合作店）傳序號？ | **不能累點**；序號不消耗；**引導開戶／選店** |
| 3 | 一罐對應多規格時預設哪檔？ | 序號產生時必選；舊碼人工補（仍待執行細節） |
| 4 | `stores` 表廢除時程？ | Milestone B 後 dual-write 一週，再只讀（仍待執行） |
| 5 | 存罐扣庫是否算進寄賣月結銷售？ | **否**（與店內現場售出分開；存罐另有換罐營收／行銷成本語意） |

---

## 12. 總結

本設計把系統提升的地基收成三件事：

1. **Location** = Merchant + RedeemProfile（消滅 Store／開戶字串雙軌）  
2. **Program SKU** = `Product.productCategory=JAR_EXCHANGE` + 序號必綁商品  
3. **Stock Event** = 統一寫入 `MerchantStockTxn`（存罐／售出／POS 同一條路）  

再加上已拍板的體驗規則：**先開戶才能存罐累點；庫存不足不擋客人，但一定警示後台。**

做完 A→C，營運台與 Dashboard 才有資格被稱為「可日結的換罐營運」；POS 只是事件投稿者，不是另一套庫存真相。
