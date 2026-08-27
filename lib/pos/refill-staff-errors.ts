/** 把後端錯誤轉成店員看得懂的中文，不顯示技術代碼。 */

const OLD_JAR_CODES = new Set([
  'SERIAL_NOT_OWNED',
  'SERIAL_LOCKED',
  'SERIAL_USED',
  'INVALID_SERIAL',
  'NO_OLD_JAR_NEEDED',
]);

const NEW_JAR_CODES = new Set(['SERIAL_USED', 'SERIAL_NOT_FOUND', 'INVALID_SERIAL']);

export type RefillStaffErrorContext = 'lookup' | 'old' | 'new' | 'complete' | 'missing';

export function mapRefillStaffError(
  input: { error?: string | null; code?: string | null },
  context: RefillStaffErrorContext = 'lookup',
): string {
  const code = input.code ?? '';
  const raw = (input.error ?? '').trim();

  if (code === 'WRONG_STORE' || raw.includes('只能在')) {
    return '這筆換罐不是在本店領取';
  }
  if (code === 'UNPAID' || raw.includes('尚未付款')) {
    return '尚未完成付款，目前無法換罐';
  }
  if (context === 'lookup') {
    if (
      code === 'NO_OPEN_ORDER' ||
      code === 'SERIAL_NOT_FOUND' ||
      code === 'ORDER_NOT_FOUND' ||
      code === 'INVALID_SERIAL'
    ) {
      return '找不到這個罐子的換罐資料';
    }
  }
  if (context === 'old' && (OLD_JAR_CODES.has(code) || raw.includes('序號'))) {
    return '這個罐子不能用於這筆換罐';
  }
  if (
    (context === 'new' || context === 'complete') &&
    (NEW_JAR_CODES.has(code) || raw.includes('新罐') || (context === 'new' && raw.includes('序號')))
  ) {
    return '這個新罐目前不能交付';
  }
  if (code === 'NEED_OLD_JAR') {
    return '請先確認收到空罐';
  }
  if (raw && !looksTechnical(raw)) return raw;
  if (context === 'complete') {
    return '這筆換罐目前不能完成，請重新整理後再試一次';
  }
  return '這筆換罐目前不能完成，請重新整理後再試一次';
}

function looksTechnical(message: string): boolean {
  return /P\d{4}|Prisma|Unauthorized|Invalid state|500|TypeError|ECONN/i.test(message);
}
