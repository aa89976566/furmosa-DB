/**
 * 顧客公開預約必須具備已驗證的 LINE 身份。
 * 匿名 /book 流程標為待關閉；server 端先強制拒絕。
 */
export const CUSTOMER_BOOKING_LOGIN_REQUIRED_MESSAGE =
  '請先以 LINE 登入後再預約';

export function assertCustomerBookingIdentity(
  lineUserId?: string | null,
): string {
  const id = typeof lineUserId === 'string' ? lineUserId.trim() : '';
  if (!id) {
    throw new Error(CUSTOMER_BOOKING_LOGIN_REQUIRED_MESSAGE);
  }
  return id;
}

export function isCustomerBookingIdentityPresent(
  lineUserId?: string | null,
): boolean {
  return Boolean(typeof lineUserId === 'string' && lineUserId.trim());
}
