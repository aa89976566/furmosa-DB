# 計劃：www.furmosa.com MSCHF 式凍乾目錄

> 狀態：**優先進行**（綠界／Shopify 金流暫緩；先解決網站目錄）  
> 更新：2026-08-01

## 目標

做出 **MSCHF Works 式編號目錄**：每個產品一列／一頁，落地在：

- 列表：`https://www.furmosa.com/collections/all`
- 單品：`https://www.furmosa.com/products/[handle]`（或同等編號路徑）

視覺與資訊架構對齊現有「匠寵凍乾目錄」首頁（`works-page`），而不是再做一層 Shopify 主題複製品。

## 現況（已查）

| 項目 | 狀態 |
|------|------|
| `www.furmosa.com` | Vercel Next.js「匠寵凍乾目錄」；**不在** `furmosa-DB` repo |
| `/collections/all` | **404**（www） |
| 首頁「全部商品」 | 外連 `https://furmosa.com/collections/all`（Shopify） |
| 首頁 `projects` | **空陣列** → 編號列出現 `????` 佔位 |
| Shopify 商品源 | `furmosa.com/products.json` 約 **25** 筆可同步 |

## 分階段

### Phase 0 — 取得目錄站原始碼（阻擋項）

目錄站程式不在本 repo。需其一：

1. 打開／授權 **www 目錄站** 的 GitHub repo 給此 agent；或  
2. 在新 repo／本 monorepo 新建 `apps/catalog`，並把 Vercel `www.furmosa.com` 指到該專案。

### Phase 1 — `/collections/all`（本輪核心）

- MSCHF 式編號清單（id、品名、縮圖／色塊、狀態）
- 資料來源優先：Shopify Storefront／`products.json` 同步（唯讀）
- 首頁「全部商品」改指 `https://www.furmosa.com/collections/all`
- 修正 `????`：用真實商品填 `projects`（或列表改由 `/collections/all` 承擔）

### Phase 2 — 單品頁

- 每商品一頁（圖、簡述、價格）
- CTA：暫可連 Shopify 結帳／加入購物車連結；**自建綠界結帳列為後續**（見下方備忘）

### Phase 3 —（後續，非本輪）自建綠界支付

- 不經 Shopify Checkout，直接綠界 AIO（可复用 `furmosa-DB` 的 ECPay 模組經驗）
- 需另做購物車、運費、訂單、webhook

## 刻意不做（本輪）

- 不改 Shopify 綠界 App／金流設定  
- 不把 HQ／POS（`furmosa-DB`）與目錄站混成同一部署  
- 不做完整自建結帳（除非 Phase 1–2 完成後再開）

## 驗收

- [ ] `www.furmosa.com/collections/all` 200，列出全部上架凍乾  
- [ ] 每列可進單品頁（或明確 CTA）  
- [ ] 首頁不再只外連 Shopify collections；`????` 消失或僅用於「即將上架」  
- [ ] 桌機／手機可讀、品牌感維持編號目錄（非電商卡片牆）

## 相關決策備忘

- `furmosa.com` = Shopify 商店（暫留結帳）  
- `www.furmosa.com` = 品牌目錄（本計劃主場）  
- 綠界多人付款問題：管線可進刷卡頁；失敗多為 3D（V0）等 — **排在目錄之後再處理**
