/** Edge 與測試共用。不讀資料庫。正式頁面仍會再核對資料庫裡的角色。 */
export function isFinancePath(pathname: string): boolean {
  return (
    pathname === '/finance' ||
    pathname.startsWith('/finance/') ||
    pathname === '/api/finance' ||
    pathname.startsWith('/api/finance/')
  );
}

export function decideFinanceAccess(input: {
  pathname: string;
  hasHqSession: boolean;
  role: string | null;
}): 'allow' | 'login' | 'forbid' {
  if (!isFinancePath(input.pathname)) return 'allow';
  if (!input.hasHqSession) return 'login';
  if (input.role !== 'admin') return 'forbid';
  return 'allow';
}

export function evaluateFinanceDbRole(input: {
  hasSession: boolean;
  dbRole: string | null;
}): 'login' | 'forbid' | 'allow' {
  if (!input.hasSession) return 'login';
  if (input.dbRole !== 'admin') return 'forbid';
  return 'allow';
}

/** 店家網址或參數裡的 merchant id 一律忽略，只使用登入階段的店家。 */
export function scopedMerchantId(
  sessionMerchantId: string,
  _requestedMerchantId?: string | null,
): string {
  return sessionMerchantId;
}
