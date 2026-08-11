/** 壽司匠早安文案（台灣繁中、成熟 Bark×台灣語境、不幼稚） */

/** 新用戶／開戶暱稱步驟固定開場（最多一個「汪」） */
export const SUSHI_CRAFTSMAN_INTRO = [
  '汪！有新朋友，我先聞一下……',
  '好，確認是自己人了 🐾',
  '',
  '我是壽司匠。毛孩的好康、開箱和包裹進度，都歸我顧。',
  '',
  '還不知道怎麼叫你耶，要留個名字或暱稱給我嗎？',
].join('\n');

/**
 * 舊匯出別名：正式偏好流程文案以 domain/optin 為單一來源。
 * 保留常數名稱以免外部測試／HQ 斷掉；內容改指向 CONSENSUS 文案。
 */
export {
  renderContentPrompt as MORNING_CONTENT_PROMPT_FN,
  renderFrequencyPrompt as MORNING_FREQUENCY_PROMPT_FN,
  OPTIN_FLOW_INTRO as MORNING_SETTINGS_MENU,
  OPTIN_EXPIRED_REPLY,
  OPTIN_CANCEL_REPLY,
  renderOptinSuccessSummary,
} from '@/lib/line/morning/domain/optin/copy';

import {
  renderContentPrompt,
  renderFrequencyPrompt,
} from '@/lib/line/morning/domain/optin/copy';

/** @deprecated 請用 renderContentPrompt；保留字串 getter 相容舊測試 */
export const MORNING_CONTENT_PROMPT = renderContentPrompt();

export const MORNING_FREQUENCY_PROMPT = renderFrequencyPrompt();

export const MORNING_STOP_CLARIFY = [
  '「停止」有點模糊。',
  '若要停早安短訊，請回：停止早安 或 退訂早安。',
  '訂單、付款、出貨這些交易通知會照常，不會因為早安關掉。',
].join('\n');

export function morningPreferenceSavedText(opts: {
  contentModeLabel: string;
  frequencyLabel: string;
}): string {
  if (opts.contentModeLabel === '先不用' || opts.frequencyLabel === '先不用') {
    return '好，早安短訊先關掉。之後想開再回「早安設定」。交易通知不受影響。';
  }
  return `設定完成。內容：${opts.contentModeLabel}；頻率：${opts.frequencyLabel}。早上見（若當天有交易通知，早安會讓路）。`;
}

export function morningPausedText(): string {
  return '早安短訊先暫停。想恢復回「恢復早安」。交易通知照常。';
}

export function morningResumedText(): string {
  return '早安短訊恢復了。想改內容或頻率回「早安設定」。';
}

export function morningUnsubscribedText(): string {
  return '已退訂早安短訊。交易／訂單通知不受影響。之後想開再回「早安設定」。';
}

export const CONTENT_MODE_LABELS: Record<string, string> = {
  jokes: '笑個毛',
  news: '豎起耳朵',
  humor_only: '笑個毛',
  HUMOR_ONLY: '笑個毛',
  news_only: '豎起耳朵',
  NEWS_ONLY: '豎起耳朵',
  alternate: '笑話／新聞交替',
  ALTERNATE: '笑話／新聞交替',
  news_first_fact_fallback: '新鮮事；沒有時改冷知識',
  news_first_fact_or_humor_fallback: '新鮮事；沒有時冷知識／笑話',
  off: '先不用',
  OFF: '先不用',
  unset: '未設定',
  UNSET: '未設定',
};

export const FREQUENCY_LABELS: Record<string, string> = {
  daily: '每天早上',
  weekday: '平日早上',
  weekly: '每週五早上',
  off: '先不用',
  unset: '未設定',
};
