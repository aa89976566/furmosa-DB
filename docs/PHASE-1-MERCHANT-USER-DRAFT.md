# Phase 1 草案：MerchantUser（僅設計，不實作）

> **狀態：** draft — 等待產品確認後才允許改 `schema.prisma`／寫 migration／UI／API  
> **日期：** 2026-07-21  
> **依據：** `docs/FURMOSA-OS-DOMAIN-SPEC-v1.md` v1.1（FD-11）  
> **本文件禁止：** 實作 code、改 production schema、串 ECPay／LIFF／Appointment／Refill

---

## 0. 與現況差距（Code Gap）

| 項目 | CURRENT | Phase 1 需要 |
|------|---------|--------------|
| HQ 登入 | `User` + `lib/auth.ts`（cookie `furmosa_session`，jose JWT，bcryptjs） | **保留不動** |
| 店家登入 | **無** | 新增 `MerchantUser` + **分離** cookie／session |
| Merchant | 有主檔、無密碼欄 | 密碼**不可**放在 Merchant |
| POS 路由 | 無 `(pos)` | 新增 route group + placeholder 頁 |
| 權限 | 僅 HQ | session.merchantId 強制 scope |

既有可重用：`hashPassword`／`verifyPassword`／jose 模式；**不要**把 Merchant session 塞進同一個 `furmosa_session` payload 混用角色。

---

## 1. MerchantUser Prisma model 草案（文件用，未寫入 schema）

```prisma
// DRAFT ONLY — do not paste into schema.prisma until approved

model MerchantUser {
  id           String    @id @default(cuid())
  merchantId   String    // FK → Merchant.id（內部 cuid），非 business merchantId 字串亦可但需一致
  username     String    @unique // 第一版登入識別；或改 email @unique
  passwordHash String
  displayName  String?
  isActive     Boolean   @default(true)
  lastLoginAt  DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  merchant Merchant @relation(fields: [merchantId], references: [id], onDelete: Cascade)

  @@index([merchantId])
  // 注意：不要 @@unique([merchantId]) —— 保留未來一店多帳號
}
```

### 設計要求對照

| 要求 | 做法 |
|------|------|
| 密碼不存在 Merchant | 只在 MerchantUser |
| UI 一店一組帳號 | seed／後台先建 1 筆；UX 不暴露多帳號 |
| schema 保留一店多帳號 | `merchantId` 非 unique |
| Admin／Merchant session 分離 | 不同 cookie 名，例如 `furmosa_merchant_session` |
| 查詢以 session merchantId 為準 | server 從 JWT 取；忽略／拒絕 client body 的 merchantId |
| 不信任 client merchantId | middleware + 所有 POS loader 雙重檢查 |

### Session payload 草案

```ts
type MerchantSessionPayload = {
  merchantUserId: string;
  merchantId: string; // Merchant.id
  username: string;
  // 不含 HQ role；不含任意升高權限欄位
};
```

---

## 2. 權限與 Route 草案

### 2.1 Route groups

```text
app/
├── (main)/          # 現有 HQ — 繼續用 furmosa_session
├── (pos)/           # 新增 — furmosa_merchant_session
│   ├── login/       # 店家登入
│   ├── layout.tsx   # 驗證 Merchant session；無則導向 /pos/login
│   └── page.tsx     # 首頁 dashboard placeholders
└── (booking)/       # 非 Phase 1
```

建議 URL 前綴：`/pos/*`（與 HQ `/dashboard` 分離）。

### 2.2 授權矩陣（Phase 1）

| 能力 | HQ User | MerchantUser |
|------|---------|--------------|
| 看全站訂單／結算 | ✅ | ❌ |
| 看自己店今日預約卡 | —（尚未有資料） | placeholder |
| 建立 MerchantUser | ✅（後台手動／seed） | ❌ |
| 改自己密碼 | — | 可留 Phase 1.1 |
| 預約／換罐／叫貨 API | — | **Phase 1 不實作** |

### 2.3 Middleware 草案（語意）

