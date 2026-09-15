# Furmosa 工程交付與正式發布程序

狀態：**正式程序 v1.0**  
適用範圍：Furmosa HQ、店家 POS、一般顧客訂單、Shopify、LINE／換罐、付款、庫存、出貨與結算  
生效日期：2026-09-15

這份文件規定「一項需求如何安全地從想法走到正式環境」。它不是功能規格，也不能取代各領域既有規則。若本文與 `AGENTS.md`、OMS 不變條件或安全規則衝突，以限制較嚴格者為準。

## 一、核心原則

1. 一次只交付一個可驗收的小工作包，不以大量 UI 或重構掩蓋資料問題。
2. HQ、POS、Shopify 與 LINE 應讀寫同一筆業務真相；畫面文字不是資料狀態。
3. 正式資料、schema、環境變數、帳號、付款及外部訊息均需明確授權。
4. 程式 Ready、資料庫 Ready、營運 Ready 是三件事，缺一即為 `NO-GO`。
5. 每項自動重送或人工重按都必須安全；訂單、付款、庫存和點數不可重複處理。
6. 發布失敗要能停止、回退並對帳，不在正式環境即席修改資料。
7. 測試通過只證明其實際涵蓋範圍；mock、單元測試和登入轉址不能冒充端到端驗收。

## 二、角色與責任

小團隊可由同一人兼任多個角色，但正式 migration、資料修復、金流或大量資料操作，執行與批准不得在同一個未記錄步驟內完成。

| 角色 | 主要責任 | 不得自行決定 |
|---|---|---|
| 需求負責人 | 說清楚目的、使用者、商業規則與完成條件 | 技術上如何修改正式資料 |
| 實作者 | 依凍結範圍修改、補測試、留下差異 | 擴大範圍、降低檢查或順便重構 |
| 審查者 | 逐檔核對邏輯、安全、測試與越界 | 只看測試綠燈就批准 |
| 發布負責人 | 核對 Gate、備份、版本、部署與觀察窗 | 在 Gate 未通過時宣布 GO |
| 資料／帳務負責人 | 批准 migration、修復、金額與對帳口徑 | 無備份或無預覽結果時直接執行 |
| 營運驗收人 | 依真實工作方式操作 Preview／試點 | 用正式訂單做測試 |

## 三、唯一資料真相

任何新功能開始前，必須先填清楚下表；不得讓不同頁面各自推算。

| 領域 | 唯一真相 | 主要寫入者 | 其他系統的責任 |
|---|---|---|---|
| 訂單 | `Order` 與來源快照／穩定來源 identity | HQ、Shopify intake 或受控 POS 流程 | POS／HQ 只呈現同一訂單狀態 |
| 出貨 | `Shipment`、明細及狀態稽核 | 共用 READY gate 後的出貨服務 | Shopify／POS 只能推進允許的狀態 |
| 店家庫存 | 不可變庫存流水與可重建餘額 | 收貨、銷售、調整的交易服務 | 畫面不可直接改總數而不留流水 |
| 付款 | 伺服器驗證後的付款紀錄 | 金流 callback／授權人工登記 | URL query 或前端文字不得決定已付款 |
| 結算 | 已凍結規則版本與來源快照 | 結算交易服務 | 不因日後價格／分潤變更改寫歷史 |
| 換罐點數 | 不可變 ledger、唯一來源鍵與可驗算餘額 | 序號／兌換交易服務 | LINE 顯示不能成為點數真相 |
| 外部事件 | webhook inbox 的來源 event identity | Shopify／LINE 接收層 | worker 可重試，但同一事件只生效一次 |

狀態轉換必須由共用伺服器函式控制；UI 隱藏按鈕不是權限或狀態保護。

## 四、工作包啟動 Gate

每一項修改先建立一張工作包，至少包含：

- 問題：目前哪一個人、在哪個步驟、遇到什麼錯誤。
- 目標：完成後可觀察到的結果。
- 不處理：本輪明確排除的功能。
- 唯一資料來源：使用哪些表、事件與穩定 code。
- 白名單：允許修改的檔案／模組。
- 禁止範圍：schema、權限、金額、外部訊息或其他未授權內容。
- 驗收矩陣：正常、缺資料、重送、亂序、並行、越權與失敗回復。
- 發布風險：是否接觸正式資料、migration、付款、庫存、帳務或個資。
- 回復方式：程式、schema、資料與外部事件分別如何處理。

開始實作前必須記錄：repository、branch、base SHA、main SHA、工作樹原有變更及測試環境身分。工作樹不乾淨或有並行修改時使用隔離 checkout，不覆蓋未知變更。

若使用 Cursor，另外遵守 `.cursor/rules/claude-cursor-gated-workflow.mdc`；本文不重複其 Claude 討論與凍結 Prompt 規則。

