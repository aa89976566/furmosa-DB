import type { MerchantSessionPayload } from './session';

export type MerchantSessionAccount = {
  id: string;
  merchantId: string;
  username: string;
  isActive: boolean;
  merchant: { status: string };
};

export function isMerchantSessionAccountActive(
  session: MerchantSessionPayload,
  account: MerchantSessionAccount | null,
) {
  return Boolean(
    account &&
      account.id === session.merchantUserId &&
      account.merchantId === session.merchantId &&
      account.username === session.username &&
      account.isActive &&
      account.merchant.status === 'active',
  );
}

