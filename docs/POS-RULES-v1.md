# Furmosa POS Rules v1

> 狀態：v1.1 PRODUCT DECISIONS APPROVED — IMPLEMENTATION BLOCKED
> 證據基線：`e315024cb18251a53448c4fda2cb1b3dd998e2f9`
> 範圍：店家、POS 帳號、權限、庫存、交易、退款、結算與稽核的共同規則
> 不包含：頁面視覺、行銷、未來多門市、多倉、離線寫入

> Blocker：POS 純規則與測試已採 `merchant_restock: delivered → received`，但 `Shipment` schema、HQ 出貨 action 與部分畫面仍停在舊流程，且目前沒有可稽核的店家收貨時間／操作者欄位。完成獨立修正、舊資料盤點與回歸測試前，不得宣稱補貨入庫流程已可上線。

## 1. 文件地位

本文件是 POS 共通入口，不另造第二套財務或庫存規則：

- 帳務、庫存、退款、換罐與結算細節，以 `docs/POS-01-DOMAIN-CONTRACT.md` 為準。
- 店員任務與頁面流程，以 `docs/MERCHANT-POS-FLOW.md` 為準。
- 登入技術現況，以 `docs/PHASE-1-MERCHANT-USER-DRAFT.md` 與目前程式為證據。
- 本文件與程式衝突時，不得自行挑一邊；先標記衝突並停止相關上線。

標記：

- `[CURRENT]`：目前程式或既有凍結規則已有直接證據。
- `[PROPOSED]`：建議納入 v1，尚未經產品負責人核准。
- `[DECISION_REQUIRED]`：會改變資料、權限或營運方式，工程不可猜。
- `[DEFERRED]`：第一版明確不做。

## 2. 最小資料關係

```text
一般客戶 Customer
        與
合作店家 Merchant ── POS 帳號 MerchantUser
                          │
                          └─ 所有 POS 資料只能屬於該 Merchant
```

1. `[CURRENT]` Customer 與 Merchant 是不同身分；店名不得塞入 Customer 姓名。
2. `[CURRENT]` v1 採 Merchant＝一個實體門市；未來一個企業多門市屬 `[DEFERRED]`。
3. `[CURRENT]` Merchant 與 MerchantUser 分開建立；建立店家不等於已開通 POS。
4. `[CURRENT]` HQ 與 POS 使用不同帳號、cookie 與 session，不得互相提升權限。

## 3. 店家與帳號生命週期

```text
HQ 建立店家
  → 補齊聯絡人與配送資料
  → 明確按「開通 POS」
  → 店家首次登入並設定自己的密碼
  → 日常使用
  → 帳號或店家停用
  → 歷史永久保留
```

### 3.1 建立與開通

- `[PROPOSED]` 建立 Merchant 時不自動建立帳號，避免未完成資料的店家直接登入。
- `[PROPOSED]` HQ 只有在必要資料完整後才可按「開通 POS」。
- `[PROPOSED]` 開通必須冪等；重複點擊不得產生第二個 active 帳號。
- `[PROPOSED]` 臨時密碼不可顯示在列表、日誌或網址；首次登入必須更換。

### 3.2 停用與歷史

- `[PROPOSED]` 停用 Merchant 時，旗下 POS 帳號及現存 session 必須立即失效。
- `[PROPOSED]` 停用單一帳號不刪除 Merchant，也不改寫歷史交易。
- `[PROPOSED]` Merchant、MerchantUser、completed sale、退款、庫存流水及結算不得硬刪除。
- `[PROPOSED]` 更正完成事實只能新增 reversal 或 adjustment。

## 4. v1 權限

### 4.1 建議的第一版

`[APPROVED]` v1 維持「每店一個 active POS 帳號」，只開放日常低風險工作；所有高風險動作交 HQ。這最符合目前小團隊，也不需要現在新增 role schema。

| 動作 | 店家 POS | HQ |
|---|---:|---:|
| 查看本店今日任務、庫存與紀錄 | 允許 | 允許 |
| 完成換罐交付 | 允許 | 查閱／例外處理 |
| 建立補貨申請 | 允許 | 審核 |
| 確認補貨已收到 | 允許，確認實際收到完整貨物 | 例外處理 |
| 建立一般店內銷售 | 允許 | 查閱 |
| 退款／取消已完成交易 | 只能提出 | 核准並執行 |
| 手動調整庫存 | 禁止 | 核准並留下原因 |
| 核准／修改結算 | 禁止 | 允許 |
| 開通、停用、重設 POS 帳號 | 禁止 | 允許 |
| 查看其他店家 | 禁止 | 依 HQ role |

