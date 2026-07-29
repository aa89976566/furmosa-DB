/**
 * 進行中對話（開箱／開戶）遇到這些捷徑時應讓路，
 * 避免把「介紹」等按鈕文案當成門市關鍵字。
 */

/** Rich Menu 四格／世界入口 */
export const WORLD_NAV_LEAVE_RE =
  /^(?:一起野放|野放一下|預約美容|漂亮一下|換罐計畫|換罐計劃|回家|還有很多故事|野放中)$/;

/** 換罐計劃選單與說明捷徑 */
export const JAR_MENU_LEAVE_RE =
  /^(?:介紹|流程|常見問題|Q&A|QA|幫毛孩開戶|立即開戶|開戶|輸入序號|兌換序號|兌換優惠券|兌換美容折價券|看本期口味|本期口味|合作店家|配合店家|兌換好禮|兌換好康|換罐計劃是什麼)$/i;

/** 一起野放子入口（開箱進行中點了別的活動） */
export const CHAOS_NAV_LEAVE_RE =
  /^(?:嗷嗚計劃|嗷嗚計畫|活動中心|沒梗了|青蛙誰在怕|清蛙誰在怕|開箱任務|毛孩來開箱)$/;

export function isWorldNavLeaveText(text: string): boolean {
  return WORLD_NAV_LEAVE_RE.test(text.trim());
}

export function isJarMenuLeaveText(text: string): boolean {
  return JAR_MENU_LEAVE_RE.test(text.trim());
}

/** 開箱流程應讓路的文字 */
export function isUnboxLeaveText(text: string): boolean {
  const t = text.trim();
  return (
    WORLD_NAV_LEAVE_RE.test(t) ||
    JAR_MENU_LEAVE_RE.test(t) ||
    CHAOS_NAV_LEAVE_RE.test(t)
  );
}

/** 開戶流程應讓路的文字（四格＋換罐選單） */
export function isRegisterNavLeaveText(text: string): boolean {
  const t = text.trim();
  return WORLD_NAV_LEAVE_RE.test(t) || JAR_MENU_LEAVE_RE.test(t);
}

/** parseLineUserText kind：應略過開箱／開戶 session，直接走功能路由 */
export const SESSION_BYPASS_KINDS = new Set([
  'jar_explain_intro',
  'jar_explain_flow',
  'jar_explain_faq',
  'jar_explain',
  'jar_enter',
  'jar_stores',
  'redeem_coupon',
  'refill_flavours',
  'bind_help',
  'rewards_list',
]);
