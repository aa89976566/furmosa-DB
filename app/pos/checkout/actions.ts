'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireMerchantSession } from '@/lib/merchant-auth';
import { isNextRedirect } from '@/lib/is-next-redirect';
import { completePosCheckout } from '@/lib/pos/checkout-service';

export type CheckoutState = { error?: string };

export async function completeCheckoutAction(
  _previous: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const session = await requireMerchantSession();

  try {
    const raw = JSON.parse(String(formData.get('cart') ?? '[]')) as unknown;
    if (!Array.isArray(raw)) throw new Error('INVALID_CART');

    const result = await completePosCheckout({
      merchantId: session.merchantId,
      merchantUserId: session.merchantUserId,
      items: raw.map((item) => {
        const row = item as Record<string, unknown>;
        return {
          productId: String(row.productId ?? ''),
          tierId: String(row.tierId ?? ''),
          quantity: Number(row.quantity ?? 0),
        };
      }),
    });

    revalidatePath('/pos');
    revalidatePath('/pos/checkout');
    revalidatePath('/pos/sales');
    revalidatePath('/pos/records');
    redirect(`/pos/checkout/success?order=${encodeURIComponent(result.orderNumber)}`);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    const message = error instanceof Error ? error.message : '';
    if (message === 'EMPTY_CART' || message === 'INVALID_CART') {
      return { error: '購物車是空的，請先加入商品。' };
    }
    if (message === 'OUT_OF_STOCK') {
      return { error: '部分商品庫存不足，請重新整理後調整數量。' };
    }
    if (message === 'PRODUCT_NOT_AVAILABLE') {
      return { error: '部分商品已停售或不存在，請重新整理。' };
    }
    return { error: '結帳未完成，資料沒有變更。請再試一次。' };
  }
}