### 4.2 不假裝可歸責

`[CURRENT]` 共用店家帳號只能證明「哪家店」操作，不能證明「哪位員工」操作。第一版稽核文案不得顯示成某位真實員工已操作。

`[DEFERRED]` 若未來需要個人責任追蹤，再改成每人帳號＋角色；不要只新增多帳號卻沒有權限差異。

## 5. 核心不變量

1. POS 每個 request 都必須重新驗證有效的 Merchant session。
2. merchantId 必須取自伺服器 session；client 提交的 merchantId 一律忽略或拒絕。
3. 權限沒有明確允許時一律拒絕。
4. HQ session 不得當 POS session；POS session 不得當 HQ session。
5. 停用帳號或店家後，既有 session 必須可由伺服器撤銷，不得只等 cookie 過期。
6. 商品資格規則只能有一個伺服器端來源；HQ 核准時必須重新檢查。
7. MerchantStock 只表示本店可賣現貨；在途不得計入。
8. `shipped` 與 `delivered` 都不增加門市庫存；只有 `merchant_restock` 合法且首次發生的 `received` 才增加一次。
9. 庫存不得為負；server 必須在同一交易內重查可用量。
10. 金額、佣金、收款方、帳務方向與可退上限由 server 計算，不能相信畫面傳值。
11. 店家收款與 Furmosa 線上收款必須使用不同帳務方向。
12. 未付款交易不預留；付款成功後的 reserve 必須原子且冪等。
13. completed sale、核銷與 approved settlement 不得 update/delete 原事實。
14. 退款、取消與差異以新 reversal／adjustment 記錄，不回寫覆蓋原資料。
15. 所有造成庫存、金額或終態改變的動作都要有冪等鍵與 append-only 稽核紀錄。
16. 稽核至少保存 actor 類型與 ID、merchantId、動作、目標、時間、結果、原因及 correlation/idempotency key；不得保存密碼或完整秘密。
17. 外部 webhook／排程必須使用明確的 system actor 與 merchant scope，不得假冒店員 session。
18. 網路或權威資料不可用時，高風險寫入 fail closed；v1 不做離線交易佇列。

## 6. 登入與「記住這台設備」

- `[PROPOSED]` 密碼採長密碼／密碼片語，單因素登入至少 15 字元，允許至少 64 字元；不強迫定期更換，但洩漏或重設後使所有 session 失效。
- `[PROPOSED]` 密碼只保存具成本參數與 salt 的 hash；登入錯誤不揭露帳號是否存在。
- `[APPROVED]` 店家專用平板：7 天 idle、30 天 absolute；一般個人裝置：12 小時 idle、7 天 absolute。
- `[PROPOSED]` 每次請求由 server 檢查到期與撤銷狀態；只做長效 cookie 不算「記住設備」。
- `[PROPOSED]` 重設密碼、停用帳號、停用店家或疑似裝置遺失時，撤銷該帳號所有 session。
- `[DEFERRED]` v1 不做 passkey、裝置清單、自助找回、複雜 RBAC 或 manager PIN，除非產品決定店家可自行做高風險動作。

## 7. v1 驗收矩陣

1. HQ 建立 Merchant 不會自動開通 POS。
2. 重複開通不會產生第二個 active 帳號。
3. 正確帳密可登入；錯誤帳密回相同模糊錯誤。
4. MerchantUser 停用後不能新登入。
5. 停用後已登入裝置的下一次 request 被拒絕。
6. HQ cookie 不能進 POS；POS cookie 不能進 HQ。
7. 偽造 client merchantId 仍無法讀寫另一店資料。
8. 店家不能查看另一店的訂單、庫存、會員或結算。
9. `merchant_restock` 的 shipped／delivered 不入庫；店家首次確認 `received` 才入庫一次。
10. 重送 completed／delivered／退款 request 不產生重複效果。
11. 庫存不足時銷售原子失敗，不產生負庫存或半筆交易。
12. client 偽造金額、佣金或帳務方向被 server 忽略／拒絕。
13. 店家不能直接完成退款、庫存調整或結算核准。
14. HQ 執行高風險動作後有完整、不含秘密的稽核紀錄。
15. 密碼重設會撤銷全部舊 session，舊密碼不能再登入。
16. 斷線時不接受無法向 server 驗證的付款、庫存或換罐完成寫入。
17. 既有換罐、補貨、庫存、銷售與 HQ 登入測試保持通過。

