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
| 換罐計劃 | `換罐計劃`／`換罐計畫` | 清空 session → 換罐選單 | 什麼是換罐計劃？／開戶／線上預購換罐／輸入序號／點數換折價／毛爸媽常問 |
| 回家 | `回家`（別名：還有很多故事） | 清空 session | 官網（狗屋）＋ Instagram（院子）連結 |

---

## 1. 換罐計劃選單

順序（台灣 20–40 毛爸媽口吻）：

| 順序 | 按鈕 | 觸發 | 方向 | 結果 |
|------|------|------|------|------|
| 1 | 什麼是換罐計劃？ | 文字 `什麼是換罐計劃？`（別名：介紹） | 略過開箱／開戶 session | 換罐介紹 Flex |
| 2 | 幫毛孩開戶 | 文字 `幫毛孩開戶`／`立即開戶`／`開戶` | **開始開戶**；暫停開箱 | 見 §3 開戶流程 |
| 3 | 線上預購換罐 | URI → LIFF refill | 離開聊天流程 | 線上付換罐款／預購下一罐（需 `LINE_LIFF_ID_REFILL`） |
| 4 | 輸入序號（主色 highlight） | 文字 `輸入序號` | `jd=jar_enter` | 未開戶：開戶閘道；已開戶：請輸入罐底 8 碼 |
| 5 | 點數換折價 | 文字 `點數換折價`（別名：兌換優惠券） | 折價券邏輯 | 未開戶：開戶閘道；已開戶：兌換美容折價券 |
| 6 | 毛爸媽常問 | 文字 `毛爸媽常問`（別名：Q&A／常見問題） | 略過 session | FAQ Flex |

無 LIFF 時略過第 3 鍵。罐底 **8 碼數字**：走兌換序號 → 成功記點／失敗提示。

### 合作店（介紹內「查看合作店」）
- 故事卡 carousel：開頭「空罐回來的地方」→ 依區域分卡列店名 → CTA「幫毛孩開戶」
- **不顯示**測試／對照店（如 seed「錯誤店家對照」）

---

## 2. 一起野放選單

| 按鈕 | 觸發 | 方向 | 結果 |
|------|------|------|------|
| 嗷嗚計劃 | 文字 `嗷嗚計劃` | 青蛙專案 | 封面圖＋「青蛙誰在怕」對話（可帶專案網址） |
| 活動中心 | 文字 `活動中心`（舊別名 `沒梗了` 仍可進） | 活動中心 | 封面＋ bark 短對話，邀請丟想法 |
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

觸發：正規化後精確 phrase（`開箱`／`開箱文`／`開箱任務`／`ugc`／`試吃開箱`／`開箱合作`／`合作開箱` 等），**不用 contains**。  
進行中 session 重送入口 keyword → **重播當前步驟**，不重設。  
無進行中 session → 只發邀請（我要參加／先不用），不立刻選商品。

| 狀態 | 問什麼 | 成功下一狀態 | 備註 |
|------|--------|--------------|------|
| CAMPAIGN_INTRO | 我要參加／先不用 | 報名選品或結束 | 先不用不建立申請 |
| ASK_PRODUCT | 雞霸／青蛙／貓草雞肉乾 30g | SHOW_BRIEF | LINE 按鈕；payload 為「選…」 |
| SHOW_BRIEF | 投稿事項＋399/886 免運加購說明（貓草雞肉乾會說明首頁用途） | ASK_RECIPIENT_NAME | 「好，開始填資料」或「我了解用途，開始填資料」 |
| ASK_RECIPIENT_NAME | 收件人姓名 | ASK_RECIPIENT_PHONE | 開箱文，非開戶暱稱 |
| ASK_RECIPIENT_PHONE | 收件手機 | ASK_STORE | |
| ASK_STORE | 輸入 7-11 關鍵字／門市查詢 | CONFIRM_STORE | 候選 Flex 按鈕；選門市時「介紹」不當離開 |
| CONFIRM_STORE | 選候選／重選門市 | ASK_INSTAGRAM | |
| ASK_INSTAGRAM | `@` 帳號 | ASK_PET_NAME | |
| ASK_PET_NAME | 開箱毛孩名（可略過） | ASK_CONTENT_LICENSE | |
| ASK_CONTENT_LICENSE | 同意／不同意（單一 Flex 按鈕卡） | SHOW_ORDER_CONFIRMATION | 接受「同意」／「我同意」 |
| SHOW_ORDER_CONFIRMATION | 確認送出 | PENDING_REVIEW | 之後審核／匯款指引 |

傳「取消」「重來」可結束申請。  
點「開箱任務」若有舊申請：問「接著上次／重新開始」，避免開戶後誤續開箱。  
換罐選單捷徑在**非選門市**時會讓開箱讓路；選門市時「介紹」會當雜訊重問門市。

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
