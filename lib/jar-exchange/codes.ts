/** 換罐序號：純數字（預設 8 碼） */
export const JAR_CODE_LENGTH = 8;
const CODE_REGEX = new RegExp(`^\\d{${JAR_CODE_LENGTH}}$`);

export function normalizeJarCode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 16);
}

export function isValidJarCodeFormat(code: string): boolean {
  const n = normalizeJarCode(code);
  return CODE_REGEX.test(n);
}

export function generateJarCode(): string {
  let s = '';
  for (let i = 0; i < JAR_CODE_LENGTH; i++) {
    s += String(Math.floor(Math.random() * 10));
  }
  if (!isValidJarCodeFormat(s)) {
    throw new Error('序號生成異常');
  }
  return s;
}

/** 每次批量生成使用唯一批次，避免與同日舊資料混在同一 PDF */
export function newJarBatchNo(): string {
  const d = new Date();
  const date = d.toISOString().slice(0, 10).replace(/-/g, '');
  const time = [
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
  ]
    .map((n) => String(n).padStart(2, '0'))
    .join('');
  return `BATCH-${date}-${time}`;
}

export function filterValidJarCodes(codes: string[]): string[] {
  return codes.filter(isValidJarCodeFormat);
}

export async function generateUniqueJarCodes(
  count: number,
  exists: (code: string) => Promise<boolean>,
): Promise<string[]> {
  const out: string[] = [];
  const seen = new Set<string>();
  let attempts = 0;
  const maxAttempts = count * 40;

  while (out.length < count && attempts < maxAttempts) {
    attempts++;
    const code = generateJarCode();
    if (seen.has(code)) continue;
    if (await exists(code)) continue;
    seen.add(code);
    out.push(code);
  }

  if (out.length < count) {
    throw new Error('無法產生足夠的唯一序號');
  }
  return out;
}

/** 美容券優惠碼（維持英數） */
const COUPON_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateCouponCode(): string {
  let s = 'GROOM-';
  for (let i = 0; i < 6; i++) {
    s += COUPON_CHARSET[Math.floor(Math.random() * COUPON_CHARSET.length)];
  }
  return s;
}
