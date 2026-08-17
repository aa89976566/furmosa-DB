# POS-01 Domain Contract

> **地位：** POS 帳務／庫存／美容券／結算的單一領域合約（可執行純函式對齊本文件）
> **版本：** v1.2
> **日期：** 2026-08-17
> **基準：** `origin/main` @ `bbe580975af62476d62884813ad8b73bf2984b96`
> **範圍：** 規格 + `lib/pos/domain-contract.ts` 純函式。**不含** schema、migration、UI、API、DB 寫入、runtime caller、部署
> **對齊：** 既有憲法見 `docs/FURMOSA-OS-DOMAIN-SPEC-v1.md`；本文件凍結 POS 帳務方向與結算鎖定。衝突時，本合約的「已確認規則」優先，且不得猜未決事項
> **下一步：** 三方 review 通過前不得進入 POS-02

---

## 0. 這份文件在做什麼

Furmosa 店家 POS 之後會處理寄賣銷售、LINE／綠界收款、庫存、美容券與月結。
若金額、方向或狀態各寫各的，結算會算錯。

本合約先把「可以做／不可以做」寫死，並用**不連資料庫的純函式**對齊。
**現有 Production 行為零改變**：沒有任何頁面、API 或排程會呼叫這份模組。

---

## 1. 已確認規則（Frozen）

| ID | 規則 |
|----|------|
| R1 | Phase 1 每個實體門市一個 **active** POS 帳號。schema **不必**封死未來多帳號。 |
| R2 | 目前所有補貨均為**寄賣**；店內交易由**店家收款**。 |
| R3 | 一般佣金率按**店家設定**，同店不同商品不使用不同百分比。每張 completed sale **line** 依該 line **實際成交總額**算一次，並永久 snapshot rate／amount。退款 line 另存 `commissionReversalSnapshot`。本筆回沖＝原 commission snapshot − 退後剩餘淨額依原 rate 應得佣金 − 既有已回沖；**不得**每筆只做 `round(退款×rate)`。全額退完時累計回沖必須精準等於原 snapshot，過程不可超退。月結**只加總 snapshot**。 |
| R4 | **嚴禁負庫存**。`available = onHand - reserved`，且不可為負。低庫存可一鍵補貨；**只有出貨 `delivered` 才增加店庫存**。 |
| R5 | 已 `approved` 的結算 **lines／amounts 永久鎖定、不重開**。只允許 `approved → paid` 並寫付款 metadata。錯誤以**次期 adjustment** 處理。 |
| R6 | 店家可提出額外加減款，**HQ 核准**；店員不可改佣金或結算。 |
| R7 | LINE／綠界由 Furmosa 收款的指定門市訂單，該店仍取得**普通佣金**；必須和店收現金使用**不同帳務方向**。退款／沖銷必須產生**相反方向**的債權與佣金回沖。 |
| R8 | 美容券**完全獨立於商品**。取消申請的 `voucherId` 必須等於被取消券。HQ 核准產生不可變、冪等的點數 +10 與固定補貼 reversal line（正整數金額；方向表達債權；引用 redemptionId／voucherId／actor／reason／idempotencyKey）。原補貼未鎖定：`merchant_owes_hq` 抵銷原 `hq_owes_merchant`。原補貼已進 approved／paid：原期不改，次期 `merchant_owes_hq` adjustment。重試不得重複退點或沖補貼。拒絕後券保持 `redeemed`。自然過期不退點。未知 tier throw。 |
| R9 | 未付款 checkout／payment intent **24 小時**失效；未付款**不** reserve。付款成功才進 `paid_reserved` 並原子 reserve。`paid_reserved` **不**自動 expire／退款／釋放；逾期未領轉客服。 |
| R10 | 完成交易、核銷、結算**不可 update/delete 原事實**，只能 reversal／adjustment。原 `completed` sale **永不修改或刪除**。`amountTwd` 是財務 fully_reversed 的唯一完成條件；quantity 只表示實物／庫存，不阻擋金額全退。 |

### 1.1 安全（實作時必須遵守，本階段只寫進合約）

