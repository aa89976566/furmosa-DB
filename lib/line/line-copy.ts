/** LINE 對話按鈕與文案（台灣毛孩飼主口吻） */

export const LINE_BTN = {
  /** 主選單 */
  register: '幫毛孩開戶',
  vault: '我的點數',
  myCoupons: '我的優惠券',
  redeemGrooming: '兌換美容折價券',
  redeem: '兌換好康',
  activity: '活動辦法',
  unboxing: '毛孩來開箱',
  contact: '聯絡客服',
  /** 註冊流程 */
  confirm: '確認加入',
  cancel: '重新填寫',
  speciesSkip: '先不填毛孩',
  /** 兌換 */
  redeemItem: (n: number) => `換贈品（${n}）`,
  confirmGroomingRedeem: '確認兌換',
} as const;

export const LINE_MENU_HINT_REGISTERED =
  '「我的點數」看餘額；「我的優惠券」查看券；滿 10 點可兌換美容折 200 或 250 元（依店家）。';

export const LINE_MENU_HINT_GUEST =
  '第一次請點「幫毛孩開戶」，在對話裡依序填寫就好。';

export {
  SIGNUP_STORES as LINE_SIGNUP_STORES,
  SIGNUP_STORE_IDS as LINE_SIGNUP_STORE_CODES,
  resolveSignupStoreLabel,
  type SignupStoreId,
} from '@/lib/stores/signup-stores';

export const LINE_STORE_PROMPT = '請選擇您的開戶店家：';

export const LINE_REGISTER_INTRO =
  '【幫毛孩開戶】請輸入您的稱呼（例：王小姐）\n\n輸入「取消」可結束。';

export const LINE_PET_AGE_PROMPT =
  '毛孩大概幾歲？傳數字即可（例：3）\n或傳生日（例：2020-05-06）\n不確定可傳「略過」';

export const LINE_COUPON_VERIFY_HINT =
  '⚠️ 請於結帳前出示此優惠券給店家。\n店家需按下「驗證優惠券」確認後方可折抵。\n優惠券一經核銷即無法再次使用。';

export const LINE_CONTACT_INFO = '如需協助請私訊官方帳號，或至合作店家現場詢問。';

export const LINE_ACTIVITY_INFO =
  '【換罐存點】空罐序號入帳得點數。\n【美容折價券】累積 10 點可兌換 200 或 250 元折價券（豬窩 250、其他店家 200），限綁定店家使用，有效 30 天。';

export const LINE_UNBOXING_INFO = `嗨～恭喜入選本次【匠寵實驗室｜最後一片研究計畫】研究員 🐶🔬

我們希望透過真實毛孩的體驗，找出狗狗心中真正值得被稱為「最後一片」的標準。

請先選擇想測試的產品：

① 壕大大雞霸（大片雞肉乾）
② 雞肉凍乾 30g
③ 青蛙凍乾

━━━━━━━━━━━━━━

【研究員任務】

收到產品後 10 天內完成：

📸 提供 3-5 張照片或短影片

建議拍攝內容：

• 開箱瞬間
• 毛孩聞到味道的反應
• 吃零食的畫面
• 產品與毛孩合照
• 毛孩與抽獎卡片合照
• 日常生活情境照（沙發、床上、散步、公園等）

並於 Instagram 發布至少 1 則貼文或 Reels。

━━━━━━━━━━━━━━

【IG 發文條件】

貼文需包含：

✓ 至少 1 張產品或食用照片

✓ 標註
@furmosa_food
@furmosa_tw

✓ 簡單分享毛孩體驗心得

✓ 貼文完成後將連結或截圖提供給我們

━━━━━━━━━━━━━━

【匠寵提供】

✓ 體驗產品乙份

✓ 7-ELEVEN 店到店運費

━━━━━━━━━━━━━━

若同意參與本次研究計畫，

請直接回覆：

【我要參加】

並提供以下資料：

收件人：
手機：
7-ELEVEN 門市名稱：
7-ELEVEN 門市店號：

以及您想測試的產品編號（①②③）。

收到資料後，我們將盡快安排寄出 🐾`;
