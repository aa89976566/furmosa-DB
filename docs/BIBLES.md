# Furmosa Document Bibles

## POS Rules

- POS 共通入口與帳號生命週期：`docs/POS-RULES-v1.md`（已選定只對店家補貨增加 `received`；等待 schema 計畫與 runtime 統一）
- 財務、庫存、退款與結算領域合約：`docs/POS-01-DOMAIN-CONTRACT.md`
- 店員任務流程：`docs/MERCHANT-POS-FLOW.md`

## Stages

| Stage | 內容 | 狀態 |
|-------|------|------|
| 1 | Vision · Domain · Experience · Merchant Auth／Restock／Flow | ✅ |
| 2 | Reality Gate | ✅ |
| 3 | Booking MVP Round 1（Availability + Appointment） | ✅ |
| **4** | **Booking Round 2：LINE 確認／提醒** | ⭐ |
| 5 | Refill／Payment／Jar | 🚧 進行中（見 `docs/PLAN-liff-refill-payment.md`） |

## Booking Constitution

- Booking 不最佳化排程；只暴露可約時段與顧客意圖；Merchant 最終決定。  
- Customer 預約的是 **Merchant**，不是員工。  

詳見 `docs/BOOKING-MVP-PLAN.md`（**v1.0-frozen**）。
