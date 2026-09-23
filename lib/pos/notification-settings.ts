export function normalizeMerchantLineUserId(value: FormDataEntryValue | null) {
  const lineUserId = String(value ?? '').trim();
  if (lineUserId && !/^U[a-zA-Z0-9]+$/.test(lineUserId)) {
    throw new Error('LINE User ID 必須是 U 開頭的英數字');
  }
  return lineUserId || null;
}
