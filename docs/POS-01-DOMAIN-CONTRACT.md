# POS-01 Domain Contract

> **地位：** POS 帳務／庫存／美容券／結算的單一領域合約（可執行純函式對齊本文件）  
> **版本：** v1.0  
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
| R3 | 一般佣金率按**店家設定**，同店不同商品不使用不同百分比；以實際成交額**扣退款後**計；台幣**整數四捨五入**。 |
| R4 | **嚴禁負庫存**。`available = onHand - reserved`，且不可為負。低庫存可一鍵補貨；**只有出貨 `delivered` 才增加店庫存**。 |
| R5 | 已 `approved` 的結算**永久鎖定、不重開**；錯誤以**次期 adjustment** 處理。 |
| R6 | 店家可提出額外加減款，**HQ 核准**；店員不可改佣金或結算。 |
| R7 | LINE／綠界由 Furmosa 收款的指定門市訂單，該店仍取得**普通佣金**；必須和店收現金使用**不同帳務方向**。 |
| R8 | 美容券**完全獨立於商品**：10 點換綁定店美容服務券；30 天；200 元，豬窩三店 250 元；服務總額必須**嚴格大於**券額；核銷後 Furmosa 欠店家**固定券額**，不再計普通佣金；店家只能申請取消，HQ 才能核准；自然過期**不退點**。 |
| R9 | 未取貨**不自動退款**，顯示聯絡客服。 |
| R10 | 完成交易、核銷、結算**不可 update/delete 原事實**，只能 reversal／adjustment。 |

### 1.1 安全（實作時必須遵守，本階段只寫進合約）

- 不信任 client 傳來的 `merchantId`／`price`／`commission`／`paymentStatus`／`voucherAmount`。  
- 不用 Float 建立新財務真相。  
- 不按中文店名辨識豬窩。  
- 不把美容券當商品折價券。

---

## 2. 尚未決定（OPEN — 不得猜測）

| ID | 項目 | 為什麼不能猜 |
|----|------|----------------|
| O1 | **退款是否回庫、以及回庫原因** | 回庫會改 `onHand`，猜錯會造成負庫存或重複入庫 |
| O2 | **LINE 付款 reservation timeout** | 逾時會釋放保留量；秒數／天數未定，禁止硬編碼 |
| O3 | **豬窩三店正式 immutable IDs** | 禁止用「豬窩」店名比對；正式 ID 未定前，券額只能用明確的面額層級（`standard_200`／`zhuwo_250`） |

這三項在程式裡以 `POS_01_OPEN_DECISIONS` 標註。任何函式都**不得**假裝已決定。

---

## 3. Canonical 狀態與轉移（allow-list）

未列出的轉移一律拒絕。  
**同一狀態再轉一次（from === to）視為重複轉移，拒絕。**  
終態不可再改寫原事實。

### 3.1 收款通道 `CollectionChannel`

| 值 | 意思 |
|----|------|
| `merchant_collected` | 店家收款（店內現金等） |
| `furmosa_collected_line_ecpay` | LINE／綠界由 Furmosa 收款 |

### 3.2 帳本方向／種類

| `LedgerDirection` | 意思 |
|-------------------|------|
| `merchant_owes_hq` | 店家欠總部（店收現金後，扣除佣金的貨款要繳回） |
| `hq_owes_merchant` | 總部欠店家（Furmosa 代收後的普通佣金，或美容券固定補貼） |

| `LedgerKind` | 意思 |
|--------------|------|
| `ordinary_commission` | 一般寄賣佣金 |
| `voucher_fixed_subsidy` | 美容券固定補貼（不計普通佣金） |
| `merchant_proposed_adjustment` | 店家提出、HQ 核准的額外加減款 |
| `next_period_adjustment` | 已鎖結算的錯誤，記入次期 |
| `reversal` | 沖正一筆已完成事實（另寫新紀錄，不改舊列） |

### 3.3 銷售 `SaleStatus`

```text
draft → completed | cancelled
completed → reversed
cancelled → （終態）
reversed → （終態）
```

### 3.4 退款 `RefundStatus`

```text
requested → approved | rejected
approved → completed
rejected → （終態）
completed → （終態）
```

退款**是否回庫**＝O1，本合約不產生庫存異動。

### 3.5 保留 `ReservationStatus`

```text
reserved → consumed | released | expired
consumed / released / expired → （終態）
```

`expired` 僅表示「允許這個狀態存在」。**何時逾時＝O2，不得寫死秒數。**

### 3.6 補貨申請 `RestockRequestStatus`

```text
draft → submitted | cancelled
submitted → under_review | cancelled | rejected
under_review → approved | rejected
approved → converted_to_shipment | rejected
converted_to_shipment / rejected / cancelled → （終態）
```

一鍵補貨只是建立申請，**不直接加店庫存**。

