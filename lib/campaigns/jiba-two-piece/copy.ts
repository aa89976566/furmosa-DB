import {
  CATNIP_CHICK_HOMEPAGE_URL,
  JIBA_BANK_TRANSFER,
  JIBA_FREE_SHIP,
  JIBA_PRODUCTS,
  JIBA_SHIPPING_FEE,
  JIBA_SUPERVISOR_NAME,
  type JibaProductKey,
} from '@/lib/campaigns/jiba-two-piece/constants';

/** 首則邀請：參加決策＋審核後寄出條件＋60 元物流處理費；不列商品、收件、加購或授權 */
export const JIBA_INVITE_TITLE = '毛孩開箱體驗募集';
export const JIBA_INVITE_BODY =
  `想邀請你和毛孩免費體驗 Furmosa 商品，分享真實開箱與試吃反應。申請送出後會先審核，通過再安排寄出。本次商品免費，需自付 ${JIBA_SHIPPING_FEE} 元物流處理費。`;
export const JIBA_INVITE_ALT_TEXT =
  `毛孩開箱體驗募集：審核通過後寄出。商品免費，需自付 ${JIBA_SHIPPING_FEE} 元物流處理費`;
export const JIBA_INVITE_JOIN = '我要參加';
export const JIBA_INVITE_DECLINE = '先不用';
export const JIBA_INVITE_DECLINE_REPLY =
  '好，這次先不用沒關係。之後想參加，再傳「開箱任務」就好。';
export const JIBA_INVITE_REPROMPT = '這步用下面按鈕回就好：我要參加，或先不用。';
export const JIBA_ASK_PRODUCT_PROMPT = '這次想讓毛孩體驗哪一樣？點下面就好。';
export const JIBA_ASK_PRODUCT_ALT_TEXT = '選開箱商品：雞霸、青蛙、貓草雞肉乾 30g';
export const JIBA_ASK_PRODUCT_TITLE = '選這次體驗的商品';

/** @deprecated 舊長介紹；入口改走 JIBA_INVITE_*，保留給既有測試對照 */
export const JIBA_INTRO = `毛孩開箱體驗募集

想邀請你和毛孩免費體驗 Furmosa 商品，分享真實開箱與試吃反應。
申請送出後會先審核，通過再安排寄出。
本次商品免費，需自付 ${JIBA_SHIPPING_FEE} 元物流處理費。`;

export const JIBA_RULES = `參加方式很單純：

① 選一種體驗商品（雞霸、青蛙或貓草雞肉乾 30g）
② 拍毛孩開箱／試吃的真實樣子
③ 發 Instagram Reels，標記 @furmosa_food
④ 素材經你授權後，可能用在官網、IG、LINE 或活動宣傳

申請送出後會先審核，通過再安排寄出。
本次商品免費，需自付 ${JIBA_SHIPPING_FEE} 元物流處理費。`;

export const JIBA_ASK_PRODUCT = `這次想讓毛孩體驗哪一樣？`;

export const JIBA_PRODUCT_PICKED = {
  jiba: `好，這次體驗「壕大大雞霸兩片」。`,
  frog: `好，這次體驗「青蛙凍乾一隻」。`,
  catnip: `好，這次體驗「貓草雞肉乾 30g」。`,
} as const;

export const JIBA_BRIEF_CONTINUE = '好，開始填收件資訊';
export const JIBA_CATNIP_PURPOSE_CONTINUE = '我了解用途，開始填收件資訊';
export const JIBA_BRIEF_REPROMPT = '看完這品說明後，點下面按鈕開始填收件資訊。';

export function jibaBriefContinueLabel(productKey: JibaProductKey): string {
  return productKey === 'catnip' ? JIBA_CATNIP_PURPOSE_CONTINUE : JIBA_BRIEF_CONTINUE;
}

export function isJibaBriefContinue(text: string): boolean {
  return /^(?:好，開始填收件資訊|好，開始填資料|開始填收件資訊|開始填資料|繼續|好|我了解用途，開始填收件資訊|我了解用途，開始填資料|我了解，開始填資料)$/i.test(
    text.trim(),
  );
}