1. `/pos/login` 公開。  
2. `/pos/**` 其餘：無 merchant session → redirect login。  
3. 若誤帶 HQ session 造訪 `/pos`：不提升為店家；需店家帳密。  
4. HQ `(main)` 不接受 merchant session 當 admin。

---

## 3. Phase 1 UI Wireframe（文字稿）

### 3.1 `/pos/login`

```text
┌─────────────────────────────┐
│  Furmosa 店家登入            │
│                             │
│  帳號  [________________]   │
│  密碼  [________________]   │
│                             │
│  [        登入        ]     │  ← 主按鈕 ≥44px
│                             │
│  問題請聯繫 Furmosa 總部     │
└─────────────────────────────┘
```

錯誤：「帳號或密碼不正確」——不揭露是帳號還是店家停用細節可再定。

### 3.2 `/pos` 登入後首頁（僅 IA + placeholder）

```text
┌──────────────────────────────────────────┐
│ 〇〇寵物美容（店名）          [登出]      │
├──────────────────────────────────────────┤
│ 今日預約          （數字或「—」）         │
│ 待確認            （—）                   │
│ 待交付換罐        （—）                   │
│ 庫存提醒          （—）                   │
│ 一鍵叫貨          （即將開放）            │
├──────────────────────────────────────────┤
│ ※ Phase 1 僅帳號與骨架；預約／換罐／叫貨 │
│   功能尚未開放。                         │
└──────────────────────────────────────────┘
```

卡片可點但進入「即將開放」空態即可；**不要**在 Phase 1 做真資料查詢（除顯示店名）。

### 3.3 UX 原則（對齊 Domain Spec §13）

- 無 Asset／Event／Reservation 字樣  
- 手機優先、大按鈕  
- 一屏一個主動作（此頁主動作＝掃視今日狀態；登出為次要）

---

## 4. Migration 與測試計畫（確認後才執行）

### 4.1 Migration（未來）

1. 新增表 `merchant_users`（或 Prisma 預設表名）。  
2. **不**改 Merchant 既有欄位。  
3. Seed：為 1～2 家測試店建立一組帳密（密碼 hash）。  
4. 文件化：正式店帳密由 HQ 私下發放。

### 4.2 測試計畫

| 測試 | 預期 |
|------|------|
| 正確帳密登入 | 寫入 merchant cookie；進 `/pos` |
| 錯誤密碼 | 不發 session |
| `isActive=false` | 拒絕登入 |
| 持 HQ cookie 打 POS API | 401／導向店家登入 |
| 持 merchant cookie 打 HQ 敏感頁 | 拒絕 |
| loader 偽造 body.merchantId 為他店 | 仍只回 session 自己的店（未來有資料時） |
| 同一 merchantId 可插入第二個 MerchantUser | schema 允許（UI 第一版可不暴露） |
| 既有 HQ 登入／測試 | 全數回歸通過 |

### 4.3 明確不在 Phase 1

- Appointment／RefillOrder／Payment／ECPay／LIFF  
- 改 JarCode／MemberPointsLedger 語意  
- 重構寄賣庫存  
- Event Store  

---

## 5. 尚未確認的問題（請產品拍板）

| # | 問題 | 建議 |
|---|------|------|
| P1-1 | 登入欄用 `username` 還是 `email`？ | username（門市好記） |
| P1-2 | cookie 名稱？ | `furmosa_merchant_session` |
| P1-3 | Phase 1 是否做 HQ 後台「建立店家帳號」UI？ | 可先 seed＋SQL／script |
| P1-4 | 密碼政策（長度／重設）？ | 最少 8 碼；重設先人工 |
| P1-5 | 一店一號是否要在 DB 用 partial unique 約束？ | **不要**；只靠營運約定 |

---

## 6. 確認後才允許的下一步

產品回覆「Phase 1 草案 OK」後，下一輪才可以：

1. 開實作（改 schema + migration + `/pos` login shell）  
2. 仍維持單 PR／小步；不做預約換罐  

**現在停下，等待確認。**