### 3.7 補貨出貨 `RestockShipmentStatus`

```text
pending → packed | shipped | cancelled
packed → shipped | cancelled
shipped → delivered
delivered / cancelled → （終態）
```

**只有 `delivered` 增加店 `onHand`。** `pending`／`packed`／`shipped` 都不加。

### 3.8 美容券 `VoucherStatus`

```text
issued → redeemed | expired | cancel_requested
redeemed → cancel_requested
cancel_requested → cancelled
expired / cancelled → （終態）
```

- 自然過期：`issued → expired`，**不退點**。  
- 店家只能走到 `cancel_requested`。  
- 只有 HQ 可以把 `cancel_requested → cancelled`。  
- HQ 拒絕取消後回到哪一狀態：**未決，不列入 allow-list。**

### 3.9 結算 `SettlementStatus`

```text
draft → reviewing | cancelled
reviewing → approved | draft
approved → paid
paid / cancelled → （終態）
```

- `approved` 與 `paid`：**永久鎖定**。不可重開、不可改原列、不可刪。  
- 錯誤 → 次期 `next_period_adjustment`。  
- `draft`／`reviewing` 尚未成為完成事實，HQ 仍可退回或取消。

---

## 4. 金額

- 只接受**安全整數台幣**（`Number.isSafeInteger`）。  
- 拒絕：NaN、Infinity、小數（Float）、負值、字串、BigInt。  
- `0` 允許（例如全額退款後淨成交為 0）。  
- 佣金百分比：整數 `0`–`100`（例如 30 表示 30%），拒絕小數與負值。  
- 四捨五入：`Math.round(淨成交 × 百分比 / 100)`（非負數等同小學四捨五入）。

---

## 5. 帳務方向（必須相反）

同一筆淨成交、同一店佣金率：

| 通道 | 方向 | 總部應付店家 | 店家應付總部 |
|------|------|--------------|--------------|
| 店家收款 | `merchant_owes_hq` | 0 | 淨成交 − 佣金 |
| Furmosa 代收（LINE／綠界） | `hq_owes_merchant` | 佣金 | 0 |

兩種都是 `ordinary_commission`。  
美容券核銷：**不是**上表。固定補貼、佣金＝0、方向＝`hq_owes_merchant`、種類＝`voucher_fixed_subsidy`。

---

## 6. 美容券（不是商品折價券）

| 項目 | 值 |
|------|-----|
| 兌換 | 10 點 → 一張綁定店服務券 |
| 有效 | 30 天 |
| 面額 | 一般 200；豬窩三店 250 |
| 使用 | 該次美容服務總額 **>** 券額（相等也不行） |
| 核銷後帳務 | Furmosa 欠店家固定券額；**不再**計普通佣金 |
| 取消 | 店家申請 → HQ 核准 |
| 過期 | 不退點 |

豬窩 250 只能用明確層級 `zhuwo_250` 傳入。  
**正式店 ID＝O3，未定前禁止用店名「豬窩」判斷。**

---

## 7. 庫存

```text
available = onHand − reserved
available ≥ 0
onHand ≥ 0
reserved ≥ 0
```

任一為負、或相減為負 → 拒絕。  
銷售／保留數量不可大於 `available`。  
補貨：僅出貨 `delivered` 增加 `onHand`。

---

## 8. 角色

| 動作 | 店員 | 店家（可提加減款） | HQ |
|------|------|-------------------|-----|
| 改佣金率 | 否 | 否 | 是 |
| 改／重開已核准結算 | 否 | 否 | 否（只能次期 adjustment） |
| 提出額外加減款 | 否 | 是 | 是 |
| 核准加減款 | 否 | 否 | 是 |
| 申請取消美容券 | 是 | 是 | — |
| 核准取消美容券 | 否 | 否 | 是 |

---

## 9. 未取貨

不建立自動退款。畫面只顯示聯絡客服。  
是否之後人工退款、以及退款是否回庫，不在本合約決定（回庫見 O1）。

---

## 10. 與現況的差距（只記錄，不改 Production）

| 現況 | 本合約目標 |
|------|------------|
| 結算 `approved` 前仍可刪除（`paid` 才禁刪） | `approved` 起永久鎖定 |
| 佣金可依商品規則不同百分比 | 同店單一百分比 |
| 金額欄位多為 Float | 新財務真相只用整數台幣 |
| 美容券可用中文店名辨識豬窩 | 禁止；正式 ID 未決 |
| 核銷不檢查服務總額 > 券額 | 必須嚴格大於 |
| 現有 HQ／POS runtime 未引用本模組 | **保持不引用** |

---

## 11. 可執行模組

- `lib/pos/domain-contract.ts` — 唯一純函式實作  
- `lib/pos/__tests__/domain-contract.test.ts` — targeted tests  

禁止：新增 runtime import、改 schema／migration／package／middleware／routes／UI。

