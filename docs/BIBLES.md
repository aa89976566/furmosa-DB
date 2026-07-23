# Furmosa Document Bibles

Furmosa OS 用分層文件避免 Code 與體驗互相搶方向盤。  
**現在不要再新增一本 Bible。** 缺的是 Reality（真實觀察），用循環補上，不是再開文件。

## 文件層（命名目標）

| # | Bible | 回答 | 現況 |
|---|--------|------|------|
| 01 | Vision Bible | 為什麼做 | ⏳ 尚未獨立成檔（願景散見 Domain／本循環） |
| 02 | Domain Bible | 世界是什麼、規則可不可以 | ✅ 成熟（feature branch） |
| 03 | Experience Bible | 使用者旅程與情緒 | ⏳ `FURMOSA-EXPERIENCE-BIBLE-v1.md` |
| 04 | Reality | 真實世界怎麼用（**循環步驟，不是新書**） | ⏳ 合作店實測／觀察筆記 |
| 05 | UI Bible | 畫面與元件 | ⏳ 未開始 |
| 06 | Database Bible | Schema 如何長期正確 | ✅ 可擴充 |
| 07 | Engineering Bible | 怎麼安全交付 | ⏳ 分散於 DEPLOY／PR |

## 運作循環（比再開一本更重要）

```text
Vision
  ↓
Domain
  ↓
Experience（Hypothesis）
  ↓
Reality（合作店／HQ／顧客實測）
  ↓
回寫 Experience（保留／修改／刪除）
  ↓
UI
  ↓
Database（僅在 Reality 證明需要時）
  ↓
Engineering
  ↓
Reality（再次驗證）
```

**規則：** 實測結果回饋 Experience，**不**直接改資料表或程式當第一反應。

## 狀態標籤（所有決策必標）

| 標籤 | 意義 |
|------|------|
| **Hypothesis** | 我們認為會這樣用；尚未被真實行為證明 |
| **Validated** | 已在真實場景觀察（註明店／日期） |
| **Delete Candidate** | 可消失；優先刪而非加 |

## 實作閘門

```text
Experience 章節標 Validated（或明確接受風險的 Hypothesis）
        ↓
UI 細稿
        ↓
Engineering 切片
        ↓
Code
        ↓
再進 Reality
```

**現在禁止：** 未經驗證就開 Phase 3／Booking／Jar／LINE 大實作；禁止為了猜而加表。

## 產品 Roadmap（體驗＋現實）

```text
Merchant Reality（叫貨 15 分鐘）
  → 回寫 Experience
  → Booking（仍先畫旅程＋驗證）
  → Jar Exchange Reality
  → POS 完整價值
```