- **所有 client input 皆不可信。**
- Client 可以提交 `actualUnitPriceTwd`、退款請求數量與金額，當**業務輸入**。
- Server 必須重查／自行計算：商品、庫存、原交易、可退上限、`merchantId`、`collectionChannel`、`commission`／rate／amount、`direction`、`paymentStatus`、`voucherAmount`／tier／face、結算狀態與路由。完整清單見 `SERVER_MUST_RESOLVE_FIELDS`。
- 佣金與帳務方向**只由 server 算**。
- 不用 Float 建立新財務真相。中間值或結果超出 safe-integer 必須 throw。
- 不按中文店名辨識豬窩。豬窩只能使用待確認的 immutable IDs（O3）。
- 不把美容券當商品折價券。
- `collectionChannel`、`voucherTier`、`actor`、所有 status 都有 runtime allow-list；未知或大小寫不符**一律 throw**，不可 fallback。
- **沒有**「標 `source: 'server'` 就算已驗證」這種檢查。任何此類標記都**不能**宣稱能驗來源。

---

## 2. 尚未決定（OPEN — 不得猜測）

| ID | 項目 | 為什麼不能猜 |
|----|------|----------------|
| O1 | **退款是否回庫、以及回庫原因** | 回庫會改 `onHand`，猜錯會造成負庫存或重複入庫 |
| O3 | **豬窩三店正式 immutable IDs** | 禁止用「豬窩」店名比對；正式 ID 未定前，券額只能用明確的面額層級（`standard_200`／`zhuwo_250`） |

未付款 24 小時失效、已付款不自動 expire，已凍結（R9），**不要**和逾期未領客服規則混為一談。
這兩項 OPEN 在程式裡以 `POS_01_OPEN_DECISIONS` 標註。任何函式都**不得**假裝已決定。

---

## 3. Canonical 狀態與轉移（allow-list）

未列出的轉移一律拒絕。
**同一狀態再轉一次（from === to）視為重複轉移，拒絕。**
未知狀態 throw。終態不可再改寫原事實。

### 3.1 收款通道 `CollectionChannel`

| 值 | 意思 |
|----|------|
| `merchant_collected` | 店家收款（店內現金等） |
| `furmosa_collected_line_ecpay` | LINE／綠界由 Furmosa 收款 |

### 3.2 帳本方向／種類

| `LedgerDirection` | 意思 |
|-------------------|------|
| `merchant_owes_hq` | 店家欠總部 |
| `hq_owes_merchant` | 總部欠店家 |

| `LedgerKind` | 意思 |
|--------------|------|
| `ordinary_commission` | 一般寄賣佣金（sale line snapshot） |
| `voucher_fixed_subsidy` | 美容券固定補貼（不計普通佣金） |
| `merchant_proposed_adjustment` | 店家提出、HQ 核准的額外加減款 |
| `next_period_adjustment` | 已鎖結算的差異，記入次期 |
| `reversal` | 沖正一筆已完成事實（另寫新紀錄，不改舊列） |

### 3.3 銷售 `SaleStatus`（原列）

```text
draft → completed | cancelled
completed → （終態，永不改、永不刪）
cancelled → （終態）
```

`fully_reversed` **不是**可寫回原 sale 的狀態。它是依退款 line **投影**出來的：

| 投影 | 條件 |
|------|------|
| `not_reversed` | 尚無退款 |
| `partially_reversed` | 已退一部分，未達原可退餘額 |
| `fully_reversed` | 累計 `amountTwd` 用盡原成交額。quantity 不參與此判斷 |

### 3.4 退款／沖銷 line contract

原 completed sale 與佣金 snapshot 永久不改。每一筆退款是**新 line**：

| 欄位 | 誰決定 |
|------|--------|
| `originalSaleId` | server（原交易） |
| `amountTwd` | 財務 reversal 的**唯一完成條件**；client 可請求，server 驗整數與上限 |
| `quantity` | 只表示實物退回／庫存處理；不得阻止金額全退後 `fully_reversed` |
| `originalCollectionChannel` | server 從原 sale；runtime 未知值一律 throw |
| `originalCommissionRateSnapshot` | server 從原 sale snapshot |
| `commissionReversalSnapshot` | server 用剩餘淨額算法寫入 |
| `idempotencyKey` | 同 key＋完整相同 fingerprint → 回既有 line／`duplicate=true`。saleId／amount／quantity／channel／rate 任一不同 → throw |

佣金回沖＝原 commission snapshot − `round(退後剩餘淨額 × 原 rate)` − 既有已回沖。
累計金額不超原 gross；有提供 quantity 時不超原 quantity。
已鎖結算上的 refund：**只能**進次期 adjustment。

### 3.5 退款申請 `RefundStatus`

```text
requested → approved | rejected
approved → completed
rejected / completed → （終態）
```

退款**是否回庫**＝O1，本合約不產生庫存異動。

### 3.6 LINE 到店取貨 `FulfillmentStatus`