/** 選完商品後：該品必要說明。不加購、不收件。 */
export function jibaProductBrief(productKey: JibaProductKey): string {
  const p = JIBA_PRODUCTS[productKey];
  if (productKey === 'catnip') {
    return `好，這次體驗「${p.orderLabel}」。

想請貓咪先試吃，再拍下真實反應。經你授權後，素材可能用在這頁：
${CATNIP_CHICK_HOMEPAGE_URL}

收到後拍開箱或試吃、發 Instagram Reels，並標記 @furmosa_food 就好。`;
  }
  return `好，這次體驗「${p.orderLabel}」。

收到後拍毛孩開箱或開吃、發 Instagram Reels，並標記 @furmosa_food 就好。`;
}

/** @deprecated 加購已移到運送資訊之後；此函式只回品項說明，避免舊呼叫提前問加購 */
export function jibaBriefAndUpsell(productKey: JibaProductKey): string {
  return jibaProductBrief(productKey);
}

export const JIBA_UPSELL_TITLE = '收件資訊齊了，要加購嗎？';
export const JIBA_UPSELL_BODY =
  `這次體驗商品免費寄送，需自付 ${JIBA_SHIPPING_FEE} 元物流處理費。

若想順便加購零食：
・滿 NT$${JIBA_FREE_SHIP.cvs711} → 7-11 店到店免運
・滿 NT$${JIBA_FREE_SHIP.blackCat} → 黑貓宅配免運

加購不是必填。這次要加，還是先把開箱申請送完？`;
export const JIBA_UPSELL_ALT_TEXT =
  `收件資訊已齊，要加購嗎？商品免費，需自付 ${JIBA_SHIPPING_FEE} 元物流處理費`;
export const JIBA_UPSELL_SKIP = '這次先不加';
export const JIBA_UPSELL_ACCEPT = '想加購';
export const JIBA_UPSELL_REPROMPT = '這步用下面按鈕回就好：想加購，或這次先不加。';
export const JIBA_UPSELL_SKIPPED = '好，這次先不加。接著留 Instagram，方便對投稿。';
export const JIBA_UPSELL_NOTED =
  `好，加購意向先幫你記下。審核通過後，${JIBA_SUPERVISOR_NAME}會再跟你說怎麼加。接著先把開箱申請補齊。`;

export function isJibaUpsellSkip(text: string): boolean {
  return /^(?:這次先不加|先不加|不加購|先不用加購|不用加購|先不用)$/i.test(text.trim());
}

export function isJibaUpsellAccept(text: string): boolean {
  return /^(?:想加購|要加購|加購|我要加購)$/i.test(text.trim());
}

export const JIBA_START_WORK = `收件資訊從這裡開始填。
會寄到你指定的 7-11 超商門市，一次只問一題。`;

export const JIBA_ASK_NAME = `收件人姓名是？
請填真實姓名，超商取貨才對得上。`;

export const JIBA_NAME_ERROR = `這看起來不像收件人姓名。
請填真實姓名，例如：王小明`;

export const JIBA_NAME_RETRY = `再幫我們填一次收件人姓名好嗎？
例如：王小明、陳美玲`;

export const JIBA_ASK_PHONE = `收件手機號碼？
取貨有狀況時，才聯絡得到你。`;

export const JIBA_PHONE_ERROR = `這支號碼好像少了一點。
請輸入 09 開頭、共 10 碼的手機號碼。
例如：0912345678`;

export const JIBA_ASK_STORE = `選一間方便領貨的 7-11 超商門市。

怎麼找最快：
① 直接打「區域＋店名」，例如：板橋新埔、淡水老街
② 或先去 7-11 門市查詢看店名，再回來貼給我們

輸入後會給你候選清單，點按鈕確認才算數。`;

export const JIBA_STORE_ERROR = `這串比較不像 7-11 門市名稱。
再試試「區域＋店名」，例如：板橋新埔門市、台北車站門市。

（換罐計劃的「介紹」是另一回事，選門市時請直接打店名。）`;

export const JIBA_ASK_IG = `門市找到了，謝謝。
接著請問你的 Instagram 帳號？
請輸入 @ 開頭的帳號。`;

export const JIBA_IG_ERROR = `Instagram 帳號要請用 @ 開頭。
例如：@furmosa_food`;

export const JIBA_ASK_PET = `那位要幫忙開箱的毛孩，叫什麼名字？
（也可以傳「略過」）`;

export const JIBA_PET_ERROR = `毛孩名字再跟我們說一次好嗎？
也可以傳「略過」先跳過這題。`;

export function jibaFieldRetryEscalation(helperName: string): string {
  return `這題卡住沒關係。
你可以再試一次，或直接說「找${helperName}」，我們請小幫手幫你填。`;
}

