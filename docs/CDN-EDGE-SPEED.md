# CDN Edge 加速（為何「最快網站」可以這麼快）

參考對象在 DevTools Network 顯示：

| Header | 意義 |
|--------|------|
| `X-Cache: TCP_HIT` / `x-vercel-cache: HIT` | HTML／資產由 **CDN 邊緣**直接回應，不回 Origin 重算 |
| `X-Check-Cacheable: YES` | 資源被標成可快取 |
| Transferred ≪ Resources | Gzip／Brotli 壓縮（Vercel 預設開啟） |

## Furmosa 對齊做法

1. **公開 HTML 可快取**：`/login`、`/store-redeem`、`/pos/login` 設 `s-maxage` + `stale-while-revalidate`（見 `next.config.mjs`、`middleware.ts`）。
2. **匿名路徑不讀 cookie**：`/store*`、`/liff`、icons 在 middleware 早退，避免 session 驗證擋掉 CDN HIT。
3. **登入殼靜態化**：`/login` 使用 `force-static`；`?next=` 改由客戶端讀取。
4. **核銷頁 ISR**：`/store-redeem` `revalidate = 60`，店家清單走 Runtime Cache + Data Cache。
5. **後台 Origin 加速**：產品／廠商目錄熱路徑疊加 `@vercel/functions` Runtime Cache（認證頁 HTML 仍 `private, no-store`，但 TTFB 接近 HIT）。

## 上線後如何驗證

1. 開無痕視窗打 `/login` 與 `/store-redeem` 兩次。
2. Network → 文件請求 → Response Headers 看 `x-vercel-cache`：第二次應為 **HIT**（或 `STALE` 後背景更新）。
3. 傳輸量應明顯小於未壓縮資源總量。