## 五、實作程序

### 1. 先建立失敗證據

- 用最小測試或可重複步驟證明問題。
- 保存錯誤 code 與狀態，不保存密碼、cookie、token、連線字串或完整顧客資料。
- 無法重現時先增加安全觀測，不猜測修復。

### 2. 最小修改

- 優先修改既有服務和元件，不建立第二套平行邏輯。
- 訂單、出貨、付款、點數、庫存與結算的多步驟寫入使用同一資料庫 transaction。
- 編號及唯一資源建立需由資料庫 unique constraint、鎖或原子 claim 保護。
- 外部 API 呼叫設 timeout；資料庫交易內不等待可避免的外部網路。
- 外部事件採「先驗簽／驗來源、持久化 inbox、快速回應、背景處理、可重試」。
- 不可用 GET 修改資料；不可由公開 health 執行 DB、schema、seed 或外部呼叫。
- runtime DB 帳號不得擁有建立／刪除 schema 的權限。

### 3. 差異審查

- 審查 staged、unstaged、untracked、刪除、rename、binary 與自動產物。
- 逐 hunk 對照白名單和驗收矩陣。
- 發現越界即停止；只回復能明確歸屬本工作包的變更。
- 不以刪測試、skip、放寬斷言或 catch 後忽略錯誤換取綠燈。

## 六、測試金字塔與必要證據

| 層級 | 必須證明 | 何時必做 |
|---|---|---|
| 單元／純函式 | 金額、狀態轉換、映射、權限判斷 | 每次邏輯修改 |
| 契約測試 | HQ／POS／Shopify／LINE 使用相同 code、欄位與狀態 | 跨系統修改 |
| PostgreSQL 整合 | transaction、unique constraint、並行、rollback、migration | 訂單、庫存、付款、點數、結算或 schema |
| API 測試 | 驗簽、授權、重送、亂序、錯誤碼與 timeout | webhook、付款、cron、公開 API |
| 登入後瀏覽器 E2E | 使用者能完成完整工作，不跨店、不重複 | HQ／POS 主要流程 |
| Preview Golden Journey | 同一候選 revision、隔離 DB、測試 provider | 發布前 |
| Production 唯讀 smoke | liveness、登入頁、未登入邊界與指定安全讀取 | 發布後 |

補充限制：

- CI 使用一次性 PostgreSQL，不能連 Production。
- Preview 必須能證明與 Production 資料庫分離，否則禁止登入後寫入測試。
- 公開 `/api/health` 只證明程式存活，不查 DB。DB/schema、cron、webhook backlog 與對帳狀態放在受保護的營運檢查頁或發布 job。
- Node、資料庫與主要 runtime 版本應與 Production 一致；版本不同必須列風險並補相容測試。
- 真 DB 整合測試若未執行，不能因摘要顯示 `skipped 0` 就宣稱通過。

## 七、資料庫變更程序

資料庫變更不放進一般 build。標準順序如下：

1. 記錄目標資料庫的不可混淆身分、目前 migration revision 與程式 SHA。
2. 確認備份／PITR 已啟用、保留期限足夠，並記錄最近一次還原演練。
3. 審查 migration：鎖表、執行時間、null/default、index、舊程式相容與資料量。
4. 在 production-like snapshot 或隔離 PostgreSQL 從舊版實際升級，不只測全新空資料庫。
5. 先跑只讀 preflight，保存預期筆數與不變量；不符合立即停止。
6. 由資料／發布負責人明確批准目標、SQL、時間窗、回復與停止條件。
7. 以獨立 release job 套用 migration，保存 revision、執行者、時間與結果。
8. 執行受保護的 schema verification；成功後才發布依賴新欄位的程式。
9. 需要 backfill 時分批、有上限、可重跑、有進度與差異報告；不與 deploy 隱性綁定。
10. 發布後核對不變量與錯誤率。失敗時優先回退相容的應用程式；不可用 reset 或刪欄位冒充 rollback。

任何 reset、seed、clear、import 或 repair 指令必須預設拒絕 Production，並要求明確環境身分、dry-run、範圍上限與人工 challenge。唯讀 `status/check` 不得暗中執行 migration。

## 八、發布 Gate

候選版本只有在以下項目全部有同一 revision 證據時才能為 `GO`：

