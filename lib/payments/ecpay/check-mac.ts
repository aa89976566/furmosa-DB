import { createHash } from 'node:crypto';

/**
 * 綠界 AIO CheckMacValue（SHA256）。
 * 規則：參數依 key 字母排序 → 前後加 HashKey/HashIV → urlencode → toLowerCase → SHA256 → toUpperCase
 * @see https://developers.ecpay.com.tw/
 */
export function generateCheckMacValue(
  params: Record<string, string | number | undefined | null>,
  hashKey: string,
  hashIV: string,
): string {
  const filtered = Object.entries(params).filter(
    ([k, v]) =>
      k !== 'CheckMacValue' &&
      v !== undefined &&
      v !== null &&
      String(v) !== '',
  );
  filtered.sort(([a], [b]) => (a > b ? 1 : a < b ? -1 : 0));

  const raw =
    `HashKey=${hashKey}&` +
    filtered.map(([k, v]) => `${k}=${v}`).join('&') +
    `&HashIV=${hashIV}`;

  const encoded = ecpayUrlEncode(raw).toLowerCase();
  return createHash('sha256').update(encoded).digest('hex').toUpperCase();
}

export function verifyCheckMacValue(
  params: Record<string, string | number | undefined | null>,
  hashKey: string,
  hashIV: string,
): boolean {
  const provided = String(params.CheckMacValue ?? '');
  if (!provided) return false;
  const expected = generateCheckMacValue(params, hashKey, hashIV);
  return expected === provided.toUpperCase();
}

/** 綠界指定的 URL encode（.NET HttpUtility.UrlEncode 相容子集） */
export function ecpayUrlEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/%20/g, '+')
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%[0-9A-F]{2}/g, (m) => m.toUpperCase());
}
