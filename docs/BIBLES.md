# Furmosa Document Bibles

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

---

## Claude Code 交接包（工程）

根目錄 `CLAUDE.md` 為入口。配套：

| 文件 | 用途 |
|------|------|
| `docs/SYSTEM_OVERVIEW.md` | 系統邊界與旅程 |
| `docs/ARCHITECTURE.md` | 模組與技術架構 |
| `docs/BUSINESS_RULES.md` | 從程式抽出的業務規則 |
| `docs/DATABASE.md` | Schema／關係／PII |
| `docs/API_AND_DATA_FLOW.md` | API／Actions／時序圖 |
| `docs/SECURITY_AUDIT.md` | 靜態安全發現 |
| `docs/PERFORMANCE_AUDIT.md` | 效能發現 |
| `docs/TECH_DEBT.md` | 技術債 |
| `docs/TEST_STRATEGY.md` | 測試現況與缺口 |
| `docs/ENVIRONMENT.md` | 環境變數（僅名稱） |
| `docs/CLAUDE_REVIEW_PLAN.md` | 分階段檢視計畫 |
| `docs/PHASE-0-BASELINE.md` | Phase 0 健康檢查報告 |
