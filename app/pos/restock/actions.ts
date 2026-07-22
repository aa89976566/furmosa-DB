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
    redirect(`/pos/restock/${req.id}`);
  } catch (e) {
    if (isNextRedirect(e)) throw e;
    return {
      error: e instanceof Error ? e.message : '送出失敗，請稍後再試',
    };
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
    redirect(`/pos/restock/${req.id}`);
  } catch (e) {
    if (isNextRedirect(e)) throw e;
    return {
      error: e instanceof Error ? e.message : '送出失敗，請稍後再試',
    };
  }
}
