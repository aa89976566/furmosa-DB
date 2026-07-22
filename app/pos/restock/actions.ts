'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isNextRedirect } from '@/lib/is-next-redirect';
import {
  getAuthenticatedMerchantId,
  requireMerchantSession,
} from '@/lib/merchant-auth';
import {
  submitAutoReplenishRestockRequest,
  submitSelfSelectRestockRequest,
} from '@/lib/restock-request/service';

export type PosRestockFormState = {
  error?: string;
};

/** Map internal errors to shop-floor language. */
function toMerchantError(e: unknown): string {
  const msg = e instanceof Error ? e.message : '';
  if (msg.includes('至少選擇') || msg.includes('數量大於')) {
    return '請至少選一個商品。數量需要大於 0。';
  }
  if (msg.includes('補貨需求') || msg.includes('填寫')) {
    return '請寫一下你需要什麼，再送出。';
  }
  if (msg.includes('換罐計畫')) {
    return '這項商品目前不能用叫貨申請，請聯繫 Furmosa。';
  }
  if (msg.includes('不存在')) {
    return '有商品找不到了，請重新整理後再試。';
  }
  return '送出失敗，請再試一次。';
}

export async function submitSelfSelectRestockAction(
  _prev: PosRestockFormState,
  formData: FormData,
): Promise<PosRestockFormState> {
  const session = await requireMerchantSession();
  const merchantId = await getAuthenticatedMerchantId();

  const productIds = formData.getAll('productId').map(String);
  const quantities = formData.getAll('quantity').map(String);
  const merchantNote = String(formData.get('merchantNote') ?? '').trim();

  const items = productIds
    .map((productId, i) => ({
      productId,
      quantity: Number(quantities[i] ?? 0),
    }))
    .filter((it) => it.productId);

  try {
    const req = await submitSelfSelectRestockRequest({
      merchantId,
      merchantUserId: session.merchantUserId,
      merchantNote,
      items,
    });
    revalidatePath('/pos');
    revalidatePath('/pos/restock');
    revalidatePath('/pos/restock/progress');
    revalidatePath('/pos/records');
    redirect(`/pos/restock/${req.id}?ok=1`);
  } catch (e) {
    if (isNextRedirect(e)) throw e;
    return { error: toMerchantError(e) };
  }
}

export async function submitAutoReplenishRestockAction(
  _prev: PosRestockFormState,
  formData: FormData,
): Promise<PosRestockFormState> {
  const session = await requireMerchantSession();
  const merchantId = await getAuthenticatedMerchantId();
  const merchantNote = String(formData.get('merchantNote') ?? '');

  try {
    const req = await submitAutoReplenishRestockRequest({
      merchantId,
      merchantUserId: session.merchantUserId,
      merchantNote,
    });
    revalidatePath('/pos');
    revalidatePath('/pos/restock');
    revalidatePath('/pos/restock/progress');
    revalidatePath('/pos/records');
    redirect(`/pos/restock/${req.id}?ok=1`);
  } catch (e) {
    if (isNextRedirect(e)) throw e;
    return { error: toMerchantError(e) };
  }
}
