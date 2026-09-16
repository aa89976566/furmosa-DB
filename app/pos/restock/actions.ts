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
  assertMerchantRestockSelection,
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
  if (msg.includes('換罐計畫') || msg.includes('不能補貨')) {
    return '這項商品目前不能補貨，請聯絡匠寵。';
  }
  if (msg.includes('不存在')) {
    return '有商品找不到了，請重新整理後再試。';
  }
  if (msg.includes('本店可補貨清單')) return msg;
  if (msg.includes('規格') || msg.includes('請選擇具體規格')) {
    return msg; // 規格驗證錯誤直接呈現給使用者
  }
  return '送出失敗，請再試一次。';
}

export async function submitSelfSelectRestockAction(
  _prev: PosRestockFormState,
  formData: FormData,
): Promise<PosRestockFormState> {
  const session = await requireMerchantSession();
  const merchantId = await getAuthenticatedMerchantId();

  if (String(formData.get('expectedMerchantId') ?? '') !== merchantId) {
    return { error: '登入分店已變更，請重新整理並確認補貨單' };
  }

  const productIds = formData.getAll('productId').map(String);
  const quantities = formData.getAll('quantity').map(String);
  const variantKeys = formData.getAll('variantKey').map(String);
  const weightGramsList = formData.getAll('weightGrams').map(String);
  const merchantNote = String(formData.get('merchantNote') ?? '').trim();

  const items = productIds
    .map((productId, i) => ({
      productId,
      quantity: Number(quantities[i] ?? 0),
      weightGrams: weightGramsList[i] ? Number(weightGramsList[i]) : null,
      variantKey: variantKeys[i] || null,
    }))
    .filter((it) => it.productId);

  try {
    await assertMerchantRestockSelection(merchantId, items.map((item) => item.productId));
    const req = await submitSelfSelectRestockRequest({
      merchantId,
      merchantUserId: session.merchantUserId,
      merchantNote,
      items,
    });
    revalidatePath('/pos');
    revalidatePath('/pos/stock');
    revalidatePath('/pos/refill');
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
    revalidatePath('/pos/stock');
    revalidatePath('/pos/refill');
    revalidatePath('/pos/restock');
    revalidatePath('/pos/restock/progress');
    revalidatePath('/pos/records');
    redirect(`/pos/restock/${req.id}?ok=1`);
  } catch (e) {
    if (isNextRedirect(e)) throw e;
    return { error: toMerchantError(e) };
  }
}
