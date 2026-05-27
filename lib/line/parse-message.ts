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
  | { kind: 'unknown'; text: string };

const BIND_RE = /^(?:綁定|绑定|bind)\s*[：:\s]?\s*(.+)$/i;
const REDEEM_REWARD_RE = /^(?:兌換|兑换|換|redeem)\s*[：:\s]?\s*(.+)$/i;
const BALANCE_RE = /^(?:點數|点数|餘額|余额|balance|查點數|查点数)$/i;
const SAVINGS_RE = /^(?:小金庫|小銀行|罐罐|存罐記錄|我的罐罐|罐罐存款)$/i;
const HELP_RE = /^(?:說明|帮助|help|\?|？|指令|使用方法|存罐攻略|攻略)$/i;
const BIND_HELP_RE =
  /^(?:如何綁定|怎么绑定|怎麼綁定|如何绑定|綁定方式|绑定方式|怎麼綁|如何綁|我要綁定|開戶存罐罐|開戶|先認個人)$/i;
const GREETING_RE = /^(?:你好|您好|hi|hello|hey|哈囉|哈喽)$/i;
const STATUS_RE = /^(?:會員|会员|我的會員|我的会员|綁定狀態|绑定状态|我是誰|我是谁)$/i;
const REWARDS_RE = /^(?:獎勵|奖励|禮品|礼品|兌換獎勵|兑换奖励|reward|rewards)$/i;

export function parseLineUserText(raw: string): ParsedLineText {
  const text = raw.trim();
  if (!text) return { kind: 'unknown', text: '' };

  const bind = text.match(BIND_RE);
  if (bind?.[1]) {
    return { kind: 'bind', identifier: bind[1].trim() };
  }

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
  if (REWARDS_RE.test(text)) return { kind: 'rewards_list' };

  const code = normalizeJarCode(text);
  if (code && isValidJarCodeFormat(code)) {
    return { kind: 'jar_code', code };
  }

  return { kind: 'unknown', text };
}

export { LINE_HELP_TEXT, LINE_BIND_HELP_TEXT, LINE_WELCOME_TEXT } from '@/lib/line/messages';
