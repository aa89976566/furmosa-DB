# Furmosa HQ System

> Furmosa 總部管理後台 — 將原本散落在多份 Google Sheet（食品下單、寄賣分成、換罐計畫、每週任務）的營運資料統一收斂為一套後台。

這是一套 **HQ Admin Web App**，提供總公司端的完整營運視角，目標是在保有清楚資料模型的前提下，做出可立即落地的 MVP，並保留後續對接官網、LINE、寄賣門市的擴充空間。

---

## 產品定位

| 角色 | 主要使用情境 |
|------|--------------|
| 總公司管理者 | Dashboard 看營收、庫存、寄賣門市表現、會員與點數狀況 |
| 內部營運同仁 | 管理廠商、客戶、產品、訂單、庫存異動、結算與任務 |
| 財務 | 寄賣月結、店家分潤、換罐贈品撥款 |
| 倉管 | 即時庫存、補貨警示、入出庫紀錄 |

---

## 技術棧

- Next.js 14 App Router · TypeScript · React 18
- Tailwind CSS · shadcn/ui · Lucide icons
- Recharts（Dashboard 視覺化）
- Prisma ORM · **SQLite（預設，零安裝）** / PostgreSQL（可切換）
- Auth：bcryptjs + jose（JWT cookie session，Email + 密碼登入）
- React Hook Form + Zod（後續表單）
- TanStack Table（後續複雜列表）
- Zustand（後續輕量 state）
- date-fns + next-themes

---

## 目錄結構

```
.
├── app/
│   ├── layout.tsx              # 全站 root layout
│   ├── page.tsx                # 重導到 /dashboard
│   ├── globals.css
│   └── (main)/                 # 全站受保護的 admin 區
│       ├── layout.tsx          # Sidebar + Topbar
│       ├── dashboard/
│       ├── vendors/[id]/
│       ├── customers/[id]/
│       ├── merchants/[id]/
│       ├── products/[id]/
│       ├── warehouses/
│       ├── orders/[id]/
│       ├── inventory/
│       │   └── transactions/
│       ├── settlements/[id]/
│       ├── members/[id]/
│       ├── points/
│       ├── rewards/
│       ├── redemptions/
│       └── tasks/
├── components/
│   ├── ui/                     # shadcn 元件
│   ├── layout/                 # Sidebar / Topbar
│   └── shared/                 # 共用元件 (StatCard, StatusBadge, EmptyState …)
├── features/
│   └── dashboard/              # Dashboard query + 圖表
├── lib/                        # prisma / format / labels / nav / utils
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── package.json
└── README.md
```

---

## 系統模組

| 模組 | 路徑 | 重點 |
|------|------|------|
| Dashboard | `/dashboard` | KPI 卡 + 30 天營收 + 來源分布 + 熱銷 + 寄賣排行 + 庫存警示 + 待辦 |
| 廠商 Vendors | `/vendors` | 廠商主檔、聯絡方式、付款條件，可從商品點到廠商詳情 |
| 客戶 Customers | `/customers` | 客戶資料 + 累計消費 + 最近訂單 |
| 寄賣店家 Merchants | `/merchants` | 寄賣 / 快閃 / 旗艦 / 合作夥伴 + 分潤率 + 結算紀錄 |
| 產品 Products | `/products` | 含廠商連結、毛利、補貨點、各倉庫庫存 |
| 倉庫 Warehouses | `/warehouses` | 各倉 SKU 數、總件數、異動數 |
| 訂單 Orders | `/orders` | 來源切換 (官網/LINE/寄賣/手動)、狀態 / 付款 / 出貨 全分離 |
| 即時庫存 | `/inventory` | 各倉數量、補貨警示 |
| 庫存異動 | `/inventory/transactions` | 採購入庫、銷售出庫、調撥、盤點、退貨 |
| 寄賣結算 | `/settlements` | 月度結算、分潤 + 換罐贈品補貼分科目 |
| 會員 | `/members` | 點數帳戶、累計入點 / 兌換、LINE 綁定 |
| 點數帳本 | `/points` | 全站點數流水（序號 / 訂單 / 活動 / 兌換 / 過期） |
| 兌換商品 | `/rewards` | 點數可兌換的贈品 + 公司成本 |
| 兌換紀錄 | `/redemptions` | 履約寄賣店家 + 應付金額對帳 |
| 任務看板 | `/tasks` | todo / in_progress / blocked / done 四欄看板 |

---

## Business ID 命名規則

