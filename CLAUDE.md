# Claude 專案入口

開始任何分析、修改或部署前，依序讀取：

1. [AGENTS.md](AGENTS.md)：產品、資料、安全與工作方式。
2. [config/deployment-targets.json](config/deployment-targets.json)：部署環境的唯一機器可讀事實。
3. [DEPLOY.md](DEPLOY.md)：正式發布的唯一操作程序。
4. [.cursor/rules/claude-cursor-gated-workflow.mdc](.cursor/rules/claude-cursor-gated-workflow.mdc)：涉及 Cursor 時的協作與驗收程序。

不得自行從舊對話、舊網址、瀏覽器目前頁面或過期文件推測正式環境。若資訊衝突，以 `config/deployment-targets.json` 為環境角色依據並停止部署，先修正衝突。

對外回報「已部署」前，必須確認：指定 PR 與 exact SHA 已通過受控 Release、Railway 回報相同 merge commit 成功，且對 manifest 內的 Production origin 完成 smoke。Vercel 成功只能回報為 Preview 成功。
