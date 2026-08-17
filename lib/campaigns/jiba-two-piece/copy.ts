import {
  CATNIP_CHICK_HOMEPAGE_URL,
  JIBA_BANK_TRANSFER,
  JIBA_FREE_SHIP,
  JIBA_PRODUCTS,
  JIBA_SHIPPING_FEE,
  JIBA_SUPERVISOR_NAME,
  type JibaProductKey,
} from '@/lib/campaigns/jiba-two-piece/constants';

export const JIBA_INTRO = `汪！開箱任務來報到～

想請你家毛孩幫忙拍一支開箱小影片。
可以選：
・壕大大雞霸兩片
・青蛙凍乾一隻
・貓草雞肉乾 30g

拍完發 Instagram Reels，記得標 @furmosa_food。
零食我們準備好；7-11 運費 NT$${JIBA_SHIPPING_FEE} 請毛爸媽幫忙喔。

要一起讓毛孩來試試嗎？`;

export const JIBA_RULES = `規則很簡單，我們慢慢說：

① 選一種開箱零食（雞霸兩片、青蛙一隻或貓草雞肉乾 30g）
② 拍毛孩開箱／開吃的樣子
③ 發 Instagram Reels，標 @furmosa_food
④ 投稿內容可能經匠寵轉發、剪輯或用於活動分享

運費 NT$${JIBA_SHIPPING_FEE}，請自行負擔喔。

看完了，還想參加嗎？`;

export const JIBA_ASK_PRODUCT = `汪！先選毛孩這次要開哪一包～`;

export const JIBA_PRODUCT_PICKED = {
  jiba: `好喔，這次開「壕大大雞霸兩片」～`,
  frog: `好喔，這次開「青蛙凍乾一隻」～`,
  catnip: `好喔，這次開「貓草雞肉乾 30g」～`,
} as const;

export const JIBA_BRIEF_CONTINUE = '好，開始填資料';
export const JIBA_CATNIP_PURPOSE_CONTINUE = '我了解用途，開始填資料';

export function jibaBriefContinueLabel(productKey: JibaProductKey): string {
  return productKey === 'catnip' ? JIBA_CATNIP_PURPOSE_CONTINUE : JIBA_BRIEF_CONTINUE;
}

export function isJibaBriefContinue(text: string): boolean {
  return /^(?:好，開始填資料|開始填資料|繼續|好|我了解用途，開始填資料|我了解，開始填資料)$/i.test(
    text.trim(),
  );
}

/** 選完商品後：投稿事項＋限時加購免運（bark） */
export function jibaBriefAndUpsell(productKey: JibaProductKey): string {
  const p = JIBA_PRODUCTS[productKey];
  const purpose =
    productKey === 'catnip'
      ? `這次想請貓咪先試吃貓草雞肉乾，再拍下真實反應。
經你授權後，素材可能用在正在製作的首頁：
${CATNIP_CHICK_HOMEPAGE_URL}

`
      : '';
  const eatLine =
    productKey === 'catnip'
      ? `① 收到 ${p.orderLabel} 後，拍貓咪開箱或試吃的真實反應`
      : `① 收到 ${p.orderLabel} 後，拍毛孩開箱或開吃`;
  return `${purpose}投稿這樣就好，不複雜：

${eatLine}
② 發一支 Instagram Reels
③ 標記 @furmosa_food
④ 影片可能被匠寵轉發／剪輯，用在官網、IG、LINE 或活動宣傳

另外跟你說一聲限時優惠喔～
若想順便加購零食：
・滿 NT$${JIBA_FREE_SHIP.cvs711} → 7-11 店到店免運
・滿 NT$${JIBA_FREE_SHIP.blackCat} → 黑貓宅配免運

加購不是必填，之後有興趣再跟${JIBA_SUPERVISOR_NAME}說就好。
先把開箱資料填完，零食才寄得出發喔。`;
}

export const JIBA_START_WORK = `好喔，那我們開始幫毛孩填收件資料～

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

export const JIBA_ASK_STORE = `汪！接下來選一間你方便領貨的 7-11～

怎麼找最快：
① 直接打「區域＋店名」，例如：板橋新埔、淡水老街
② 或先去 7-11 門市查詢看店名，再回來貼給我們

輸入後會給你候選清單，點按鈕確認才算數喔。`;

export const JIBA_STORE_ERROR = `這串比較不像 7-11 門市名稱耶～
再試試「區域＋店名」，例如：板橋新埔門市、台北車站門市。

（換罐計劃的「介紹」按鈕是另一回事，選門市時請直接打店名喔。）`;

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

/** 授權同意：短問句（按鈕版 Flex 會帶完整說明，避免拆成多則文字泡泡） */
export const JIBA_LICENSE_ASK = `投稿前，可以請你按下面按鈕同意授權嗎？`;

export const JIBA_LICENSE_BODY = `參加活動代表你同意：匠寵可以在官方網站、Instagram、LINE 與活動宣傳中，轉發、編輯或使用這次投稿的照片與影片。

著作權還是屬於原創作者，我們只取得這次品牌宣傳需要的使用授權。`;

/** 授權說明：貓草雞肉乾會補上首頁用途，仍寫入既有 licenseAccepted 欄位 */
export function jibaLicenseBody(productKey?: JibaProductKey): string {
  if (productKey !== 'catnip') return JIBA_LICENSE_BODY;
  return `${JIBA_LICENSE_BODY}

這次貓咪試吃貓草雞肉乾的真實反應，經你按「我同意」後，也可能用在這頁：
${CATNIP_CHICK_HOMEPAGE_URL}`;
}

/** @deprecated 舊長文；改走 Flex 按鈕版 */
export const JIBA_LICENSE = `投稿前，跟你確認一件事喔。

${JIBA_LICENSE_BODY}

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
對上了再跟你說，零食就可以出發囉。`;

export const JIBA_FIND_HELPER = `好的，幫你請${JIBA_SUPERVISOR_NAME}來看。
資料先幫你留著，小幫手會盡快回覆你喔。`;

export const JIBA_PAID = `運費確認到了，謝謝你～
零食準備幫你家毛孩寄出。

出貨後會再通知你；到時候記得幫毛孩挑個好角度拍照喔。`;

export const JIBA_REJECTED = `不好意思，這次名額先額滿了。

不是毛孩不夠可愛，是零食數量有限。
下一輪有機會，我們再找你喔。`;

export const JIBA_PENDING_HINT = `還在等${JIBA_SUPERVISOR_NAME}幫你看資料喔。
通過後會再問你要不要轉帳運費。`;

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
  return `麻煩最後再幫我們確認一次～
有錯現在改就好，寄出後就比較麻煩了。

活動：毛孩開箱
商品：${product}
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
