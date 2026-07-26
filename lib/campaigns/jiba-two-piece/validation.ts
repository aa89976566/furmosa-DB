/** 雞霸開箱 — 欄位驗證（純函式，便於單元測試） */

export function normalizeInstagramHandle(raw: string): string | null {
  const t = raw.trim().replace(/^＠/, '@');
  if (!t.startsWith('@')) return null;
  const handle = t.slice(1).replace(/[^A-Za-z0-9._]/g, '');
  if (handle.length < 1 || handle.length > 30) return null;
  return `@${handle}`;
}

export function validRecipientName(raw: string): string | null {
  const t = raw.trim();
  if (t.length < 2 || t.length > 20) return null;
  if (/^\d+$/.test(t)) return null;
  return t;
}

export function validRecipientPhone(raw: string): string | null {
  const t = raw.replace(/[\s\-]/g, '');
  if (!/^09\d{8}$/.test(t)) return null;
  return t;
}

export function isJoinIntent(text: string): boolean {
  return /^(?:我要參加|要|可以|好|來吧|我想參加|怎麼參加|算我一個|敢|敢，來吧|這個我可以！|\+1|yes)$/i.test(
    text.trim(),
  );
}

export function isDeclineIntent(text: string): boolean {
  return /^(?:這次先不要|不要|先不要|我再想一下)$/i.test(text.trim());
}