```text
pending_payment → paid_reserved → ready_for_pickup → picked_up
pending_payment → expired | cancelled
paid_reserved → refund_pending → refunded
ready_for_pickup → refund_pending → refunded
```

未付款：24 小時後 `pending_payment → expired`，**不** reserve。
已付款：`paid_reserved` **不**自動 expire／退款／釋放。逾期未領只轉客服；人工才走 `refund_pending`。

### 3.7 保留 `ReservationStatus`

```text
reserved → consumed | released | expired
consumed / released / expired → （終態）
```

### 3.8 補貨申請 `RestockRequestStatus`

```text
draft → submitted | cancelled
submitted → under_review | cancelled | rejected
under_review → approved | rejected
approved → converted_to_shipment
converted_to_shipment / rejected / cancelled → （終態）
```

**`approved` 不可再 → `rejected`。**
取消計畫必須與 canonical allow-list 一致：

| 申請 | 出貨 | 模式 | 是否改寫原申請 |
|------|------|------|----------------|
| draft／submitted／under_review | 無 | `status_transition` → `cancelled` | 是（allow-list 允許） |
| approved | 尚無出貨 | `cancellation_event` | 否 |
| converted_to_shipment | pending／packed | `cancellation_event` + `cancel_shipment` | 否 |
| 任一 | shipped／delivered | 不可 | — |

### 3.9 補貨出貨 `RestockShipmentStatus`

```text
pending → packed | shipped | cancelled
packed → shipped | cancelled
shipped → delivered
delivered / cancelled → （終態）
```

**只有 `delivered` 增加店 `onHand`。**

### 3.10 美容券 `VoucherStatus`（與取消申請分開）

```text
issued → available | redeemed | expired
available → redeemed | expired
redeemed → cancelled   （僅 HQ 核准取消申請時）
expired / cancelled → （終態）
```

獨立的 `CancellationRequest`：

```text
pending → approved | rejected
```

- 申請的 `voucherId` 必須等於被取消券。
- 只有 `redeemed` 可由店家提出。
- HQ `approved`：不可變冪等 line；金額為正整數 200／250，方向 `merchant_owes_hq`；點數 +10。未鎖定直接 reversal；已鎖定進次期 adjustment。
- HQ `rejected`：券保持 `redeemed`。
- 自然過期：`issued`／`available` → `expired`，**不退點**。

### 3.11 結算 `SettlementStatus`

```text
draft → reviewing | cancelled
reviewing → approved | draft
approved → paid
paid / cancelled → （終態）
```

命名釐清：

- `reviewing → draft`＝退回草稿，**不是**重開已核准結算。
- `draft`／`reviewing` 只能改結算**草稿 metadata**（備註、期間、審核意見）。
- **不可**改底層 sale／voucher facts（任何狀態都不行）。
- `approved` 的 lines／amounts 永久鎖。只允許 `approved → paid` 並寫付款 metadata。

---

## 4. 金額與數量分型

| 型別 | 用途 |
|------|------|
| `TwdInteger` | 非負安全整數台幣。adjustment／補貼 reversal 必須為**正整數** |
| `NonNegativeIntegerUnits` | 庫存／件數，不是錢 |
| `IntegerPercent` | 0–100 整數百分比 |

- 拒絕：NaN、Infinity、小數、字串、BigInt。
- 佣金：`Math.round(safeMul(實際成交, 百分比) / 100)`。乘法中間值或結果不安全 → throw。
- 月結：`sumSettlementCommissionSnapshots`，只加總，不重算。

---

## 5. 帳務方向（必須相反）

同一筆實際成交、同一 snapshot 率：

| 通道 | 方向 | 總部應付店家 | 店家應付總部 |
|------|------|--------------|--------------|
| 店家收款 | `merchant_owes_hq` | 0 | 成交 − 佣金 |
| Furmosa 代收（LINE／綠界） | `hq_owes_merchant` | 佣金 | 0 |

退款／沖銷用**原 channel + 原 rate snapshot**，方向相反、佣金回沖：

| 原通道 | 退款方向 | 回沖 |
|--------|----------|------|
| 店家收款 | `hq_owes_merchant` | 退款額 − 回沖佣金 |
| Furmosa 代收 | `merchant_owes_hq` | 回沖佣金 |

美容券核銷：固定補貼、佣金＝0、方向＝`hq_owes_merchant`、種類＝`voucher_fixed_subsidy`。
美容券核准取消：正整數面額 + 方向 `merchant_owes_hq`，禁止 signed amount 與 direction 雙重符號。

