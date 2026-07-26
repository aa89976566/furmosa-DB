import {
  JIBA_BANK_TRANSFER,
  JIBA_SHIPPING_FEE,
  JIBA_SUPERVISOR_NAME,
} from '@/lib/campaigns/jiba-two-piece/constants';

export const JIBA_INTRO = `雞霸兩片，交給你家那隻。

拍一支 Reels：
毛孩拿著雞霸自拍，或直接拍牠開吃。

發布時標記 @furmosa_food，投稿內容可能經匠寵轉發、剪輯或用於官方網站、Instagram、LINE 與活動宣傳。

雞霸由我們準備，7-11 運費 NT$${JIBA_SHIPPING_FEE} 自付。

要讓牠上工嗎？`;

export const JIBA_RULES = `規則沒有很多，毛孩可能也懶得看：

① 收到雞霸兩片
② 拍毛孩拿雞霸自拍，或拍牠開吃
③ 發布 Instagram Reels
④ 標記 @furmosa_food
⑤ 投稿內容可能經匠寵轉發、剪輯或用於活動分享

運費 NT$${JIBA_SHIPPING_FEE}，自行負擔。

看完還敢參加嗎？`;

export const JIBA_START_WORK = `好，工作來了。

我們先把雞霸送到你指定的 7-11。
一次問一題，不用一次交代人生。`;

export const JIBA_ASK_NAME = `第一題。
收件人姓名是？`;

export const JIBA_ASK_PHONE = `再來，收件手機號碼？
7-11 找不到人時，至少還找得到電話。`;

export const JIBA_PHONE_ERROR = `這支號碼看起來少了一點什麼。
請輸入 09 開頭、共 10 碼的手機號碼。`;

export const JIBA_ASK_STORE = `最後一個地點問題。
選一間你真的會去領的 7-11。

請輸入「門市名稱＋縣市區域」。
例如：板橋新埔門市。`;

export const JIBA_ASK_IG = `雞霸找得到你了。
你的 Instagram 帳號是？
請輸入 @ 開頭的帳號。`;

export const JIBA_ASK_PET = `那位準備上工的，叫什麼名字？
（可傳「略過」）`;

export const JIBA_LICENSE = `投稿前還有一件正經事。

參加活動代表你同意：匠寵可以在官方網站、Instagram、LINE 與活動宣傳中，轉發、編輯或使用這次投稿的照片與影片。

著作權仍屬於原創作者，我們只取得本次品牌宣傳所需的使用授權。

可以嗎？`;

export const JIBA_LICENSE_DECLINE = `沒關係，回憶留在你家就好。
這次申請先不送出。`;

export const JIBA_SUBMITTED = `收到了。

現在先送給${JIBA_SUPERVISOR_NAME}看一眼。
小幫手會核對你剛剛留下的資料與 LINE 對話。

確認完成後，會問你要不要現在轉帳運費 NT$${JIBA_SHIPPING_FEE}。

先別封鎖我們。`;

export const JIBA_APPROVED = `${JIBA_SUPERVISOR_NAME}看過了。
你家那隻正式錄取。

這單 7-11 運費 NT$${JIBA_SHIPPING_FEE}。
要現在轉帳嗎？`;

export const JIBA_BANK_INFO = `好，轉帳資訊在這：

銀行：${JIBA_BANK_TRANSFER.bankName}（${JIBA_BANK_TRANSFER.bankCode}）
帳號：${JIBA_BANK_TRANSFER.account}
金額：NT$${JIBA_SHIPPING_FEE}

轉完可以回「我已轉帳」，
或直接「找${JIBA_SUPERVISOR_NAME}」。`;

export const JIBA_PAY_LATER = `好，不急。
想付的時候回「現在付款」，
或「找${JIBA_SUPERVISOR_NAME}」。`;

export const JIBA_TRANSFER_NOTED = `收到。
${JIBA_SUPERVISOR_NAME}會對帳。
對上了會再跟你說，雞霸再出發。`;

export const JIBA_FIND_HELPER = `好，幫你呼叫${JIBA_SUPERVISOR_NAME}。
資料先留著，小幫手會來看。`;

export const JIBA_PAID = `錢到了。雞霸準備離家。

出貨後會再通知你，接下來請跟毛孩討論一下鏡位。`;

export const JIBA_REJECTED = `這次名額先滿了。

不是你家那隻不夠會吃，是雞霸不夠多。
下一輪再叫你。`;

export const JIBA_PENDING_HINT = `還在等${JIBA_SUPERVISOR_NAME}瞄一眼。
通過後會問你要不要轉帳運費。`;

export function jibaConfirmSummary(d: {
  recipientName: string;
  recipientPhone: string;
  storeName: string;
  instagramHandle: string;
  petName?: string | null;
}): string {
  const phone = d.recipientPhone.replace(/(\d{4})(\d{3})(\d{3})/, '$1-$2-$3');
  return `最後看一眼。錯了現在講，寄出去就只能追車。

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
  return `有一格資料想再確認。

${fieldLabel}
再填一次，我們就繼續。`;
}