| 實體 | 範例 |
|------|------|
| 廠商 | `VEND-0001` |
| 客戶 | `CUST-0001` |
| 寄賣店家 | `MER-0001` |
| 商品 | `PROD-0001`，SKU `SKU-00001` |
| 倉庫 | `WH-MAIN`、`WH-SOUTH`、`WH-CONSIGN` |
| 訂單 | `ORD-202605-001` |
| 庫存異動 | `INV-202605-001` |
| 結算 | `SET-202605-001` |
| 會員 | `MEM-0001` |
| 贈品 | `RWD-0001` |
| 兌換 | `RED-0001` |
| 任務 | `TASK-0001` |

---

## 安裝與執行（三步驟，無需 Docker）

### 1. 環境需求

- Node.js 20+
- npm（或 pnpm / yarn）
- ~~PostgreSQL~~ 預設用 SQLite，**完全不用裝資料庫**

### 2. 一行指令把整套跑起來

```bash
cp .env.example .env
npm install
npm run db:setup     # = prisma db push + prisma db seed
npm run dev
```

打開 [http://localhost:3000](http://localhost:3000)，會跳轉到登入頁。

### 疑難排解：登入時出現 `Can't reach database server at localhost:5432`

代表執行中的 `DATABASE_URL` 仍指向 **PostgreSQL**，但本機沒有在 `5432` 跑資料庫。請依序檢查：

1. 專案根目錄 **`.env`** 與 **`.env.local`**（若存在）：`DATABASE_URL` 必須為  
   `DATABASE_URL="file:./dev.db"`（SQLite，無需 Docker）。
2. 關閉終端機裡曾 `export DATABASE_URL=postgresql://...` 的設定，或開新終端再跑 `npm run dev`。
3. 執行 `npm run db:setup` 產生 `prisma/dev.db` 與種子帳號後，**完全重啟** `npm run dev`。

### 3. 預設登入帳號

密碼皆為 **`furmosa2026`**

| Email | 角色 |
|-------|------|
| `admin@furmosa.com` | 系統管理員 |
| `finance@furmosa.com` | 財務 |
| `ops@furmosa.com` | 營運 |
| `wh@furmosa.com` | 倉管 |

> 上線前請務必到 `.env` 修改 `AUTH_SECRET`。

### （選用）改用 PostgreSQL

1. 編輯 `prisma/schema.prisma`，把 `provider = "sqlite"` 改回 `"postgresql"`
2. 若需要十進位精度，把 `Float` 改回 `Decimal`，`tags String` 改回 `String[]`
3. 編輯 `.env`：
   ```env
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/furmosa?schema=public"
   ```
4. 重新跑 `npm run db:setup`

### 開發指令

| Script | 用途 |
|--------|------|
| `npm run dev` | 開發模式 |
| `npm run build` | 編譯生產版本 |
| `npm run start` | 啟動生產伺服器 |
| `npm run prisma:studio` | 開 Prisma Studio 視覺化檢視資料 |
| `npm run db:reset` | 重置資料庫 + 重新灌 seed |

---

## Seed 假資料概覽

執行 `npm run prisma:seed` 後會建立：

- 4 位系統帳號（admin / finance / staff / warehouse）
- 8 個廠商
- 20 個客戶
- 12 個寄賣店家（含台北、台中、台南、高雄等）
- 40 個寵物用品（凍乾、主食罐、零食、保健、玩具、配件）
- 80 筆訂單（橫跨 4 種來源）
- 150+ 筆庫存異動
- 12 筆寄賣結算（草稿 / 審核中 / 已核准 / 已撥款）
- 30 位會員 + 80 筆點數紀錄
- 6 個兌換商品 + 15 筆兌換紀錄
- 12 筆任務（4 種狀態）

---

## 後續可擴充模組建議

- **官網對接**：用 webhook / API 把官網訂單寫入 `Order(source=website)`，同時寫 `pointLedger`（贈點）。
- **LINE Login + 序號集點**：完成「所有客戶皆可集點」的閉環，新增 `point_serials` / `serial_batches` 兩張表，序號發行可關聯到寄賣店家。
- **正式 Auth**：建議使用 NextAuth + 手機 OTP 或 LINE Login，並在 `User`、`Member` 之上做角色分流。
- **API 層**：將每個 feature folder 內加入 `services/`，封裝 query 與 mutation，再由 server actions / route handlers 暴露。
- **匯入舊資料**：寫 ETL 腳本將原本 4 份 Google Sheet 對映到對應 Prisma model。
- **更完整的盤點流程**：將 `InventoryTransaction(type=stocktake)` 升級成 `Stocktake + StocktakeItem` 雙表。
- **報表 / 匯出 CSV**：在 list 頁面加上 `export` 按鈕。
- **權限**：用 `User.role` + `middleware` 控制路由可見性。

---

## 授權

內部專案，未經許可請勿外傳。
