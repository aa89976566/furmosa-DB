/**
 * 雞霸開箱 — 欄位驗證（slot filling）
 *
 * 設計參考（對話式表單常見作法）：
 * 1. 以「欄位（slot）」為單位驗證，錯了只重問該欄，不整段重來
 * 2. 錯誤訊息要具體、有範例，語氣不指責
 * 3. 選單按鈕／意圖詞（如「我要參加」）不可當欄位答案
 * 4. 同一欄連續失敗數次 → 提供找小幫手出口，避免死循環
 *
 * @see https://chatbotscape.com/academy/multi-turn-form-design
 * @see LivePerson / Global Tech Council conversation design：empathy + example + exit ramp
 */

/** 選單、按鈕、流程指令——填資料時若傳這些，視為無效答案並重問 */
const FIELD_COMMAND_BLOCKLIST =
  /^(?:我要參加|要|可以|好|來吧|我想參加|怎麼參加|算我一個|敢|敢，來吧|這個我可以！|\+1|yes|這次先不要|不要|先不要|我再想一下|開箱|開箱文|開箱任務|ugc|試吃開箱|開箱合作|合作開箱|毛孩來開箱|來開箱|開箱研究|先看看規則|活動中心|嗷嗚計劃|換罐計劃|回家|取消|重來|查看目前資料|選門市\s*\d+|重選門市|手動輸入門市|我同意|同意|不同意|我想再看一次|略過|資料正確，送出|修改收件資料|修改門市|先不要送出|現在付款|我已轉帳|稍後再說|我要轉帳|轉帳資訊|等等再付|先不用|選雞霸兩片|選雞霸|選青蛙凍乾|選青蛙|選貓草雞肉乾|雞霸|青蛙|貓草雞肉乾\s*30g|好，開始填收件資訊|好，開始填資料|我了解用途，開始填收件資訊|我了解用途，開始填資料|我了解，開始填資料|這次先不加|想加購|要加購|加購|我要加購|先不加|不加購|接著上次開箱|重新開始開箱)$/i;

export type NameCheckResult =
  | { ok: true; value: string }
  | {
      ok: false;
      reason: 'empty' | 'too_short' | 'too_long' | 'digits' | 'phone' | 'handle' | 'command' | 'not_name';
    };

export function checkRecipientName(raw: string): NameCheckResult {
  const t = raw.trim().replace(/\s+/g, ' ');
  if (!t) return { ok: false, reason: 'empty' };
  if (t.length < 2) return { ok: false, reason: 'too_short' };
  if (t.length > 20) return { ok: false, reason: 'too_long' };
  if (/^\d+$/.test(t)) return { ok: false, reason: 'digits' };
  const digitsOnly = t.replace(/[\s\-]/g, '');
  if (/^09\d{8}$/.test(digitsOnly)) return { ok: false, reason: 'phone' };
  if (t.startsWith('@') || t.startsWith('＠')) return { ok: false, reason: 'handle' };
  if (isJoinIntent(t) || isDeclineIntent(t) || FIELD_COMMAND_BLOCKLIST.test(t)) {
    return { ok: false, reason: 'command' };
  }
  // 至少要有中文或英文字母，才像姓名
  if (!/[\u4e00-\u9fffA-Za-z]/.test(t)) return { ok: false, reason: 'not_name' };
  // 拒絕純標點／表情
  if (/^[\p{P}\p{S}\s]+$/u.test(t)) return { ok: false, reason: 'not_name' };
  return { ok: true, value: t };
}

export function validRecipientName(raw: string): string | null {
  const r = checkRecipientName(raw);
  return r.ok ? r.value : null;
}

export function normalizeInstagramHandle(raw: string): string | null {
  const t = raw.trim().replace(/^＠/, '@');
  if (!t.startsWith('@')) return null;
  if (FIELD_COMMAND_BLOCKLIST.test(t)) return null;
  const handle = t.slice(1).replace(/[^A-Za-z0-9._]/g, '');
  if (handle.length < 1 || handle.length > 30) return null;
  return `@${handle}`;
}

export function validRecipientPhone(raw: string): string | null {
  const t = raw.replace(/[\s\-]/g, '');
  if (!/^09\d{8}$/.test(t)) return null;
  return t;
}

/** 毛孩名：允許略過；拒絕選單指令 */
export function validPetNameOrSkip(raw: string): string | null | 'skip' {
  const t = raw.trim();
  if (/^(?:略過|跳过|skip|不填)$/i.test(t)) return 'skip';
  if (t.length < 1 || t.length > 20) return null;
  if (FIELD_COMMAND_BLOCKLIST.test(t) || isJoinIntent(t) || isDeclineIntent(t)) return null;
  return t;
}

export function isJoinIntent(text: string): boolean {
  return /^(?:我要參加|要|可以|好|來吧|我想參加|怎麼參加|算我一個|敢|敢，來吧|這個我可以！|\+1|yes)$/i.test(
    text.trim(),
  );
}

export function isDeclineIntent(text: string): boolean {
  return /^(?:這次先不要|不要|先不要|我再想一下|先不用)$/i.test(text.trim());
}

/** 同一欄位連續驗證失敗上限：之後改提示找小幫手 */
export const FIELD_MAX_RETRIES = 3;
