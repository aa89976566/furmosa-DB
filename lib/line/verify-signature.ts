import { createHmac, timingSafeEqual } from 'crypto';

export function verifyLineSignature(
  rawBody: string,
  signatureHeader: string | null,
  channelSecret: string,
): boolean {
  if (!signatureHeader?.trim()) return false;
  const expected = createHmac('sha256', channelSecret).update(rawBody).digest('base64');
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(signatureHeader.trim());
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
