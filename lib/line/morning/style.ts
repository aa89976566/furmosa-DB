/**
 * 成熟 Bark × 台灣語境：單一可測 style module
 * 新聞／笑話／初次見面／偏好／通知共用規則。
 */

export const SUSHI_INTRO_CANONICAL = [
  '汪！有新朋友，我先聞一下……',
  '好，確認是自己人了 🐾',
  '',
  '我是壽司匠。毛孩的好康、開箱和包裹進度，都歸我顧。',
  '',
  '還不知道怎麼叫你耶，要留個名字或暱稱給我嗎？',
].join('\n');

const BANNED_PHRASES = [
  '小管家',
  '小編',
  '親愛的',
  '寶貝',
  '萌萌噠',
  '主人最棒',
  '汪汪汪',
  '驚呆',
  '居然',
  '必看',
  '震撼',
  '視頻',
  '信息',
  '網絡',
];

const BARK_MARKERS = ['汪', '我先聞', '耳朵收到', '留下一個腳印', '聞一下', '嗅到'];

const ALLOWED_EMOJI = new Set(['🐾', '🐶', '🐱', '🐰', '🐦']);

export type StyleLintResult = {
  ok: boolean;
  issues: string[];
  charCount: number;
  barkCount: number;
  emojiCount: number;
};

function countCjkAndChars(text: string): number {
  // 以去除空白後字元數近似「中文字」預算
  return text.replace(/\s/g, '').length;
}

function countEmojis(text: string): { total: number; disallowed: string[] } {
  const found = text.match(/\p{Extended_Pictographic}/gu) ?? [];
  const disallowed = found.filter((e) => !ALLOWED_EMOJI.has(e));
  return { total: found.length, disallowed };
}

function countBarkImagery(text: string): number {
  let n = 0;
  for (const m of BARK_MARKERS) {
    if (text.includes(m)) n += 1;
  }
  // 「汪」連發另計
  const wang = text.match(/汪/g)?.length ?? 0;
  if (wang > 1) n += wang - 1;
  return n;
}

export function lintMorningStyle(
  text: string,
  opts?: {
    kind?: 'news' | 'joke' | 'animal_fact' | 'intro' | 'preference' | 'notice';
    /** 新聞正文目標 70–120；joke 可較短 */
    minChars?: number;
    maxChars?: number;
    maxParagraphs?: number;
  },
): StyleLintResult {
  const kind = opts?.kind ?? 'notice';
  const issues: string[] = [];
  const body = text.trim();
  const charCount = countCjkAndChars(body);
  const barkCount = countBarkImagery(body);
  const emoji = countEmojis(body);

  for (const ban of BANNED_PHRASES) {
    if (body.includes(ban)) issues.push(`banned:${ban}`);
  }

  // 初次見面 canonical 允許「汪」+「我先聞」同框；其餘文案仍限單一 Bark 意象
  if (kind !== 'intro' && barkCount > 1) issues.push('bark_imagery_gt_1');
  if (emoji.total > 1) issues.push('emoji_gt_1');
  if (emoji.disallowed.length) issues.push(`emoji_disallowed:${emoji.disallowed.join('')}`);

  const paragraphs = body.split(/\n\s*\n/).filter(Boolean);
  const maxParagraphs = opts?.maxParagraphs ?? (kind === 'news' ? 2 : kind === 'intro' ? 8 : 6);
  if (paragraphs.length > maxParagraphs) issues.push('too_many_paragraphs');

  if (kind === 'news') {
    const min = opts?.minChars ?? 70;
    const max = opts?.maxChars ?? 120;
    // 來源行不計入：去掉「來源：」後段
    const main = body.split(/\n\n來源：/)[0] ?? body;
    const mainCount = countCjkAndChars(main);
    if (mainCount < min) issues.push('news_too_short');
    if (mainCount > max) issues.push('news_too_long');
  }

  if (kind === 'intro') {
    if (!body.includes('壽司匠')) issues.push('intro_missing_brand');
    if ((body.match(/汪/g)?.length ?? 0) !== 1) issues.push('intro_wang_count');
  }

  // 物種錯置粗檢：標題說貓卻正文強迫搖尾巴
  if (/貓/.test(body) && /搖尾巴/.test(body) && !/狗/.test(body)) {
    issues.push('species_mismatch_tail_wag');
  }

  return {
    ok: issues.length === 0,
    issues,
    charCount,
    barkCount,
    emojiCount: emoji.total,
  };
}

/** 新聞模板：事實 → 一句觀察 → 來源（不新增原文沒有的數字／地名／人名／因果） */
export function renderNewsInStyle(input: {
  factSummary: string;
  observation?: string | null;
  sourceName: string;
  publishedAt?: Date | null;
  canonicalUrl: string;
}): { text: string; lint: StyleLintResult } {
  const fact = input.factSummary.replace(/\s+/g, ' ').trim();
  const obs = input.observation?.replace(/\s+/g, ' ').trim();
  // 觀察不得引入新事實詞；僅允許柔和語氣，呼叫端應傳已審核短句
  const datePart = input.publishedAt
    ? `${input.publishedAt.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' })} · `
    : '';
  const main = obs ? `${fact}\n${obs}` : fact;
  const text = `${main}\n\n來源：${datePart}${input.sourceName}\n${input.canonicalUrl}`;
  return { text, lint: lintMorningStyle(text, { kind: 'news' }) };
}

export function assertNoInventedFacts(
  generated: string,
  sourceText: string,
): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  // 來源行／URL 的日期與路徑數字不計入「發明事實」
  const main = (generated.split(/\n\n來源：/)[0] ?? generated)
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\d{4}[/-]\d{1,2}[/-]\d{1,2}/g, ' ');
  const nums = main.match(/\d+(?:\.\d+)?/g) ?? [];
  for (const n of nums) {
    if (!sourceText.includes(n)) issues.push(`invented_number:${n}`);
  }
  return { ok: issues.length === 0, issues };
}
