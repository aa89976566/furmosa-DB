export const MERCHANT_PASSWORD_MIN_LENGTH = 4;
export const MERCHANT_PASSWORD_MAX_LENGTH = 8;

export function normalizeMerchantUsername(value: string) {
  return value.trim().toLowerCase();
}

export function validateMerchantUsername(value: string) {
  const username = normalizeMerchantUsername(value);
  if (!/^[a-z0-9][a-z0-9._-]{3,31}$/.test(username)) {
    return '帳號需為 4–32 個小寫英文字母、數字、句點、底線或連字號';
  }
  return null;
}

export function validateMerchantPassword(password: string, confirmation: string) {
  if (password.length < MERCHANT_PASSWORD_MIN_LENGTH) {
    return `密碼至少需要 ${MERCHANT_PASSWORD_MIN_LENGTH} 個字元`;
  }
  if (password.length > MERCHANT_PASSWORD_MAX_LENGTH) {
    return `密碼最多 ${MERCHANT_PASSWORD_MAX_LENGTH} 個字元`;
  }
  if (password !== confirmation) return '兩次輸入的密碼不同';
  return null;
}
