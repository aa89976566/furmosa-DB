# Performance Audit（靜態）

**依據：** migrations、cache libs、列表頁、大型元件。未做 production profiling。

---

## 高影響／低成本

| 項目 | 證據 | 建議 |
|------|------|------|
| 維持／擴大熱路徑快取標籤失效正確性 | `lib/runtime-cache.ts`, `lib/hot-path-reads.ts`, `lib/cache-tags.ts` | mutation 後務必 `bustCacheTags`；加回歸測 |
| 訂單／出貨已分頁與虛擬列表 | `lib/list-pagination.ts`, `virtualized-rows.tsx`, orders／shipments pages | 套用到其他長列表（customers、jar codes） |
| Dashboard KPI 預聚合 | `lib/dashboard-kpi-snapshot.ts`, cron maintain-shipments | 確保 cron 成功；過期策略清楚 |
| Phase 0 DB 索引 | `20260723120000_perf_hot_path_indexes` | 新查詢對齊既有 index；避免無 where 全表 |

---

## 高影響／高成本

| 項目 | 證據 | 建議 |
|------|------|------|
| 超大 Client 表單 `order-form.tsx`（~1573 行） | `app/(main)/orders/new/order-form.tsx` | 拆步驟／lazy；減少一次載入選項 |
| Merchant detail actions 巨石（~807 行） | `app/(main)/merchants/[id]/actions.ts` | 拆 domain services；審 N+1 |
| HQ InventoryBalance 與 MerchantStock 雙軌 | schema + 寫入路徑不明 | 釐清 SSOT 後再優化查詢 |
| Serializable 預約事務在 PgBouncer | booking service + pooler | 監控 serialization failure；必要時直連或重試 |

---

## 低影響／低成本

| 項目 | 證據 | 建議 |
|------|------|------|
| `optimizePackageImports` 已開 | `next.config.mjs` | 新大型 lib 加入名單 |
| job-throttle 減重複維護 | `lib/job-throttle.ts`, POS reminders | TTL 文件化 |
| LINE 選單 24h 節流 | `lib/line/*-throttle.ts` | 保持，避免洗版成本 |

---

## 暫不建議

| 項目 | 原因 |
|------|------|
| 引入新快取基礎設施（Redis 等） | Runtime Cache + snapshot 已存在；除非量測證明不足 |
| Hobby 改 hourly cron | **會部署失敗**（Vercel Hobby 每日上限）；見 Round 2 經驗 |
| 全面改 Decimal 金額 | 正確但高風險／高成本；獨立專案 |
| 無量測下微優化 re-render | 先用 React Profiler／真實流量 |

---

## 已知模式（正面）

- Shipment queue counts／order source totals：分層 cache（`hot-path-reads.ts`）  
- Booking reminder 掃描 `take: 200`（`lib/booking/reminders.ts`）— 注意成長後需分頁游標  
- PDF 預設 limit；`all=1` 為逃生艙（效能＋安全張力）

---

## Build／Deploy

- `npm run build` 含 migrate deploy（失敗 echo skip）— Preview 需正確 env  
- 本機無 DB 時 static generation 可能錯（inventory／tasks 等）— 以 Vercel 為準  
- `serverComponentsExternalPackages: ['@prisma/client']` 避免錯誤打包  
