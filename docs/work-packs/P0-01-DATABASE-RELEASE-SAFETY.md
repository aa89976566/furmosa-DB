# P0-01：資料庫發布安全工作包

狀態：**DRAFT／尚未授權正式環境檢查或變更**  
依據：`docs/ENGINEERING-DELIVERY-PROCEDURE.md`  
優先級：P0，完成前不得啟用依賴新 schema 的功能

## 1. 要解決的問題

目前程式發布與資料庫 migration 沒有同一版本的強制 Gate。應用程式可能已讀寫新欄位，但平台顯示 Ready 並不能證明目標資料庫已套用同版 migration。此外，部分 reset、seed、clear、import、repair 和名稱為 check 的指令可能修改資料，缺少 Production deny guard。

本工作包只建立並驗證安全發布能力，不修訂單內容、不補正式庫存、不建立帳號、不執行業務資料 repair。

## 2. 完成條件

以下條件全部成立才可關閉本工作包：

- 能以不揭露連線字串的方式辨識 Development、Preview、Production 資料庫。
- 能查得並保存 Production schema revision，但公開 health 不連 DB。
- 已確認備份／PITR 狀態、保留期限與最近一次可用還原證據。
- migration 在舊版 production-like snapshot 成功，並保存執行時間、鎖與資料不變量。
- 有獨立 migration release job；一般 build 永遠不執行 migration、seed 或 repair。
- reset／seed／clear／import／repair 對 Production 預設拒絕。
- `db:check` 是真正唯讀，任何變更命令名稱清楚並需人工批准。
- schema verification 成功後才允許發布依賴新欄位的程式。
- 有應用回退目標、資料庫還原策略、停止條件與一次演練紀錄。
- CI、Preview 與稽核證據全部對應同一應用 revision。

## 3. 本工作包白名單

第一階段只允許修改：

- 本工作包文件及 `docs/RELEASE-EVIDENCE.md` 的連結／證據欄位。
- 後續取得獨立實作授權後，才可加入資料庫安全 wrapper、唯讀 schema check、CI/release workflow 及對應測試；實際檔案清單須另行凍結。

第一階段明確禁止：

- 修改 `prisma/schema.prisma` 或建立／套用 migration。
- 讀取、輸出、複製或提交資料庫 URL、密碼、token、金流或 LINE secret。
- 執行 `migrate deploy`、`db push`、reset、seed、clear、import、repair 或 backfill。
- 登入 Production 後建立、修改或刪除任何資料。
- 修改 Vercel／Railway／Supabase Production 設定。
- 合併 main 或部署 Production。

## 4. 分階段執行

### A. 靜態盤點（不需 Production 權限）

- [ ] 記錄目前 main SHA、候選 SHA、部署平台與資料庫 provider 的程式設定來源。
- [ ] 列出 `package.json`、CI、Vercel/Railway build/start、Prisma 及維運腳本中的 DB 相關命令。
- [ ] 依「唯讀／schema 變更／資料寫入／破壞性」分類每條命令。
- [ ] 找出名稱與副作用不一致的命令，例如名為 check 實際執行 migrate。
- [ ] 找出 build、啟動、GET route、health、cron 或一般 request 中的隱性 migration／DDL／seed。
- [ ] 列出所有需要新欄位的程式路徑及其 fail-closed 行為。
- [ ] 產出最小實作白名單、測試矩陣與 rollback 設計。

輸出：靜態指令清冊、風險分級、建議 diff；不得執行列出的變更命令。第一版清冊見
[`P0-01-DATABASE-COMMAND-INVENTORY.md`](P0-01-DATABASE-COMMAND-INVENTORY.md)。

### B. Production 唯讀身分核對（需另行明確授權）

只允許受審查的固定查詢，且輸出需去敏：

- [ ] 確認資料庫 provider／project 的不可混淆代號；不得顯示連線字串。
- [ ] 查詢 PostgreSQL major version、目前 migration revision 與失敗／回滾紀錄。
- [ ] 查詢必要 table／column／constraint 是否存在。
- [ ] 核對應用 deployment SHA 與其預期 schema revision。
- [ ] 查詢備份／PITR 是否啟用、保留期限與最近成功時間。
- [ ] 保存執行者、批准者、時間、查詢版本與去敏結果。

任何身分不明、revision 不符、查詢超時或權限超出唯讀範圍，立即停止；不嘗試現場補 migration。

### C. 安全控制實作（需新的凍結工作包）

最小預期能力：

- `db:status`：固定唯讀，只顯示去敏身分與 schema 狀態。
- `db:migrate:release`：獨立變更入口，需明確環境、批准與 preflight。
- 危險命令 wrapper：Production 預設拒絕，要求不可猜測的人工 challenge，不接受只靠 `NODE_ENV`。
- CI contract：build/start/public GET 不得含 migrate、DDL、seed、repair 或 demo account。
- schema contract：應用宣告 expected revision；受保護 verification 不符即阻止 rollout。
- 權限分離：runtime DB user 不具 schema owner／DDL 能力；migration 使用短期、受控權限。

