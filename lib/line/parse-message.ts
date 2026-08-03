import { isValidJarCodeFormat, normalizeJarCode } from '@/lib/jar-exchange/codes';

export type ParsedLineText =
  | { kind: 'jar_code'; code: string }
  | { kind: 'bind'; identifier: string }
  | { kind: 'bind_help' }
  | { kind: 'balance' }
  | { kind: 'savings' }
  | { kind: 'help' }
  | { kind: 'greeting' }
  | { kind: 'status' }
  | { kind: 'rewards_list' }
  | { kind: 'redeem_reward'; target: string }
  | { kind: 'unboxing' }
  | { kind: 'events_center' }
  | { kind: 'hub_jar' }
  | { kind: 'hub_chaos' }
  | { kind: 'hub_wild' }
  | { kind: 'comic_roam' }
  | { kind: 'comic_grooming' }
  | { kind: 'comic_home' }
  | { kind: 'jar_explain_intro' }
  | { kind: 'jar_explain_flow' }
  | { kind: 'jar_explain_faq' }
  | { kind: 'jar_explain' }
  | { kind: 'jar_enter' }
  | { kind: 'jar_start' }
  | { kind: 'jar_stores' }
  | { kind: 'redeem_coupon' }
  | { kind: 'refill_flavours' }
  | { kind: 'unknown'; text: string };

const BIND_RE = /^(?:綁定|绑定|bind)\s*[：:\s]?\s*(.+)$/i;
const REDEEM_REWARD_RE = /^(?:兌換|兑换|換|redeem)\s*[：:\s]?\s*(.+)$/i;
const BALANCE_RE = /^(?:點數|点数|餘額|余额|balance|查點數|查点数)$/i;
const SAVINGS_RE =
  /^(?:小金庫|金庫|罐罐存摺|我的存罐本|小銀行|罐罐|存罐記錄|我的罐罐|罐罐存款|會員資料與存罐紀錄|會員資料|存罐紀錄|毛孩罐庫|罐庫)$/i;
const HELP_RE = /^(?:說明|帮助|help|\?|？|指令|使用方法|存罐攻略|攻略)$/i;
const BIND_HELP_RE =
  /^(?:如何綁定|怎么绑定|怎麼綁定|如何绑定|綁定方式|绑定方式|怎麼綁|如何綁|我要綁定|開戶存罐罐|開戶|先認個人|幫毛孩開戶|加入會員|立即開戶|立刻開戶)$/i;
const GREETING_RE = /^(?:你好|您好|hi|hello|hey|哈囉|哈喽)$/i;
const STATUS_RE = /^(?:會員|会员|我的會員|我的会员|綁定狀態|绑定状态|我是誰|我是谁)$/i;
const REWARDS_RE = /^(?:獎勵|奖励|禮品|礼品|兌換獎勵|兑换奖励|兌換好康|兌換好禮|reward|rewards)$/i;
const UNBOXING_RE =
  /^(?:毛孩來開箱|來開箱|開箱研究|最後一片研究計畫|嗷嗚計畫|嗷嗚計劃|清蛙誰在怕|青蛙誰在怕|青蛙：誰在怕？|開箱任務)$/i;
/** 活動中心／沒梗了（不是嗷嗚計劃） */
const EVENTS_CENTER_RE = /^(?:活動中心|沒梗了)$/i;
const HUB_JAR_RE = /^(?:(?:♻️|🫙)\s*)?(?:換罐計畫|換罐計劃)$/;
/** 一起搞事＝舊名；一起野放走 comic_roam，也相容當 hub */
const HUB_CHAOS_RE = /^(?:(?:🔥|🎉|🐾)\s*)?(?:一起搞事|一起野放)$/;
const HUB_WILD_RE = /^(?:(?:🌿|🏠)\s*)?(?:野放中|回家)$/;
/** 四格漫畫 Rich Menu */
const COMIC_ROAM_RE = /^(?:一起野放|野放一下)$/;
const COMIC_GROOMING_RE = /^(?:預約美容|漂亮一下)$/;
const COMIC_HOME_RE = /^(?:回家|還有很多故事)$/;
/** 換罐說明子選單（按鈕 displayText／使用者直接打字） */
const JAR_EXPLAIN_MENU_RE = /^換罐計劃是什麼$/;
const JAR_EXPLAIN_INTRO_RE = /^(?:什麼是換罐計劃？|什麼是換罐計劃|介紹)$/;
const JAR_EXPLAIN_FLOW_RE = /^流程$/;
const JAR_EXPLAIN_FAQ_RE = /^(?:毛爸媽常問|常見問題|Q&A|QA)$/i;
const JAR_ENTER_RE = /^(?:兌換序號|輸入序號)$/;
/** 介紹卡主 CTA：點擊後依當下開戶狀態分流 */
const JAR_START_RE = /^開始換罐$/;
/** 須先於「兌換 xxx」模糊規則，避免被拆成 redeem_reward */
const REDEEM_COUPON_RE =
  /^(?:點數換折價|換成美容折價|兌換優惠券|兌換優惠卷|兌換美容折價券)$/;
