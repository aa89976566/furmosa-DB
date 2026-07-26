import {
  JIBA_BANK_TRANSFER,
  JIBA_SHIPPING_FEE,
  JIBA_SUPERVISOR_NAME,
} from '@/lib/campaigns/jiba-two-piece/constants';

export const JIBA_INTRO = `嗨，毛爸媽～這裡有兩片雞霸，想請你家毛孩幫忙開箱。

只要拍一支 Instagram Reels：
毛孩拿著雞霸自拍，或直接拍牠開吃的樣子都好。

發布時記得標記 @furmosa_food。
投稿內容可能會由匠寵轉發、剪輯，或用在官方網站、Instagram、LINE 與活動宣傳喔。

雞霸我們準備好，7-11 運費 NT$${JIBA_SHIPPING_FEE} 請毛爸媽自行負擔。

要一起讓毛孩來試試嗎？`;

export const JIBA_RULES = `規則很簡單，我們慢慢說：

① 會收到雞霸兩片
② 拍毛孩拿雞霸自拍，或拍牠開吃
③ 發布 Instagram Reels
④ 標記 @furmosa_food
⑤ 投稿內容可能經匠寵轉發、剪輯或用於活動分享

運費 NT$${JIBA_SHIPPING_FEE}，請自行負擔喔。

看完了，還想參加嗎？`;

export const JIBA_START_WORK = `好喔，那我們開始幫毛孩安排雞霸～

會先寄到你指定的 7-11。
一次問一小題就好，不急，慢慢填。`;

export const JIBA_ASK_NAME = `先從第一題開始喔。
收件人姓名是？`;

/** 姓名欄位驗證失敗：具體說明 + 範例（slot re-prompt） */
export const JIBA_NAME_ERROR = `這看起來不像收件人姓名耶～
請填真實姓名，例如：王小明`;

export const JIBA_NAME_RETRY = `再幫我們填一次收件人姓名好嗎？
例如：王小明、陳美玲`;

export const JIBA_ASK_PHONE = `再來請留下收件手機號碼～
這樣取貨有狀況時，才聯絡得到你。`;

export const JIBA_PHONE_ERROR = `這支號碼好像少了一點點耶。
請輸入 09 開頭、共 10 碼的手機號碼，謝謝你。
例如：0912345678`;

export const JIBA_ASK_STORE = `最後一個地址小問題～
請選一間你方便去領的 7-11。

直接輸入「門市名稱＋縣市區域」就可以。
例如：板橋新埔門市。`;

export const JIBA_STORE_ERROR = `門市名稱可以再寫清楚一點嗎？
例如：板橋新埔門市、台北市大安區某某門市`;

export const JIBA_ASK_IG = `門市找到了，謝謝你～
接著請問你的 Instagram 帳號是？
請輸入 @ 開頭的帳號喔。`;

export const JIBA_IG_ERROR = `Instagram 帳號要請用 @ 開頭喔。
例如：@furmosa_food`;

export const JIBA_ASK_PET = `那位要幫忙開箱的毛孩，叫什麼名字呀？
（也可以傳「略過」）`;

export const JIBA_PET_ERROR = `毛孩名字再跟我們說一次好嗎？
也可以傳「略過」先跳過這題喔。`;

export function jibaFieldRetryEscalation(helperName: string): string {
  return `這題卡住沒關係～
你可以再試一次，或直接說「找${helperName}」，我們請小幫手幫你填。`;
}

export const JIBA_LICENSE = `投稿前，跟你確認一件事喔。

參加活動代表你同意：匠寵可以在官方網站、Instagram、LINE 與活動宣傳中，轉發、編輯或使用這次投稿的照片與影片。

著作權還是屬於原創作者，我們只取得這次品牌宣傳需要的使用授權。

可以請你幫忙同意嗎？`;

export const JIBA_LICENSE_DECLINE = `沒關係，尊重你的決定～
這次申請我們先不送出，照片就好好留在家裡。`;

export const JIBA_SUBMITTED = `收到囉，謝謝你～

接下來會先請${JIBA_SUPERVISOR_NAME}幫你看一下資料，
也會核對你剛剛留下的內容與 LINE 對話。

確認完成後，再問你要不要現在轉帳運費 NT$${JIBA_SHIPPING_FEE}。

我們會再跟你聯絡，請稍等一下喔。`;

export const JIBA_APPROVED = `${JIBA_SUPERVISOR_NAME}看過了，資料沒問題～
你家毛孩正式參加開箱囉！

這單 7-11 運費是 NT$${JIBA_SHIPPING_FEE}。
要現在轉帳嗎？`;

export const JIBA_BANK_INFO = `好的，轉帳資訊在這裡：

銀行：${JIBA_BANK_TRANSFER.bankName}（${JIBA_BANK_TRANSFER.bankCode}）
帳號：${JIBA_BANK_TRANSFER.account}
金額：NT$${JIBA_SHIPPING_FEE}

轉完可以回「我已轉帳」，
或直接說「找${JIBA_SUPERVISOR_NAME}」，我們都會再幫你看。`;

export const JIBA_PAY_LATER = `好喔，不急～
想付的時候回「現在付款」，
或「找${JIBA_SUPERVISOR_NAME}」都可以。`;

export const JIBA_TRANSFER_NOTED = `收到了，謝謝你～
${JIBA_SUPERVISOR_NAME}會幫忙對帳。
對上了再跟你說，雞霸就可以出發囉。`;

export const JIBA_FIND_HELPER = `好的，幫你請${JIBA_SUPERVISOR_NAME}來看。
資料先幫你留著，小幫手會盡快回覆你喔。`;

export const JIBA_PAID = `運費確認到了，謝謝你～
雞霸準備幫你家毛孩寄出。

出貨後會再通知你；到時候記得幫毛孩挑個好角度拍照喔。`;

export const JIBA_REJECTED = `不好意思，這次名額先額滿了。

不是毛孩不夠可愛，是雞霸數量有限。
下一輪有機會，我們再找你喔。`;

export const JIBA_PENDING_HINT = `還在等${JIBA_SUPERVISOR_NAME}幫你看資料喔。
通過後會再問你要不要轉帳運費。`;

export function jibaConfirmSummary(d: {
  recipientName: string;
  recipientPhone: string;
  storeName: string;
  instagramHandle: string;
  petName?: string | null;
}): string {
  const phone = d.recipientPhone.replace(/(\d{4})(\d{3})(\d{3})/, '$1-$2-$3');
  return `麻煩最後再幫我們確認一次～
有錯現在改就好，寄出後就比較麻煩了。

活動：雞霸兩片開箱
商品：雞霸 × 2
商品金額：NT$0
7-11 運費：NT$${JIBA_SHIPPING_FEE}

收件人：${d.recipientName}
手機：${phone}
門市：${d.storeName}
Instagram：${d.instagramHandle}
毛孩：${d.petName?.trim() || '（略過）'}

資料對嗎？`;
}

export function jibaReturnFieldCopy(fieldLabel: string): string {
  return `有一格資料想再跟你確認一下喔。

${fieldLabel}
再填一次，我們就繼續幫你處理。`;
}
