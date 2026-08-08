/** 壽司匠早安文案（台灣繁中、Bark 感但不幼稚） */

/** 新用戶／開戶暱稱步驟固定開場（最多一個「汪」） */
export const SUSHI_CRAFTSMAN_INTRO = [
  '汪！有新朋友，我先聞一下……',
  '好，確認是自己人了 🐾',
  '',
  '我是壽司匠。毛孩的好康、開箱和包裹進度，都歸我顧。',
  '',
  '還不知道怎麼叫你耶，要留個名字或暱稱給我嗎？',
].join('\n');

export const MORNING_CONTENT_PROMPT = [
  '開戶完成後，我想問一件小的：',
  '早上要不要讓我丟一則毛孩短訊給你？',
  '',
  '內容想收哪種？',
  '回：寵物笑話／全球寵物新鮮事／兩種交替／先不用',
].join('\n');

export const MORNING_FREQUENCY_PROMPT = [
  '好，頻率呢？',
  '回：每天／平日／每週／先不用',
  '（每週會在週五早上）',
].join('\n');

export const MORNING_SETTINGS_MENU = [
  '【早安設定】',
  '內容：寵物笑話／全球寵物新鮮事／兩種交替／先不用',
  '頻率：每天／平日／每週／先不用',
  '也可：暫停早安／恢復早安／停止早安／退訂早安',
  '',
  '提醒：單獨回「停止」不會關掉訂單／付款／出貨通知。',
].join('\n');

export const MORNING_STOP_CLARIFY = [
  '「停止」有點模糊～',
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
  return `收到～內容：${opts.contentModeLabel}；頻率：${opts.frequencyLabel}。早上見（若有交易通知，那天早安會讓路）。`;
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
  jokes: '寵物笑話',
  news: '全球寵物新鮮事',
  alternate: '兩種交替',
  off: '先不用',
  unset: '未設定',
};

export const FREQUENCY_LABELS: Record<string, string> = {
  daily: '每天',
  weekday: '平日',
  weekly: '每週',
  off: '先不用',
  unset: '未設定',
};
