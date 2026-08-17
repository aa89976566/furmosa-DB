/**
 * 早安指令解析（獨立於交易「停止」）
 */

import type { MorningContentMode, MorningFrequency } from '@/lib/line/morning/constants';

export type MorningCommand =
  | { kind: 'content_mode'; mode: Exclude<MorningContentMode, 'unset'> }
  | { kind: 'frequency'; frequency: Exclude<MorningFrequency, 'unset'> }
  | { kind: 'pause' }
  | { kind: 'resume' }
  | { kind: 'unsubscribe' }
  | { kind: 'settings' }
  | { kind: 'bare_stop' }
  | { kind: 'none' };

const CONTENT_RULES: Array<{ re: RegExp; mode: Exclude<MorningContentMode, 'unset'> }> = [
  { re: /^(?:寵物笑話|笑話)$/, mode: 'jokes' },
  { re: /^(?:全球寵物新鮮事|寵物新鮮事|新鮮事|新聞)$/, mode: 'news' },
  { re: /^(?:兩種交替|交替)$/, mode: 'alternate' },
  { re: /^(?:內容先不用|先不用內容)$/, mode: 'off' },
];

const FREQ_RULES: Array<{
  re: RegExp;
  frequency: Exclude<MorningFrequency, 'unset'>;
}> = [
  { re: /^(?:每天|每日)$/, frequency: 'daily' },
  { re: /^(?:平日|工作日)$/, frequency: 'weekday' },
  { re: /^(?:每週|每周|每週五)$/, frequency: 'weekly' },
  { re: /^(?:頻率先不用)$/, frequency: 'off' },
];

/** 「先不用」在內容／頻率步驟由呼叫端解讀 */
const OFF_AMBIGUOUS_RE = /^(?:先不用|不用)$/;

const PAUSE_RE = /^(?:暫停早安|暫停晨報)$/;
const RESUME_RE = /^(?:恢復早安|開啟早安|繼續早安)$/;
const UNSUBSCRIBE_RE = /^(?:停止早安|退訂早安|取消早安|關閉早安)$/;
const SETTINGS_RE = /^(?:早安設定|晨報設定|早安選項)$/;
const BARE_STOP_RE = /^(?:停止|停|stop)$/i;

export function parseMorningCommand(raw: string): MorningCommand {
  const text = raw.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  if (!text) return { kind: 'none' };

  if (BARE_STOP_RE.test(text)) return { kind: 'bare_stop' };
  if (SETTINGS_RE.test(text)) return { kind: 'settings' };
  if (PAUSE_RE.test(text)) return { kind: 'pause' };
  if (RESUME_RE.test(text)) return { kind: 'resume' };
  if (UNSUBSCRIBE_RE.test(text)) return { kind: 'unsubscribe' };

  for (const rule of CONTENT_RULES) {
    if (rule.re.test(text)) return { kind: 'content_mode', mode: rule.mode };
  }
  for (const rule of FREQ_RULES) {
    if (rule.re.test(text)) return { kind: 'frequency', frequency: rule.frequency };
  }

  if (OFF_AMBIGUOUS_RE.test(text)) {
    return { kind: 'content_mode', mode: 'off' };
  }

  return { kind: 'none' };
}

/** 頻率步驟中「先不用／不用」應解為 frequency=off */
export function resolveOffInFrequencyStep(cmd: MorningCommand): MorningCommand {
  if (cmd.kind === 'content_mode' && cmd.mode === 'off') {
    return { kind: 'frequency', frequency: 'off' };
  }
  return cmd;
}
