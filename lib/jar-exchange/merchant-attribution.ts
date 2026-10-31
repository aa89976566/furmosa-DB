/**
 * 店家專用序號代表本次換罐交易的店家；會員店家只供未指定店家的舊序號相容使用。
 * 這裡只決定本次交易歸屬，不會修改會員 CRM 的店家資料。
 */
export function resolveJarCodeMerchantId(
  issuedMerchantId: string | null,
  customerMerchantId: string | null,
): string | null {
  return issuedMerchantId ?? customerMerchantId;
}
