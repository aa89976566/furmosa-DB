# 自動修復第一版

## 今日範圍

- 先接換罐付款完成與換罐完成的 LINE 通知。
- 主要交易先完成，LINE 通知永遠不回滾付款、庫存或點數。
- 第一次失敗後 30 秒可重試；第二次失敗採用安全替代方案。
- 作業以 `job_key` 去重，避免重複發送。
- HQ 首頁顯示正在修復、24 小時內已恢復與需要人工確認的數量。

## 狀態

| 狀態 | 意義 |
| --- | --- |
| `pending` | 等待第一次處理 |
| `processing` | 已由一個 worker 鎖定處理 |
| `retrying` | 第一次失敗，等待下一次處理 |
| `completed` | LINE 發送成功 |
| `fallback_succeeded` | 第二次失敗，主要交易保留，客戶可從既有 LINE 會員頁查看狀態 |
| `manual_required` | 安全替代方案也無法完成，才需要人工處理 |

## Railway 排程

正式環境沿用同一份程式與 Supabase PostgreSQL，在 Railway 建立一個 Cron Service：

- Command：`npm run automation:process`
- Schedule：每分鐘
- 需要與 HQ 相同的 `DATABASE_URL`、`DIRECT_URL`、LINE 與 external-effects 環境變數
- 不對外開放連接埠

另有受 `CRON_SECRET` 保護的 `GET/POST /api/cron/automation-jobs`，供受控環境人工補跑或健康檢查。

## 發布與回復

- migration plan：`standard`
- 回復程式時可停止 Railway Cron Service；既有作業紀錄保留，不影響主要交易。
- 不刪除 `automation_jobs` 表；需要重送時只能由受控 worker 依狀態處理。
