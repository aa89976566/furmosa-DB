'use server';

import { quickRestockJarExchangeMerchant } from '@/lib/jar-exchange/quick-restock';

export async function quickRestockJarMerchantAction(input: {
  merchantId: string;
  productId?: string;
}) {
  return quickRestockJarExchangeMerchant(input);
}
