import { createHash } from 'node:crypto';
import { timingSafeEqual } from 'node:crypto';

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
      v !== null,
  );
  filtered.sort(([a], [b]) =>
    a.toLowerCase().localeCompare(b.toLowerCase()),
  );

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
  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided.toUpperCase());
  return (
    expectedBytes.length === providedBytes.length &&
    timingSafeEqual(expectedBytes, providedBytes)
  );
}

/** 綠界 AIO 指定的 URL encode（與官方 PHP SDK 的 safe `-_.!*()` 相容）。 */
export function ecpayUrlEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/%20/g, '+')
    // encodeURIComponent 不會編碼 `~` 與 `'`，但綠界的 PHP urlencode 會。
    .replace(/~/g, '%7E')
    .replace(/'/g, '%27')
    // 綠界官方 SDK 將這四個字元視為 safe，不保留百分比編碼。
    .replace(/%21/gi, '!')
    .replace(/%2A/gi, '*')
    .replace(/%28/gi, '(')
    .replace(/%29/gi, ')')
    .replace(/%[0-9A-F]{2}/g, (m) => m.toUpperCase());
}
