# Furmosa Document Bibles

Furmosa OS 以五本「聖經」分層，避免 Code 與體驗互相搶方向盤。

| # | Bible | 檔案（現況） | 回答 | 狀態 |
|---|--------|--------------|------|------|
| 01 | Domain Bible | `FURMOSA-OS-DOMAIN-SPEC-v1.md`（feature branch／後續合併） | 可不可以、規則是什麼 | ✅ 成熟 |
| 02 | Experience Bible | **`FURMOSA-EXPERIENCE-BIBLE-v1.md`** | 人怎麼過完一天、感受什麼 | ⏳ v1.0-draft |
| 03 | UI Bible | （尚未） | 視覺與元件 | ⏳ |
| 04 | Database Bible | Prisma schema + migrations（工程庫） | 資料如何長期正確 | ✅ 可擴充 |
| 05 | Engineering Bible | DEPLOY／PLAN／驗收文件 | 怎麼安全交付 | ⏳ 分散中 |

## 實作閘門

```text
Experience Bible approved
        ↓
UI Bible（對應畫面）
        ↓
Engineering 切片
        ↓
Code
```

**現在禁止：** 未批准 Experience 就開 Phase 3／Booking／Jar／LINE 實作。

## 產品 Roadmap（體驗優先）

```text
Merchant Test（叫貨）
  → Booking Experience
  → Jar Exchange Experience
  → POS 完整價值（今天的狗／今天的換罐）
```