## 8. v1 已核准產品決策

1. 每店共用一個 active POS 帳號；v1 接受只能追到店、不能追到個人。高風險動作全部交 HQ。
2. 只有 `merchant_restock` 採 `shipped → delivered → received`：`delivered` 代表物流送達，`received` 代表店家確認完整收貨；只有首次 `received` 入庫。一般客戶與訂閱出貨的 `delivered` 維持終態，不得出現 `received`。
3. v1 不支援部分到貨／破損入庫；遇到差異不得確認收貨，改由 HQ 處理。
4. 店家可提出退款與庫存調整，但只有 HQ 能核准並產生庫存或帳務效果。
5. 店家專用平板採 7 天 idle／30 天 absolute；一般個人裝置採 12 小時 idle／7 天 absolute。
6. v1 的 `STANDARD` 仍是寄賣商品。只有啟用商品且該店已有 MerchantStock 或有效寄賣規則時可販售／補貨；POS 與 HQ 必須共用同一個伺服器端資格判斷，HQ 核准時重新檢查。
7. v1 不做離線寫入；離線時顯示無法處理及稍後重試，不得暫存付款、庫存、換罐完成或收貨完成操作。

### 8.1 已發現的實作衝突

- `[CURRENT]` `app/(main)/shipments/actions.ts` 的現行轉移仍允許 `delivered → shipped | pending`。
- `[CURRENT]` `lib/pos/domain-contract.ts` 與測試已明定 `delivered → received`，且只有 `received` 入庫；但 runtime 尚未接上這條規則。
- `[CURRENT]` 現行 HQ shipment action 可以標記 `delivered`；尚未有受 merchant scope 保護的店家收貨入口。
- `[APPROVED]` 目標規則只對 `merchant_restock` 增加 `received`；一般客戶與訂閱出貨不改流程。
- `[APPROVED]` `delivered`／`received` 不直接倒退。誤操作以有原因、有操作者的更正或庫存 adjustment 處理；差異補寄另開新 shipment。
- `[DECISION_REQUIRED]` schema 尚無 `receivedAt`／收貨 actor／狀態事件欄位。實作前須提出最小 schema、migration、舊資料 dry-run/backfill 與回復方案，另行取得同意。
- `[BLOCKED]` 必須先以一個獨立工作包統一狀態轉移、actor、冪等與庫存效果，再開始 POS 帳號管理 UI。

### 8.2 出貨類型狀態機

| 類型 | 合法主流程 | 入庫時點 |
|---|---|---|
| `merchant_restock` | `pending → packed → shipped → delivered → received` | 首次 `received` |
| `customer_order` | `pending → packed → shipped → delivered` | 不影響店家庫存 |
| `subscription` | `pending → packed → shipped → delivered` | 不影響店家庫存 |

舊資料不得直接猜測：既有 `merchant_restock + delivered` 只表示舊系統已送達，不能自動當成店家已驗收。正式修復前先用 dry-run 比對 shipment、庫存流水與現有 MerchantStock；所有 backfill 必須可追蹤批次，且只回復該批新增效果。

## 9. 實作順序與停止條件

1. 先檢查本文件與 `POS-01` 是否衝突；如有衝突，停止並先處理衝突。
2. 只設計最小 HQ「開通／停用／重設」流程；不順便做角色系統。
3. 先提出 session revocation 與 first-login 所需 schema、migration、backfill 及回復方案，另行取得同意；v1 不新增 role 欄位。
4. 寫純權限規則與測試，再接 API，最後才接 UI。
5. 一次 Preview 驗收通過後才提出正式部署；不得直接操作 Production。

## 10. 官方設計基準

- OWASP Authorization Cheat Sheet：least privilege、deny by default、每次 request 驗權限及授權測試。
- OWASP Session Management Cheat Sheet：session idle／absolute timeout 與失效應由 server 管理。
- NIST SP 800-63B-4：現代密碼長度、blocklist、hash 與不強制定期更換原則。
- Shopify POS permissions：將一般店員權限、高風險動作及 manager approval 分離，並保留活動紀錄。