---

## 6. 美容券（不是商品折價券）

| 項目 | 值 |
|------|-----|
| 兌換 | 10 點 → 一張綁定店服務券 |
| 時區 | `Asia/Taipei`（無 DST） |
| 有效 | 發券時寫死 `expiresAt = issuedAt + 30×24h` |
| 可用 | `now < expiresAt` |
| 面額 | `standard_200`＝200；`zhuwo_250`＝250。未知 tier throw |
| 使用 | 該次美容服務總額 **>** 券額 |
| 核銷後帳務 | Furmosa 欠店家固定券額；**不再**計普通佣金 |
| 取消 | 獨立 CancellationRequest；見 §3.10 |
| 過期 | 不退點 |

**正式店 ID＝O3，未定前禁止用店名「豬窩」判斷。**

---

## 7. 庫存原子效果

```text
available = onHand − reserved
```

每一步先驗：非負、available、且不超過 reserved（釋放／取貨）。

| 操作 | 效果 |
|------|------|
| `reserve` | `reserved += q` |
| `release`／`expire` | `reserved -= q` |
| `consume_pickup` | `onHand -= q` 且 `reserved -= q` |
| `consume_in_store` | `onHand -= q` |

冪等：`key → { fingerprint, result }`。fingerprint 含 op、quantity、原 onHand／reserved。
同 key 同 op／qty 回原 result；同 key 不同 op／qty throw。不是只用 `Set<string>`。
補貨：僅出貨 `delivered` 增加 `onHand`。

履約對庫存：`pending_payment → paid_reserved`＝reserve；`ready_for_pickup → picked_up`＝consume_pickup；已付款進入 `refund_pending`＝release。

---

## 8. 角色

| 動作 | 店員 | 店家（可提加減款） | HQ |
|------|------|-------------------|-----|
| 改佣金率 | 否 | 否 | 是 |
| 改底層 sale／voucher facts | 否 | 否 | 否 |
| 改結算草稿 metadata | 否 | 否 | 是（僅 draft／reviewing） |
| 重開已核准結算 | 否 | 否 | 否 |
| 寫付款 metadata（approved→paid） | 否 | 否 | 是 |
| 提出額外加減款 | 否 | 是 | 是 |
| 核准加減款 | 否 | 否 | 是 |
| 申請取消已核銷美容券 | 是 | 是 | — |
| 核准／拒絕取消美容券 | 否 | 否 | 是 |

---

## 9. Adjustment contract

已鎖結算的差異、或店家額外加減款，必須是新紀錄：

| 欄位 | 規則 |
|------|------|
| `amountTwd` | **正整數**；0／負數拒絕。方向只由 `direction` 表達 |
| `direction` | allow-list，未知 throw |
| `reference` | 必填 |
| `reason` | 必填 |
| `requestedBy`／`approvedBy` | actor allow-list；核准者必須是 HQ |
| `effectivePeriod` | 次期或指定期間 |
| `idempotencyKey` | 必填 |
| `kind` | allow-list：`merchant_proposed_adjustment` 或 `next_period_adjustment` |
| 期間 | 必須是有效 Date 且 start < end；Invalid Date／overflow 拒絕 |

---

## 10. 未付款失效 vs 已付款逾期未領

| 情境 | 規則 |
|------|------|
| 未付款 checkout／intent | 24 小時失效；不 reserve |
| 付款成功 | 才進 `paid_reserved` 並原子 reserve |
| 已付款待取逾期 | 不自動 expire／退款／釋放；顯示聯絡客服 |

退款是否回庫仍見 O1。

---

## 11. 與現況的差距（只記錄，不改 Production）

| 現況 | 本合約目標 |
|------|------------|
| 結算 `approved` 前仍可刪除（`paid` 才禁刪） | `approved` 起 lines／amounts 永久鎖定 |
| 佣金可依商品規則不同百分比 | 同店單一百分比；按 line snapshot |
| 金額欄位多為 Float | 新財務真相只用整數台幣 |
| 美容券可用中文店名辨識豬窩 | 禁止；正式 ID 未決；未知 tier throw |
| 核銷不檢查服務總額 > 券額 | 必須嚴格大於 |
| 現有 HQ／POS runtime 未引用本模組 | **保持不引用** |

---

## 12. 可執行模組

- `lib/pos/domain-contract.ts` — 唯一純函式實作
- `lib/pos/__tests__/domain-contract.test.ts` — targeted tests

禁止：新增 runtime import、改 schema／migration／package／middleware／routes／UI。

