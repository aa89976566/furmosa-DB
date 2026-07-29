/** Classify auth/login failures for safe user-facing messages (no secret leakage). */

export function isDbUnreachableError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : '';
  const code =
    typeof error === 'object' && error !== null
      ? String((error as { code?: string }).code ?? '')
      : '';
  return (
    code === 'P1001' ||
    code === 'P1017' ||
    code === 'P1002' ||
    code === 'P1000' ||
    code === 'P1010' ||
    /PrismaClientInitializationError/i.test(name) ||
    /Can't reach database server/i.test(msg) ||
    /ECONNREFUSED/i.test(msg) ||
    /ENOTFOUND/i.test(msg) ||
    /ETIMEDOUT/i.test(msg) ||
    /localhost:5432/i.test(msg) ||
    /Timed out fetching a new connection/i.test(msg) ||
    /Connection terminated/i.test(msg) ||
    /Server has closed the connection/i.test(msg) ||
    /Connection pool/i.test(msg) ||
    /Error in PostgreSQL connection/i.test(msg) ||
    /Tenant or user not found/i.test(msg) ||
    /password authentication failed/i.test(msg) ||
    /MaxClientsInSessionMode/i.test(msg) ||
    /prepared statement/i.test(msg)
  );
}

export function isMissingTableOrColumnError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const code = (error as { code?: string }).code;
    if (code === 'P2021' || code === 'P2022' || code === 'P2010') return true;
  }
  const msg = error instanceof Error ? error.message : String(error);
  return (
    /does not exist/i.test(msg) ||
    /relation .+ does not exist/i.test(msg) ||
    /column .+ does not exist/i.test(msg)
  );
}

export function isAuthSecretError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /AUTH_SECRET/i.test(msg) || /缺少環境變數 AUTH_SECRET/i.test(msg);
}

/** Map thrown errors to a Traditional Chinese login form message. */
export function loginFailureMessage(error: unknown): string {
  if (isAuthSecretError(error)) {
    return '系統登入設定異常（AUTH_SECRET）。請總部檢查 Vercel 環境變數。';
  }
  if (isDbUnreachableError(error)) {
    return '暫時連不上資料庫，請稍後再試。若持續出現，請總部檢查 Vercel 的 DATABASE_URL／Supabase。';
  }
  if (isMissingTableOrColumnError(error)) {
    return '帳號資料表尚未就緒，請總部確認資料庫 migration。';
  }
  console.error('[auth] login unexpected', error);
  const name = error instanceof Error ? error.name : 'Error';
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: string }).code ?? '')
      : '';
  // 給工程師可對照的短碼，仍不洩漏連線字串
  const hint = code || name;
  return `登入時發生錯誤（${hint}），請稍後再試。`;
}
