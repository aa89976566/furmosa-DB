# P0-01A：資料庫身分 Gate 與唯讀狀態檢查

狀態：**FROZEN SPEC／尚未實作**  
母工作包：`docs/work-packs/P0-01-DATABASE-RELEASE-SAFETY.md`  
Base main SHA：`c688b943b5bd24d9b3846593f02fdd5bd18366d3`  
規格候選 SHA：`192b3dfe10302b1e99eba5a2ef46fd95f938ba18`

## 1. 問題與目標

目前資料庫工具只要取得 `DATABASE_URL` 或 `DIRECT_URL` 就可能執行，沒有共用機制證明「操作者宣稱的環境」與「連線實際指向的資料庫」一致；現有 `db:check` 還會先執行 migration。

本工作包只建立兩個基礎能力：

1. 一個不依賴 `NODE_ENV`／`VERCEL_ENV` 的純函式身分 Gate，對缺值、兩條 URL 指向不同 project、未知環境或 fingerprint 不符一律 fail closed。
2. 一個真正唯讀的 `db:status`，只顯示去敏身分、連線能力與 migration 摘要，不執行 DDL、DML、migration、seed 或 repair。

## 2. 本輪不處理

- 不修改 `prisma/schema.prisma`，不新增或套用 migration。
- 不替既有 seed、clear、import、repair、cleanup 加 guard；它們是後續獨立小工作包。
- 不讀取或修改 Production／Preview 環境變數。
- 不查 Production schema、備份或 PITR。
- 不建立 release job、不調整 Vercel／Supabase 權限、不部署或合併。
- 不修改 HQ、POS、Shopify、LINE、付款、庫存、訂單或出貨功能。

## 3. 唯一資料與信任邊界

輸入：

- `FURMOSA_DB_TARGET`：只接受 `development`、`test`、`preview`、`production`。
- `FURMOSA_DB_IDENTITY_SHA256`：由部署／執行環境提供的預期去敏 fingerprint。
- `DATABASE_URL` 與 `DIRECT_URL`：只在記憶體解析，不輸出原值。

fingerprint 由「正規化 host、port、database、username 中可識別的 Supabase project ref」形成 canonical identity 後做 SHA-256。不得包含或輸出密碼、query value、token。兩條 URL 必須能解析為相同 project identity；不一致立即停止。

限制：環境變數本身仍可能被有權限者一併錯設，因此本 Gate 是第一層防呆，不取代後續的 Vercel environment protection、不同 DB role、Supabase project 核對與第二人批准。

## 4. 凍結白名單

實作只允許修改下列檔案：

- `lib/db-target-identity.ts`：純解析、去敏、fingerprint 與 fail-closed 判斷；不得建立 Prisma Client。
- `lib/__tests__/db-target-identity.test.ts`：純函式測試，不得連線。
- `scripts/db-status.ts`：通過 Gate 後才建立唯讀連線，執行固定 SELECT。
- `package.json`：把 `db:check` 改為呼叫唯讀 status；另保留名稱清楚的 migration 指令。
- `.env.example`：只加入 placeholder 與安全說明，不放真實 project ref 或 fingerprint。
- `docs/work-packs/P0-01A-DB-IDENTITY-STATUS.md`：紀錄結果。

白名單外任何差異都必須停止，不可順便修正。

## 5. `db:status` 固定行為

執行順序必須是：

1. 在建立 DB client 前驗證必要環境變數、URL 格式、兩條 URL 的 project identity 與 fingerprint。
2. 驗證失敗只回傳穩定錯誤 code，不印任何 URL 或秘密片段。
3. 通過後使用連線執行固定唯讀查詢：PostgreSQL major version、`current_database()`、`current_user`、`_prisma_migrations` 的最近成功 revision、failed／rolled-back 計數。
4. 若 migration table 不存在，回報 `MIGRATION_TABLE_MISSING`，不得建立。
5. 輸出只包含 target、截短 fingerprint、去敏 host 類型、資料庫名稱、角色名稱、schema 摘要與時間；禁止完整 URL、密碼、query string、stack trace。
6. 任一 revision 未知或失敗 migration 存在，exit non-zero；不得嘗試修復或 deploy。

固定 SELECT 應放在程式常數中，不接受 CLI 傳入 SQL，避免 status 變成通用資料庫終端。

## 6. 穩定錯誤 code

- `DB_TARGET_MISSING`
- `DB_TARGET_INVALID`
- `DB_URL_MISSING`
- `DB_URL_INVALID`
- `DB_URL_IDENTITY_MISMATCH`
- `DB_FINGERPRINT_MISSING`
- `DB_FINGERPRINT_MISMATCH`
- `DB_CONNECTION_FAILED`
- `MIGRATION_TABLE_MISSING`
- `MIGRATION_STATE_FAILED`

使用者可讀文字可以調整，但程式與測試只依穩定 code 判斷。

## 7. 驗收矩陣

| 情境 | 預期結果 |
|---|---|
| 缺少 target／fingerprint／任一 URL | 建立連線前拒絕 |
| target 為任意字串 | `DB_TARGET_INVALID` |
| URL 含密碼與 query 參數 | 錯誤與成功輸出皆不包含秘密 |
| DATABASE 與 DIRECT 指向不同 Supabase project | `DB_URL_IDENTITY_MISMATCH` |
| 實際 canonical identity 與預期 fingerprint 不同 | `DB_FINGERPRINT_MISMATCH` |
| 宣稱 preview 但提供 production fingerprint | 建立連線前拒絕 |
| 合法的本機／CI identity | 純函式 Gate 通過 |
| migration table 不存在 | 唯讀失敗，不建立 table |
| 有 failed 且未 rolled back 的 migration | non-zero、`MIGRATION_STATE_FAILED` |
| 正常 migration history | 顯示最近成功 revision，不執行寫入 |
| 執行 `npm run build`／`npm start` | 不觸發 status、migration 或 DB 寫入 |
| 搜尋 status 實作 | 不含 `$executeRaw`、DDL、DML、`migrate` subprocess |

## 8. 測試與證據

實作階段只允許先執行不連 DB 的測試：

```text
node --import tsx --test lib/__tests__/db-target-identity.test.ts
npm run typecheck
git diff --check
```

`db:status` 的連線測試必須使用一次性 PostgreSQL，且事前證明 URL 為 CI／隔離容器；未取得此證據時標記 `NOT RUN`，不可改連 Preview 或 Production 補測。

證據至少包含：候選 SHA、白名單差異、測試結果、秘密掃描、是否建立網路／DB 連線。測試失敗或未執行不得寫 PASS。

## 9. 回復與停止條件

程式回復：回退本工作包單一 commit；因無 schema／資料變更，不需要資料 rollback。

以下任一項成立立即停止：

- 需要真實 project ref、URL、密碼或 Production 查詢才能讓單元測試通過。
- 無法在建立連線前判斷 URL identity。
- status 需要 CREATE、ALTER、UPDATE、INSERT、DELETE、migration 或 repair。
- 必須修改白名單外檔案或改動既有業務功能。
- 測試輸出出現連線字串、密碼、token 或完整 stack 中的秘密。
- 發現 branch 不再基於記錄的 main，先重新審查差異，不直接整併。

## 10. 實作 Gate

本文件只凍結下一個小工作包，沒有授權 Production 連線或變更。開始實作時仍須重新確認工作樹乾淨、base 未漂移，先寫失敗測試，再做最小修改。完成後只推送既有 PR，等待 CI；不得自動合併或部署。
