/**
 * LINE 註冊毛孩生日：date-only 解析契約
 * - 不使用 new Date(userInput)
 * - normalize → YYYY-MM-DD
 * - 嚴格日曆＋拒絕未來日
 */

export type BirthdayParseOk = {
  ok: true;
  /** date-only ISO */
  iso: string | null;
  skipped: boolean;
};

export type BirthdayParseErr = {
  ok: false;
  reason: 'unparsed' | 'invalid_calendar' | 'future' | 'ambiguous';
  message: string;
};

export type BirthdayParseResult = BirthdayParseOk | BirthdayParseErr;

export const BIRTHDAY_COPY = {
  prompt: [
    '毛孩生日是哪一天？',
    '西元、民國或中文日期都可以，例如『2020年5月6日』或『民國109年5月6日』。',
    '不確定的話，點『略過』就好。',
  ].join('\n'),
  unparsed: [
    '這個日期我沒讀懂。',
    '可以傳像 2020/5/6 或 109/5/6；不確定也可以直接略過。',
  ].join('\n'),
  invalidCalendar: '月曆上好像沒有這一天，再幫我確認一下日期？',
  future: '這一天還沒到，可能是年份按錯了，再幫我看一下？',
  success: '收到，生日記下來了。',
  recover: '生日這步剛卡一下。再傳一次日期，或不確定就回「略過」。',
} as const;

/** 明確略過同義詞（不可讓其他句子誤判） */
export const BIRTHDAY_SKIP_RE = /^(略過|跳过|skip|不填|沒有|没有|不知道)$/i;

const DIGIT_MAP: Record<string, string> = {
  '〇': '0',
  '零': '0',
  '○': '0',
  'Ｏ': '0',
  'O': '0',
  '一': '1',
  '二': '2',
  '兩': '2',
  '三': '3',
  '四': '4',
  '五': '5',
  '六': '6',
  '七': '7',
  '八': '8',
  '九': '9',
};

