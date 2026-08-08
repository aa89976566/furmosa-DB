# 壽司匠早安 — 來源 Registry 與授權查證

查驗日期：**2026-08-08**  
原則：不可臆造 feed；查不到或授權不清就不接；本階段 **全部 enabled=false**（無商業授權）。

## 查證結果摘要

| sourceId | 地區 | 官方文件 | 授權 | enabled | 決定 |
|----------|------|----------|------|---------|------|
| moa_tw_rss | TW | https://www.moa.gov.tw/ws.php?id=9817 | 非商業用途免費使用 | false | 商業用途不可接 |
| avma_rss | GLOBAL | https://www.avma.org/news/rss-feeds 、https://www.avma.org/terms-use | RSS reader／個人非商業 | false | 不可接 |
| woah_wahis | GLOBAL | WOAH disease data collection | 授權不清；內容偏疾病 | false | 不接 |
| taipei_zoo | TW | 官網無 RSS 一手文件 | 無官方 feed | false | 不接（禁 scraping） |
| fixture_placeholder | TW | 本文件 | 僅測試 | false | 永不對真實網路發請求 |

## 農業部 RSS（已見端點型式，未啟用）

官方頁列出服務項目；HTML 可見：

- `/open_data.php?format=rss&func=news_hot`
- `/open_data.php?format=rss&func=news_agri`
- 等（host: `www.moa.gov.tw`）

版權宣告原文重點：可於**非商業用途**免費使用，須標示出處，勿改 XML 連結模式。

## data.gov.tw 認領養

OGDL 第1版允許商業利用，但**產品決策不做「今日收容所短訊」**，不納入晨報新聞源。

## 已知限制

- 本階段無合法穩定之商用寵物新鮮事 feed → **無 live fetch**
- Preview 僅跑 fixture ingest＋安全框架
- 取得商業授權後，才可將對應 `enabled` 改 true（另開變更）
