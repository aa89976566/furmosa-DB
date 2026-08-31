# 立即關閉店家身分寫入

正式寫入預設關閉。要關掉時：

1. 到 Vercel → furmosa-db → Production 環境變數
2. 刪除 `PARTNER_STORE_IDENTITY_WRITES`，或不要設成 `enabled`
3. 重新部署 Production

關掉後：

- 指定 HQ 也無法再確認或撤銷
- Preview 本來就不能寫入
- 已寫入的 MER-DEMO 紀錄不會被刪除

未另填 `PARTNER_STORE_IDENTITY_WRITERS` 時，只允許總部 HQ：admin、finance、ops、wh（@furmosa.com）。POS 不能寫入。
