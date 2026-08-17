/**
 * 雞霸運費轉帳收款資訊：只從環境變數讀取。
 * 完整帳號不得寫進 Git、fixture、log 或申請資料。
 */

export const JIBA_TRANSFER_ENV_KEYS = {
  bankName: 'JIBA_TRANSFER_BANK_NAME',
  bankCode: 'JIBA_TRANSFER_BANK_CODE',
  account: 'JIBA_TRANSFER_ACCOUNT',
} as const;

export type JibaTransferAccount = {
  bankName: string;
  bankCode: string;
  account: string;
  accountLast5: string;
};

export type JibaTransferAccountResult =
  | { ok: true; value: JibaTransferAccount }
  | { ok: false; missing: string[] };

export function accountLast5(account: string): string {
  const digits = account.replace(/\s+/g, '');
  if (digits.length < 5) return digits;
  return digits.slice(-5);
}

export function readJibaTransferAccount(
  env: Record<string, string | undefined> = process.env,
): JibaTransferAccountResult {
  const bankName = (env[JIBA_TRANSFER_ENV_KEYS.bankName] ?? '').trim();
  const bankCode = (env[JIBA_TRANSFER_ENV_KEYS.bankCode] ?? '').trim();
  const account = (env[JIBA_TRANSFER_ENV_KEYS.account] ?? '').trim();
  const missing: string[] = [];
  if (!bankName) missing.push(JIBA_TRANSFER_ENV_KEYS.bankName);
  if (!bankCode) missing.push(JIBA_TRANSFER_ENV_KEYS.bankCode);
  if (!account) missing.push(JIBA_TRANSFER_ENV_KEYS.account);
  if (missing.length > 0) return { ok: false, missing };
  return {
    ok: true,
    value: {
      bankName,
      bankCode,
      account,
      accountLast5: accountLast5(account),
    },
  };
}

export function isProductionRuntime(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.VERCEL_ENV === 'production' || env.NODE_ENV === 'production';
}

/** 缺 env 時 fail closed：不回傳任何帳號，只記可監控、不含敏感值的錯誤 */
export function logJibaTransferEnvMissing(missing: string[]): void {
  console.error('[jiba-transfer] missing_env', {
    missing,
    production: isProductionRuntime(),
  });
}

export function requireJibaTransferAccount(
  env: Record<string, string | undefined> = process.env,
): JibaTransferAccount | null {
  const result = readJibaTransferAccount(env);
  if (result.ok) return result.value;
  logJibaTransferEnvMissing(result.missing);
  return null;
}
