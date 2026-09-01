# POS 查詢頁本機 visual harness

本機虛構資料，非真實交易，不是 Preview 或正式資料驗收。

## 啟動

在專案根目錄：

```bash
node lib/pos/__tests__/serve-query-board-visual-harness.mjs
```

可選啟動參數：

- `QUERY_BOARD_VISUAL_PORT` 預設 `4173`
- `QUERY_BOARD_SCENARIO`：`populated`｜`empty`｜`no_matches`
- `QUERY_BOARD_Q`：搜尋字串
- `QUERY_BOARD_SCROLL`：`end` 時捲到最後一筆

## 產品預覽（截圖用，沒有測試控制列）

- 有資料：`http://127.0.0.1:4173/?scenario=populated`
- 完全沒有紀錄：`http://127.0.0.1:4173/?scenario=empty`
- 搜尋無結果：`http://127.0.0.1:4173/?scenario=no_matches`
- 捲到最後一筆：`http://127.0.0.1:4173/?scenario=populated&scroll=end`

Viewport 請設產品畫面本身為 `1440×900` 或 `390×844`，不要把 `/lab` 的測試控制算進去。

## 測試控制

`http://127.0.0.1:4173/lab` 只給操作者切情境，不要當成店員畫面截圖。

預覽頁可在 Console 執行 `__measureQueryBoard()`。元素不存在、隱藏或寬高為 0 時不會判 PASS；桌機無底部導航為 N/A。