### D. 隔離 PostgreSQL 驗證

- [ ] 從舊 migration revision 建立資料庫並匯入去敏測試資料形狀。
- [ ] preflight 在不符合條件時安全停止且零寫入。
- [ ] migration 成功，舊程式在 additive 過渡期間仍可讀寫既有欄位。
- [ ] 新程式只在 schema verification 成功後啟動依賴路徑。
- [ ] migration 重跑可安全辨識已套用，不重複變更。
- [ ] 鎖表時間、逾時與大表 index 路徑符合維護窗預算。
- [ ] 中途失敗不留下半套 constraint／index／backfill。
- [ ] 危險命令在模擬 Production 身分下全部拒絕。
- [ ] rollback 演練能恢復服務，且不使用 reset 或刪除歷史紀錄。

### E. Preview Gate

- [ ] 以 provider/project identity 證明 Preview DB 與 Production 不同。
- [ ] Preview 套用同一 migration revision，保存 job 結果。
- [ ] HQ、POS、Shopify、LINE／換罐只使用測試帳號與測試 provider。
- [ ] Golden Journey、並行、重送、rollback 與資料不變量通過。
- [ ] diff、CI、Preview deployment 與 evidence 對應同一候選 revision。

### F. Production 執行（不包含於目前授權）

只有 A–E 全部完成，且資料／發布負責人再次明確批准後才能排程：

1. 凍結候選 revision 與維護窗。
2. 記錄目前成功 deployment、schema revision、備份及 rollback target。
3. 跑固定唯讀 preflight；結果與預期完全一致才繼續。
4. 由獨立 release job 套用 migration，保存不可變執行紀錄。
5. 跑受保護 schema verification。
6. 發布同一候選應用程式。
7. 執行公開唯讀 smoke、受保護營運檢查與必要登入讀取。
8. 觀察錯誤、延遲、cron、webhook、孤兒資料、負庫存及帳務差異。
9. 任一停止條件成立，停止 rollout，依批准方案回退一次並驗證。

## 5. 測試矩陣

| 情境 | 預期結果 |
|---|---|
| build／start | 不執行 migration、seed、repair 或業務資料寫入 |
| Preview 誤指向 Production | Gate 拒絕，禁止登入後 E2E |
| schema revision 落後 | 新功能 fail closed，阻止 rollout |
| schema revision 超前／未知 | 阻止 rollout，要求人工調查 |
| migration 已套用後重跑 | 安全辨識並停止，不重複寫入 |
| preflight 筆數或 constraint 不符 | 零寫入停止 |
| migration 中途失敗 | 無半套可見狀態，保留錯誤證據 |
| runtime user 嘗試 DDL | 資料庫權限拒絕 |
| Production 執行 reset／seed／clear | wrapper 在連線前拒絕 |
| 應用回退 | nullable/additive schema 與舊程式相容 |
| 資料需復原 | 使用備份／PITR 或精準已審核修復，不使用 reset |

## 6. 停止條件

以下任一項成立立即停止：

- 無法確認實際資料庫身分或可能與 Preview 共用。
- 無法確認備份／PITR或找不到可用回復點。
- 正式 schema 與應用預期不一致。
- migration 需要破壞性操作、長時間鎖表或未審核 backfill。
- preflight 結果與預期不符。
- 發現秘密值出現在 log、文件、PR 或命令輸出。
- CI／Preview 不是同一候選 revision。
- 沒有明確執行者、批准者、rollback target 或觀察人員。

## 7. 證據紀錄

```text
工作包：P0-01 Database Release Safety
執行日期：
Base main SHA：
候選 SHA：

靜態盤點：PASS／FAIL／UNKNOWN
Production 唯讀身分：PASS／FAIL／NOT AUTHORIZED
備份／PITR：PASS／FAIL／UNKNOWN
目前 schema revision：去敏結果
預期 schema revision：
production-like upgrade：PASS／FAIL／NOT RUN
危險命令 deny guard：PASS／FAIL／NOT IMPLEMENTED
Preview 隔離：PASS／FAIL／UNKNOWN
Golden Journey：PASS／FAIL／NOT RUN
rollback rehearsal：PASS／FAIL／NOT RUN

決策：GO／NO-GO
停止原因：
執行者／批准者／時間：
```

## 8. 目前決策

**NO-GO。** 目前只有靜態稽核資訊，尚未取得 Production 唯讀資料庫身分、schema revision、備份／PITR與還原演練證據；也尚未完成危險指令 deny guard。不得執行 Production migration 或啟用依賴新 schema 的寫入功能。
