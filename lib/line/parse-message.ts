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
  | { kind: 'hub_jar' }
  | { kind: 'hub_chaos' }
  | { kind: 'hub_wild' }
  | { kind: 'unknown'; text: string };

const BIND_RE = /^(?:綁定|绑定|bind)\s*[：:\s]?\s*(.+)$/i;
const REDEEM_REWARD_RE = /^(?:兌換|兑换|換|redeem)\s*[：:\s]?\s*(.+)$/i;
const BALANCE_RE = /^(?:點數|点数|餘額|余额|balance|查點數|查点数)$/i;
const SAVINGS_RE =
  /^(?:小金庫|金庫|罐罐存摺|我的存罐本|小銀行|罐罐|存罐記錄|我的罐罐|罐罐存款|會員資料與存罐紀錄|會員資料|存罐紀錄|毛孩罐庫|罐庫)$/i;
const HELP_RE = /^(?:說明|帮助|help|\?|？|指令|使用方法|存罐攻略|攻略)$/i;
const BIND_HELP_RE =
  /^(?:如何綁定|怎么绑定|怎麼綁定|如何绑定|綁定方式|绑定方式|怎麼綁|如何綁|我要綁定|開戶存罐罐|開戶|先認個人|幫毛孩開戶|加入會員|立即開戶)$/i;
const GREETING_RE = /^(?:你好|您好|hi|hello|hey|哈囉|哈喽)$/i;
const STATUS_RE = /^(?:會員|会员|我的會員|我的会员|綁定狀態|绑定状态|我是誰|我是谁)$/i;
const REWARDS_RE = /^(?:獎勵|奖励|禮品|礼品|兌換獎勵|兑换奖励|兌換好康|reward|rewards)$/i;
const UNBOXING_RE =
  /^(?:毛孩來開箱|來開箱|開箱研究|最後一片研究計畫|嗷嗚計畫|清蛙誰在怕)$/i;
const HUB_JAR_RE = /^(?:♻️\s*)?換罐計畫$/;
const HUB_CHAOS_RE = /^(?:(?:🔥|🎉)\s*)?一起搞事$/;
const HUB_WILD_RE = /^(?:🌿\s*)?野放中$/;

export function parseLineUserText(raw: string): ParsedLineText {
  const text = raw.trim();
  if (!text) return { kind: 'unknown', text: '' };

  const bind = text.match(BIND_RE);
  if (bind?.[1]) {
    return { kind: 'bind', identifier: bind[1].trim() };
  }

  if (HUB_JAR_RE.test(text)) return { kind: 'hub_jar' };
  if (HUB_CHAOS_RE.test(text)) return { kind: 'hub_chaos' };
  if (HUB_WILD_RE.test(text)) return { kind: 'hub_wild' };

  if (REWARDS_RE.test(text)) return { kind: 'rewards_list' };
  if (UNBOXING_RE.test(text)) return { kind: 'unboxing' };

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
