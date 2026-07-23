export {
  MERCHANT_SESSION_COOKIE,
  MERCHANT_SESSION_TYPE,
  authenticateMerchantCredentials,
  buildMerchantSessionClaims,
  clearMerchantSessionCookie,
  getMerchantSessionFromCookies,
  loginMerchantWithPassword,
  readMerchantSession,
  setMerchantSessionCookie,
  signMerchantSession,
  type MerchantSessionPayload,
} from '@/lib/merchant-auth/session';

export {
  MerchantAccessError,
  assertMerchantAccess,
  getAuthenticatedMerchantId,
  merchantScope,
  requireMerchantSession,
  resolveMerchantIdForQuery,
} from '@/lib/merchant-auth/access';