- [ ] 候選基於最新 main，白名單外差異為零。
- [ ] typecheck、必要測試、Prisma validate 與 production-mode build 通過。
- [ ] migration 已在隔離／production-like DB 驗證，正式 schema revision 可確認。
- [ ] Preview DB、provider 和 Production 隔離。
- [ ] HQ／POS Golden Journey 通過。
- [ ] 一般顧客／Shopify Golden Journey 通過。
- [ ] LINE／換罐／付款 Golden Journey 通過；未啟用功能需明確 fail closed。
- [ ] 權限、跨店隔離、重送、亂序、並行和 rollback 測試通過。
- [ ] main 必須經 PR 與必要 checks；Production 僅允許指定分支及批准者。
- [ ] 目前成功版本、rollback target、備份與停止條件已記錄。
- [ ] 營運人員完成驗收，客服／人工補救方式已準備。

任一必要項目失敗或未知就是 `NO-GO`。Vercel／Railway 顯示 Ready、PR 顯示可合併或首頁能開，都不能單獨改成 GO。

## 九、分階段發布

1. **Preview：** 隔離資料與測試帳號，完整 Golden Journey。
2. **內部測試：** HQ 管理員及測試店家，外部訊息維持 sandbox／choke。
3. **試點店家：** 一至兩家、限定時間與資料量，功能旗標可立即關閉。
4. **分批開放：** 逐批增加店家，上一批觀察窗無異常才繼續。
5. **全面開放：** 對帳、支援流程、告警與容量均達門檻。

每一階段都需要開始時間、版本、使用者範圍、成功指標、觀察期限及停止人。不可因「目前看起來正常」跳過觀察窗。

## 十、發布後觀察與停止條件

發布後監看技術指標與業務不變量：

- 5xx、延遲、timeout、資料庫連線與 queue／webhook backlog。
- cron 最後成功時間，不只看 HTTP 200。
- 重複 Order／Shipment／付款／點數來源鍵。
- 有 Order 無 Shipment、跨店可見、負庫存或收貨後庫存未增加。
- 付款金額、已收、尾款、店家分潤及結算差異。
- Shopify 事件失敗／重試，LINE redelivery 與訊息發送失敗。

遇到以下任一情況立即停止擴大發布：schema 不符、跨店資料外洩、重複扣款／扣點、付款狀態錯誤、庫存不可驗算、migration preflight 失敗、核心 Golden Journey 失敗或無可用 rollback。

停止後：關閉功能旗標或流量、保存證據、執行一次經批准的安全回退、驗證回退版本，然後進入事故程序；禁止連續自動部署嘗試修好正式環境。

## 十一、事故處理

1. 指定事故負責人與紀錄時間線。
2. 先降低影響，再找完整原因；不刪除稽核資料。
3. 區分程式錯誤、schema 漂移、外部 provider、資料損毀與操作錯誤。
4. 所有正式資料修復先 dry-run、備份受影響列、限制筆數、可重跑並由第二人批准。
5. 修復後跑對應 Golden Journey、資料不變量及觀察窗。
6. 事故結束後補根因、偵測缺口、預防措施與負責期限；不以「人員注意」作唯一改善。

## 十二、每個工作包的交付紀錄

```text
工作包：
需求／問題：
Base main SHA：
候選 SHA：
允許修改：
明確不處理：
資料與外部副作用：

測試證據：
- 單元／契約：
- PostgreSQL 整合：
- API／重送／並行：
- Browser E2E：
- Preview Golden Journey：

資料庫：
- 目標身分與目前 revision：
- 備份／PITR：
- preflight／migration／verification：

發布：
- Preview deployment：
- Production deployment：
- rollback target：
- 觀察窗與指標：

結果：GO／NO-GO
未完成事項：
批准者／執行者／時間：
```

## 十三、目前 Furmosa 的導入順序

在繼續擴充新功能前，依序完成：

1. **P0：資料庫發布安全**——確認 Production DB 身分、schema revision、備份／PITR；建立獨立 migration job；封鎖 production reset／seed／clear／import。執行清單見 `docs/work-packs/P0-01-DATABASE-RELEASE-SAFETY.md`。
2. **P0：交易完整性**——HQ 補貨核准至 Order／Shipment 原子化、編號併發保護、故障回滾測試。
3. **P0：外部事件與付款**——LINE inbox、兌換冪等、ECPay 狀態回查／callback claim、timeout 與 sandbox 驗收。
4. **P0：營運自動化**——正確配置 cron 驗證並保存每項排程最後成功與可重跑證據。
5. **P0：平台保護**——main／Production 必要 checks、指定分支、人工批准、Action SHA 固定。
6. **P1：完整 E2E**——隔離 DB 上走 HQ、POS、一般顧客、Shopify、LINE／換罐及結算全流程。
7. **P1：資訊架構**——把 POS「訂單」與「操作流水」分開，共用 Order／Shipment 真相並消除重複銷售紀錄。
8. **P2：觀測與分批發布**——受保護營運面板、業務不變量告警、測試店家與試點店家 rollout。

同一時間只啟動一個 P0 工作包。前一包未取得驗收證據，不以新增 UI 或新流程繞過。
