# Furmosa Document Bibles

**現在不要再開書、不要寫 Booking。** Stage 2 = 真實店實測。

## Stages

| Stage | 內容 | 狀態 |
|-------|------|------|
| **1** | Vision · Domain · Database · Merchant Flow · Experience；Phase 1+2 on `main` | ✅ |
| **2** | 豬窩手機 15–30 分鐘 → Observation → Decision 寫回 Experience | ⭐ 現在 |
| **3** | Booking 完整鏈（通過 Stage 2 閘門後才開） | ⏳ |

## 文件層（有需要再補齊，不優先）

| # | 層 | 現況 |
|---|-----|------|
| 01 | Vision | 散見 Domain／Experience |
| 02 | Domain | `FURMOSA-OS-DOMAIN-SPEC-v1.md` |
| 03 | Experience | `FURMOSA-EXPERIENCE-BIBLE-v1.md` |
| 04 | Reality | **循環**：寫進 Experience §8，不另開 Bible |
| 05 | UI | 未開始（Stage 2 後） |
| 06 | Database | Schema／migrations |
| 07 | Engineering | DEPLOY／PR |

## 循環

```text
Experience（Hypothesis）
  → Reality（豬窩實測）
  → Decision 回寫 Experience
  →（通過）Booking 一次做完
  → Reality 再驗證
```

## 實測入口

- 腳本：`docs/MERCHANT-POS-USABILITY-TEST-v1.md`
- 回寫：`docs/FURMOSA-EXPERIENCE-BIBLE-v1.md` §8、§2.3
- Production：merge 後等 Vercel；POS `/pos/login`