/** 將中文數字串轉成阿拉伯數字（支援 十／百／千 簡易結構） */
export function chineseNumeralToInt(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s);

  // 純逐字數字：二〇二五 → 2025
  if (/^[〇零○ＯO一二兩三四五六七八九]+$/.test(s)) {
    let out = '';
    for (const ch of s) {
      const d = DIGIT_MAP[ch];
      if (d === undefined) return null;
      out += d;
    }
    return out.length ? Number(out) : null;
  }

  // 帶 十／百／千
  if (!/[十百千]/.test(s)) return null;
  let total = 0;
  let current = 0;
  let saw = false;
  for (const ch of s) {
    if (ch in DIGIT_MAP) {
      current = Number(DIGIT_MAP[ch]);
      saw = true;
      continue;
    }
    if (ch === '十') {
      total += (current === 0 ? 1 : current) * 10;
      current = 0;
      saw = true;
      continue;
    }
    if (ch === '百') {
      total += (current === 0 ? 1 : current) * 100;
      current = 0;
      saw = true;
      continue;
    }
    if (ch === '千') {
      total += (current === 0 ? 1 : current) * 1000;
      current = 0;
      saw = true;
      continue;
    }
    return null;
  }
  total += current;
  return saw ? total : null;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toIso(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/** 嚴格日曆：拒絕 2/30、13 月等；閏年正確。不用 Date 解析字串。 */
export function isValidCalendarDate(y: number, m: number, d: number): boolean {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (y < 1900 || y > 2100) return false;
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  const mdays = [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d <= mdays[m - 1]!;
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** 今日（Asia/Taipei）date-only，供未來日比較 */
export function taipeiTodayIso(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

function finalize(
  y: number,
  m: number,
  d: number,
  now: Date,
): BirthdayParseResult {
  if (!isValidCalendarDate(y, m, d)) {
    return {
      ok: false,
      reason: 'invalid_calendar',
      message: BIRTHDAY_COPY.invalidCalendar,
    };
  }
  const iso = toIso(y, m, d);
  if (iso > taipeiTodayIso(now)) {
    return { ok: false, reason: 'future', message: BIRTHDAY_COPY.future };
  }
  return { ok: true, iso, skipped: false };
}

function resolveYear(
  yearRaw: number,
  opts: { explicitRoc: boolean; fromChineseYmd: boolean },
): number | null {
  if (opts.explicitRoc) {
    if (yearRaw < 1 || yearRaw > 200) return null;
    return yearRaw + 1911;
  }
  if (opts.fromChineseYmd && yearRaw >= 100 && yearRaw <= 999) {
    // 中文年月日 3 位數 → 民國
    return yearRaw + 1911;
  }
  if (yearRaw >= 1900 && yearRaw <= 2100) return yearRaw;
  // 數字 109/5/6 這類：2–3 位數且非中文上下文 → 視為民國（台灣常用）
  if (!opts.fromChineseYmd && yearRaw >= 1 && yearRaw <= 200) {
    return yearRaw + 1911;
  }
  return null;
}

/**
 * 解析使用者生日輸入。
 * 拒絕：缺年、相對模糊、純 8 碼、亂猜格式。
 */
export function parseRegisterBirthday(
  input: string,
  now: Date = new Date(),
): BirthdayParseResult {
  const trimmed = input.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  if (!trimmed) {
    return { ok: false, reason: 'unparsed', message: BIRTHDAY_COPY.unparsed };
  }
  if (BIRTHDAY_SKIP_RE.test(trimmed)) {
    return { ok: true, iso: null, skipped: true };
  }

  // 拒絕純 8 碼與明顯歧義
  if (/^\d{8}$/.test(trimmed)) {
    return { ok: false, reason: 'ambiguous', message: BIRTHDAY_COPY.unparsed };
  }
  if (/(去年|明年|上個月|下個月|今天|昨天|前天)/.test(trimmed)) {
    return { ok: false, reason: 'ambiguous', message: BIRTHDAY_COPY.unparsed };
  }

  // 缺年份：十一月一日／11月1日／11/1
  if (
    /^(?:[〇零一二兩三四五六七八九十]+|\d{1,2})\s*月\s*(?:[〇零一二兩三四五六七八九十]+|\d{1,2})\s*[日號]?$/.test(
      trimmed,
    ) ||
    /^\d{1,2}\s*[\/\-]\s*\d{1,2}$/.test(trimmed)
  ) {
    return { ok: false, reason: 'ambiguous', message: BIRTHDAY_COPY.unparsed };
  }

  const normalizedSpaces = trimmed.replace(/\s+/g, '');

  // 西元／數字：2025-11-01、2025/11/1、2025.11.01
  {
    const m = normalizedSpaces.match(
      /^(\d{4})\s*[\/\-.\u5e74]\s*(\d{1,2})\s*[\/\-.\u6708]\s*(\d{1,2})\s*[日號]?$/,
    );
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      return finalize(y, mo, d, now);
    }
  }

  // 民國數字：民國114年11月1日、114年11月1日、114/11/1、民國114/11/1
  {
    const explicitRoc = /民國/.test(normalizedSpaces);
    const m = normalizedSpaces.match(
      /^(?:民國)?(\d{2,3})\s*[\/\-.\u5e74]\s*(\d{1,2})\s*[\/\-.\u6708]\s*(\d{1,2})\s*[日號]?$/,
    );
    if (m) {
      const yRaw = Number(m[1]);
      // 4 位數已在上面處理；此處 2–3 位
      if (String(yRaw).length >= 4) {
        return { ok: false, reason: 'unparsed', message: BIRTHDAY_COPY.unparsed };
      }
      const y = resolveYear(yRaw, { explicitRoc: explicitRoc || true, fromChineseYmd: false });
      if (y == null) {
        return { ok: false, reason: 'unparsed', message: BIRTHDAY_COPY.unparsed };
      }
      return finalize(y, Number(m[2]), Number(m[3]), now);
    }
  }

  // 中文年月日：二〇二五年十一月一日／民國一百一十四年十一月一日
  {
    const explicitRoc = /民國/.test(normalizedSpaces);
    const body = normalizedSpaces.replace(/^民國/, '');
    const m = body.match(
      /^([〇零○ＯO一二兩三四五六七八九十百千0-9]+)年([〇零○ＯO一二兩三四五六七八九十百0-9]+)月([〇零○ＯO一二兩三四五六七八九十百0-9]+)[日號]$/,
    );
    if (m) {
      const yRaw = chineseNumeralToInt(m[1]!);
      const mo = chineseNumeralToInt(m[2]!);
      const d = chineseNumeralToInt(m[3]!);
      if (yRaw == null || mo == null || d == null) {
        return { ok: false, reason: 'unparsed', message: BIRTHDAY_COPY.unparsed };
      }
      const y = resolveYear(yRaw, {
        explicitRoc,
        fromChineseYmd: true,
      });
      if (y == null) {
        return { ok: false, reason: 'unparsed', message: BIRTHDAY_COPY.unparsed };
      }
      return finalize(y, mo, d, now);
    }
  }

  // 混合：2025年11月1日 已由第一組覆蓋；民國一百一十四/11/1 等不支援（不猜）
  return { ok: false, reason: 'unparsed', message: BIRTHDAY_COPY.unparsed };
}

/** draft／DB 寫入：date-only → 正午 UTC Date（避免時區日界） */
export function birthdayIsoToUtcNoon(iso: string | null | undefined): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [ys, ms, ds] = iso.split('-');
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  if (!isValidCalendarDate(y, m, d)) return null;
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export type BirthdayStepDecision =
  | { action: 'stay'; message: string; writeDb: false }
  | {
      action: 'advance';
      petBirthday: string | null;
      successMessage: string | null;
      writeDb: false;
    };

/**
 * 生日步驟決策（純函式）：invalid 留步且不寫 DB；valid／略過才前進。
 * 供狀態機與測試共用；forced exception 由呼叫端 catch。
 */
export function decideBirthdayStep(
  input: string,
  now: Date = new Date(),
  parse: typeof parseRegisterBirthday = parseRegisterBirthday,
): BirthdayStepDecision {
  const parsed = parse(input, now);
  if (!parsed.ok) {
    return { action: 'stay', message: parsed.message, writeDb: false };
  }
  if (parsed.skipped) {
    return {
      action: 'advance',
      petBirthday: null,
      successMessage: null,
      writeDb: false,
    };
  }
  return {
    action: 'advance',
    petBirthday: parsed.iso,
    successMessage: BIRTHDAY_COPY.success,
    writeDb: false,
  };
}

/** 例外時仍回傳一次可恢復 stay（絕不拋出） */
export function safeDecideBirthdayStep(
  input: string,
  now: Date = new Date(),
  parse: typeof parseRegisterBirthday = parseRegisterBirthday,
): BirthdayStepDecision {
  try {
    return decideBirthdayStep(input, now, parse);
  } catch (err) {
    console.error('[line] birthday decide failed', {
      err: err instanceof Error ? err.message : 'unknown',
    });
    return {
      action: 'stay',
      message: BIRTHDAY_COPY.recover,
      writeDb: false,
    };
  }
}

export function birthdaySkipQuickReplyItems(): Array<{
  type: 'action';
  action: { type: 'message'; label: string; text: string };
}> {
  return [
    {
      type: 'action',
      action: { type: 'message', label: '略過', text: '略過' },
    },
  ];
}
