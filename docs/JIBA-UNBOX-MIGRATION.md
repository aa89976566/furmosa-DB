# 雞霸兩片開箱 — Migration 計畫

## 變更摘要

新增 UGC 活動對話／審核／付款狀態表，**不修改**既有 `orders` 欄位結構；活動草稿訂單仍寫入 `orders`（`status=draft` → `pending_review` → `awaiting_shipping_payment` → `confirmed`）。

## Migration

檔案：`prisma/migrations/20260726140000_ugc_campaign_unbox/migration.sql`

| 表 | 用途 |
|---|---|
| `campaigns` | 活動定義（slug=`jiba-two-piece`） |
| `campaign_applications` | 申請＋收件／IG／授權／審核／運費 token／`shipping_queue_status` |
| `conversation_sessions` | 對話狀態機（唯一真相） |
| `conversation_messages` | 完整時間軸 |
| `order_reviews` | 壽司匠審核決策 |
| `status_audit_logs` | 狀態轉換稽核 |

Seed：`camp_jiba_two_piece` / `jiba-two-piece`。

## 部署順序

1. 合併 PR 後由 Vercel `prisma migrate deploy` 套用
2. 確認 `/campaigns/jiba-two-piece` 可開
3. LINE「開箱任務」→ cover → Quick Reply
4. 送審後訂單**不得**出現在出貨隊列，直到付款成功

## 出貨門禁

`shipping_queue_status` 預設 `NOT_READY`。僅在運費 `PAID` 後改為 `QUEUED` 並建立 `Shipment(pending)`。
