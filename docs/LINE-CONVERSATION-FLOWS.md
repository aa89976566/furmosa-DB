# LINE 機器人對話機制（按鈕 → 方向 → 結果）

路由入口：`lib/line/handle-event.ts`  
文字解析：`lib/line/parse-message.ts`  
Postback：`lib/line/postback-actions.ts`  
進行中流程優先序：**開戶 `register` > 開箱 `jiba_unbox` > 一般功能**

開戶進行中會把開箱標成 `pausedForRegister`，背景 upsert 也不可覆寫開戶 session。

---

## 0. 總覽（底部 Rich Menu 2×2）

| 按鈕 | 觸發文字 | 方向 | 結果 |
|------|----------|------|------|
| 一起野放 | `一起野放`（別名：野放一下） | 清空進行中 session → 野放選單 | 垂直三鍵：嗷嗚計劃／活動中心／開箱任務 |
| 預約美容 | `預約美容`（別名：漂亮一下） | 清空 session | 封面＋「還在吹毛」類不便文案（尚未上線預約） |
| 換罐計劃 | `換罐計劃`／`換罐計畫` | 清空 session → 換罐選單 | 我要換罐（有 LIFF 時）＋介紹／開戶／Q&A／兌換優惠券／輸入序號 |
| 回家 | `回家`（別名：還有很多故事） | 清空 session | 官網（狗屋）＋ Instagram（院子）連結 |

---

## 1. 換罐計劃選單

| 按鈕 | 觸發 | 方向 | 結果 |
|------|------|------|------|
| 我要換罐 | URI → LIFF refill | 離開聊天流程 | 開啟換罐付款／預約 LIFF（需設定 `LINE_LIFF_ID_REFILL`） |
| 介紹 | 文字 `介紹` | 略過開箱／開戶 session | 換罐介紹 Flex（封面圖＋說明＋狗框背景） |
| 幫毛孩開戶 | 文字 `幫毛孩開戶`／`立即開戶`／`開戶` | **開始開戶**；暫停開箱 | 見 §3 開戶流程 |
| Q&A | 文字 `Q&A` | 略過 session | FAQ Flex |
| 兌換優惠券 | 文字 `兌換優惠券` | 略過 session → 折價券邏輯 | 未開戶：開戶閘道；已開戶：兌換美容折價券 |
| 輸入序號 | 文字 `輸入序號` | postback `jd=jar_enter` | 未開戶：開戶閘道（可開完接回序號）；已開戶：請輸入罐底 8 碼 |

罐底 **8 碼數字**：走兌換序號 → 成功記點／失敗提示。

---

## 2. 一起野放選單

| 按鈕 | 觸發 | 方向 | 結果 |
|------|------|------|------|
| 嗷嗚計劃 | 文字 `嗷嗚計劃` | 青蛙專案 | 封面圖＋「青蛙誰在怕」對話（可帶專案網址） |
| 活動中心 | 文字 `活動中心`／`沒梗了` | 活動中心 | 「沒梗了」封面＋短對話 |
| 開箱任務 | 文字 `開箱任務` | **雞霸開箱狀態機** | 見 §4 |

---

## 3. 開戶流程（`flow=register`）

觸發：`幫毛孩開戶`／`立即開戶`／`開戶`／postback `jd=jar_reg`

| 步驟 | 使用者動作 | 機器人回覆 | 下一狀態 |
|------|------------|------------|----------|
| name | 傳暱稱（例：小美） | 請留手機 | phone |
| phone | 傳手機（例：0912345678） | **合作美容店 Flex 按鈕** | store |
| store | **點店名 postback** `jd=store&c=<slug>` | 「毛孩叫什麼名字呀？」 | pet_name |
| store | 打字／亂點文字 | 提示請點按鈕＋重送店家清單（**不會**清 session、**不會**進開箱） | store |
| store | 傳「取消」 | 暫停開戶、回選單 | （結束） |
| pet_name | 傳毛孩名 | 種類按鈕（犬／貓／…） | species |
| species | 點 `jd=sp&c=…` | 品種提示（或「其他」自由填） | breed / pet_other |
| breed → birthday | 文字或「略過」 | 確認摘要＋確認／重填 | confirm |
| confirm | `jd=reg_ok` | 建立會員＋換罐提示 | （結束） |
| confirm | `jd=reg_no` | 取消開戶 | （結束） |

開戶期間：開箱對話標記 `pausedForRegister=true`，訊息閘道不會進開箱。

---

## 4. 開箱任務（雞霸兩片，`jiba_unbox`）

觸發：選單「開箱任務」→ 封面＋介紹 →「我要參加」等

| 狀態 | 問什麼 | 成功下一狀態 | 備註 |
|------|--------|--------------|------|
| CAMPAIGN_INTRO / SHOW_RULES | 參加／看規則／不要 | 報名或結束 | |
| ASK_RECIPIENT_NAME | 收件人姓名 | ASK_RECIPIENT_PHONE | 開箱文，非開戶暱稱 |
| ASK_RECIPIENT_PHONE | 收件手機 | ASK_STORE | |
| ASK_STORE | 輸入 7-11 門市關鍵字 | CONFIRM_STORE | 候選按鈕 `選門市1…` |
| CONFIRM_STORE | 選候選／重選門市 | ASK_INSTAGRAM | |
| ASK_INSTAGRAM | `@` 帳號 | ASK_PET_NAME | |
| ASK_PET_NAME | 開箱毛孩名（可略過） | ASK_CONTENT_LICENSE | 文案含「開箱的毛孩」 |
| ASK_CONTENT_LICENSE | 同意／不同意 | SHOW_ORDER_CONFIRMATION | |
| SHOW_ORDER_CONFIRMATION | 確認送出 | PENDING_REVIEW | 之後審核／匯款指引 |

傳「取消」「重來」可結束申請。  
換罐選單捷徑（介紹／開戶…）會讓開箱讓路。

---

## 5. 回家

| 按鈕 | 觸發 | 結果 |
|------|------|------|
| 進狗屋（官網） | URI | furmosa.com |
| 去院子（IG） | URI | Instagram |

---

## 6. 常見 Postback（`jd=`）

| data | 用途 |
|------|------|
| `jd=store&c=` | 開戶選合作店 |
| `jd=sp&c=` | 開戶選毛孩種類 |
| `jd=reg_ok` / `jd=reg_no` | 開戶確認／重填 |
| `jd=jar_reg` | 開始開戶 |
| `jd=jar_enter` | 輸入序號 |
| `jd=hub_jar` / `hub_chaos` / `hub_home` | 世界選單 |
| `jd=cp_groom` | 美容折價券 |
| `jd=chaos_unbox` 等 | 野放子項（後備） |

---

## 7. 除錯原則

1. 若開戶選店後出現「收件人／7-11／開箱的毛孩」→ 開箱搶線，應檢查 `lineChatSession.flow` 是否仍為 `register`、`pausedForRegister` 是否為 true。  
2. 開戶選店**必須**點 Flex 按鈕（postback），不要打字店名。  
3. 開箱門市是 **7-11**；開戶門市是 **美容合作店**——兩套清單，不可混用。