export const JIBA_LICENSE_ASK = `投稿前，可以請你按下面按鈕同意授權嗎？`;

export const JIBA_LICENSE_BODY = `參加活動代表你同意：匠寵可以在官方網站、Instagram、LINE 與活動宣傳中，轉發、編輯或使用這次投稿的照片與影片。

著作權還是屬於原創作者，我們只取得這次品牌宣傳需要的使用授權。`;

export function jibaLicenseBody(productKey?: JibaProductKey): string {
  if (productKey !== 'catnip') return JIBA_LICENSE_BODY;
  return `${JIBA_LICENSE_BODY}

這次貓咪試吃貓草雞肉乾的真實反應，經你按「我同意」後，也可能用在這頁：
${CATNIP_CHICK_HOMEPAGE_URL}`;
}

/** @deprecated 舊長文；改走 Flex 按鈕版 */
export const JIBA_LICENSE = `投稿前，跟你確認一件事。

${JIBA_LICENSE_BODY}

可以請你幫忙同意嗎？`;

export const JIBA_LICENSE_DECLINE = `沒關係，尊重你的決定。
這次申請我們先不送出，照片就好好留在家裡。`;

export const JIBA_SUBMITTED = `收到了，謝謝。

接下來會先請${JIBA_SUPERVISOR_NAME}看一下資料，
也會核對你剛剛留下的內容與 LINE 對話。

確認完成後，再問你要不要現在轉帳 ${JIBA_SHIPPING_FEE} 元物流處理費。

我們會再跟你聯絡，請稍等一下。`;

export const JIBA_APPROVED = `${JIBA_SUPERVISOR_NAME}看過了，資料沒問題。
你家毛孩正式參加開箱。

這單物流處理費是 ${JIBA_SHIPPING_FEE} 元，需自付。
要現在轉帳嗎？`;

export const JIBA_BANK_INFO = `好，轉帳資訊在這裡：

銀行：${JIBA_BANK_TRANSFER.bankName}（${JIBA_BANK_TRANSFER.bankCode}）
帳號：${JIBA_BANK_TRANSFER.account}
金額：NT$${JIBA_SHIPPING_FEE}

轉完可以回「我已轉帳」，
或直接說「找${JIBA_SUPERVISOR_NAME}」，我們都會再幫你看。`;

export const JIBA_PAY_LATER = `好，不急。
想付的時候回「現在付款」，
或「找${JIBA_SUPERVISOR_NAME}」都可以。`;

export const JIBA_TRANSFER_NOTED = `收到了，謝謝。
${JIBA_SUPERVISOR_NAME}會幫忙對帳。
對上了再跟你說，零食就可以出發。`;

export const JIBA_FIND_HELPER = `好，幫你請${JIBA_SUPERVISOR_NAME}來看。
資料先幫你留著，小幫手會盡快回覆你。`;

export const JIBA_PAID = `物流處理費確認到了，謝謝。
零食準備幫你家毛孩寄出。

出貨後會再通知你；到時候記得幫毛孩挑個好角度。`;

export const JIBA_REJECTED = `不好意思，這次名額先額滿了。

不是毛孩不夠可愛，是零食數量有限。
下一輪有機會，我們再找你。`;

export const JIBA_PENDING_HINT = `還在等${JIBA_SUPERVISOR_NAME}幫你看資料。
通過後會再問你要不要轉帳物流處理費。`;

export function jibaConfirmSummary(d: {
  recipientName: string;
  recipientPhone: string;
  storeName: string;
  instagramHandle: string;
  petName?: string | null;
  productLabel?: string;
}): string {
  const phone = d.recipientPhone.replace(/(\d{4})(\d{3})(\d{3})/, '$1-$2-$3');
  const product = d.productLabel ?? '壕大大雞霸 × 2';
  return `麻煩最後再幫我們確認一次。
有錯現在改就好，寄出後就比較麻煩了。

活動：毛孩開箱
商品：${product}
商品金額：NT$0
物流處理費：NT$${JIBA_SHIPPING_FEE}（需自付）

收件人：${d.recipientName}
手機：${phone}
超商門市：${d.storeName}
Instagram：${d.instagramHandle}
毛孩：${d.petName?.trim() || '（略過）'}

資料對嗎？`;
}

export function jibaReturnFieldCopy(fieldLabel: string): string {
  return `有一格資料想再跟你確認一下。

${fieldLabel}
再填一次，我們就繼續幫你處理。`;
}
