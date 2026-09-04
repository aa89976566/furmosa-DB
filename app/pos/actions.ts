'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { clearMerchantSessionCookie, requireMerchantSession } from '@/lib/merchant-auth';
import { recordCounterSale } from '@/lib/pos/record-counter-sale';
import { isNextRedirect } from '@/lib/is-next-redirect';

export async function posLogoutAction() {
  await clearMerchantSessionCookie();
  redirect('/pos/login');
}

export type CounterCheckoutState = {
  error?: string;
  ok?: boolean;
  total?: number;
};

export async function checkoutCounterSaleAction(
  _prev: CounterCheckoutState,
  formData: FormData,
): Promise<CounterCheckoutState> {
  try {
    const session = await requireMerchantSession();
    const raw = String(formData.get('lines') ?? '');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { error: '本單資料讀取失敗，請重新點選商品。' };
    }
    if (!Array.isArray(parsed)) {
      return { error: '本單資料不正確。' };
    }
    const requested = parsed.map((line) => ({
      productId: String((line as { productId?: string }).productId ?? ''),
      tierId: String((line as { tierId?: string }).tierId ?? ''),
      qty: Number((line as { qty?: number }).qty),
    }));
    const result = await recordCounterSale(session.merchantId, requested);
    revalidatePath('/pos');
    revalidatePath('/pos/sell');
    revalidatePath('/pos/stock');
    revalidatePath('/pos/records');
    revalidatePath('/orders');
    revalidatePath(`/merchants/${session.merchantId}`);
    revalidatePath(`/merchants/${session.merchantId}/shipments`);
    revalidatePath(`/merchants/${session.merchantId}/settlement`);
    return { ok: true, total: result.total };
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    const message = err instanceof Error ? err.message : '結帳失敗';
    return { error: message };
  }
}
