# 換罐 LIFF 付款 — 上線檢查清單

## 測試資料一鍵灌入

先確認已 `prisma migrate deploy`（含 `20260728010000_refill_payment`），再執行：

```bash
# 使用 .env 的 DATABASE_URL／DIRECT_URL
npm run refill:seed-test
```

會建立：

| 項目 | 內容 |
|------|------|
| 測試店 | `MER-REFILL` 匠寵換罐測試店 |
| POS | `refilltest` / `furmosa2026` |
| 對照店 | `MER-OTHER`（測跨店不可交付）`othertest` / `furmosa2026` |
| 會員 A | Milo，issued 罐 `88001101`／`88001102` → NT$99 |
| 會員 B | 小花，無空罐 → NT$129 |
| 新罐庫存序號 | `88002201`–`88002204` |
| POS 待換罐 | 一筆 Milo 已付款待收空罐訂單 |

腳本可重跑（冪等）。

---

## 環境變數

| 變數 | 說明 |
|------|------|
| `LINE_LIFF_ID_REFILL` | 換罐 LIFF App ID |
| `ECPAY_MERCHANT_ID` | 綠界商店代號 |
| `ECPAY_HASH_KEY` | HashKey |
| `ECPAY_HASH_IV` | HashIV |
| `ECPAY_PAYMENT_URL` | Stage 或正式 AIO URL |
| `ECPAY_RETURN_URL` | 可選；預設 `{APP_URL}/api/payments/ecpay/return` |
| `ECPAY_ORDER_RESULT_URL` | 可選；預設 `{APP_URL}/api/payments/ecpay/callback` |
| `NEXT_PUBLIC_APP_URL` | 公開網域（組 return／callback 用） |
| `WAITING_FOR_JAR_RESERVATION_DAYS` | 忘帶罐保留天數（預設 14） |

## LIFF 設定

1. LINE Login 頻道 → 新增 LIFF  
   - Endpoint：`https://<domain>/liff/refill`  
   - Size：Full  
2. 將 LIFF ID 寫入 `LINE_LIFF_ID_REFILL`  
3. 富選單／聊天「換罐計劃」會在已開戶＋已設定時顯示「我要換罐」  
4. 店家 QR：`https://liff.line.me/<LIFF_ID>?storeId=<Merchant.merchantId 或 id>`

## 綠界設定

1. 使用 Stage 金鑰驗證 CheckMacValue  
2. OrderResultURL（Server）：`https://<domain>/api/payments/ecpay/callback`  
3. Client 導回：`https://<domain>/api/payments/ecpay/return`  
4. **付款真相以 callback 為準**；前端僅 polling 狀態  

## Migration

```bash
npx prisma migrate deploy
```

Migration：`prisma/migrations/20260728010000_refill_payment`

## 上線前

- [ ] migrate deploy 成功  
- [ ] ECPay Stage 走完一筆 NT$99  
- [ ] 重複 callback 不重複改狀態  
- [ ] 金額竄改（TradeAmt≠訂單）拒絕對帳  
- [ ] 無 `issued` 舊罐 → 走首罐 129  
- [ ] 有 `issued` 舊罐 → 99  
- [ ] 跨店 POS 無法交付  
- [ ] 完成交付只加 1 點；重複 complete 不加點  
- [ ] 忘帶空罐：保留／補 30 兩路  
- [ ] 既有 LINE 兑碼（unused→used）仍可用  