const JAR_STORES_RE = /^(?:查看合作店|合作店家|合作美容店|配合店家)$/;
const REFILL_FLAVOURS_RE = /^(?:看本期口味|本期口味)$/;

/** 去掉零寬字元，避免 Rich Menu 帶入後對不到捷徑 */
function normalizeLineUserText(raw: string): string {
  return raw.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
}

export function parseLineUserText(raw: string): ParsedLineText {
  const text = normalizeLineUserText(raw);
  if (!text) return { kind: 'unknown', text: '' };

  const bind = text.match(BIND_RE);
  if (bind?.[1]) {
    return { kind: 'bind', identifier: bind[1].trim() };
  }

  // 四格漫畫優先（與舊三世界別名重疊時走漫畫引導文案）
  if (COMIC_ROAM_RE.test(text)) return { kind: 'comic_roam' };
  if (COMIC_GROOMING_RE.test(text)) return { kind: 'comic_grooming' };
  if (COMIC_HOME_RE.test(text)) return { kind: 'comic_home' };
  if (HUB_JAR_RE.test(text)) return { kind: 'hub_jar' };
  if (HUB_CHAOS_RE.test(text)) return { kind: 'hub_chaos' };
  if (HUB_WILD_RE.test(text)) return { kind: 'hub_wild' };

  if (REWARDS_RE.test(text)) return { kind: 'rewards_list' };
  if (EVENTS_CENTER_RE.test(text)) return { kind: 'events_center' };
  if (UNBOXING_RE.test(text)) return { kind: 'unboxing' };

  // 精確換罐捷徑要先於「兌換 xxx」模糊規則
  if (JAR_EXPLAIN_MENU_RE.test(text)) return { kind: 'jar_explain' };
  if (JAR_START_RE.test(text)) return { kind: 'jar_start' };
  if (JAR_ENTER_RE.test(text)) return { kind: 'jar_enter' };
  if (REDEEM_COUPON_RE.test(text)) return { kind: 'redeem_coupon' };
  if (JAR_EXPLAIN_INTRO_RE.test(text)) return { kind: 'jar_explain_intro' };
  if (JAR_EXPLAIN_FLOW_RE.test(text)) return { kind: 'jar_explain_flow' };
  if (JAR_EXPLAIN_FAQ_RE.test(text)) return { kind: 'jar_explain_faq' };
  if (JAR_STORES_RE.test(text)) return { kind: 'jar_stores' };
  if (REFILL_FLAVOURS_RE.test(text)) return { kind: 'refill_flavours' };

  const redeemReward = text.match(REDEEM_REWARD_RE);
  if (redeemReward?.[1]) {
    return { kind: 'redeem_reward', target: redeemReward[1].trim() };
  }

  if (BIND_HELP_RE.test(text)) return { kind: 'bind_help' };
  if (SAVINGS_RE.test(text)) return { kind: 'savings' };
  if (BALANCE_RE.test(text)) return { kind: 'balance' };
  if (HELP_RE.test(text)) return { kind: 'help' };
  if (GREETING_RE.test(text)) return { kind: 'greeting' };
  if (STATUS_RE.test(text)) return { kind: 'status' };

  const code = normalizeJarCode(text);
  if (code && isValidJarCodeFormat(code)) {
    return { kind: 'jar_code', code };
  }

  return { kind: 'unknown', text };
}

export { LINE_HELP_TEXT, LINE_BIND_HELP_TEXT, LINE_WELCOME_TEXT } from '@/lib/line/messages';
