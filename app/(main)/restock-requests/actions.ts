'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { isNextRedirect } from '@/lib/is-next-redirect';
import {
  approveAndConvertRestockRequest,
  rejectRestockRequest,
  updateRestockRequestAsHq,
} from '@/lib/restock-request/service';

async function requireHqUser() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

export type HqRestockActionState = { error?: string; ok?: string };

export async function saveRestockRequestHqAction(
  _prev: HqRestockActionState,
  formData: FormData,
): Promise<HqRestockActionState> {
  await requireHqUser();
  const requestId = String(formData.get('requestId') ?? '');
  const hqNote = String(formData.get('hqNote') ?? '');
  const arrivalRaw = String(formData.get('expectedArrivalDate') ?? '').trim();
  const expectedArrivalDate = arrivalRaw ? new Date(arrivalRaw) : null;

  const productIds = formData.getAll('productId').map(String);
  const approvedQtys = formData.getAll('approvedQuantity').map(String);
  const requestedQtys = formData.getAll('requestedQuantity').map(String);

  const items = productIds
    .map((productId, i) => ({
      productId,
      approvedQuantity: Number(approvedQtys[i] ?? 0),
      requestedQuantity: requestedQtys[i] ? Number(requestedQtys[i]) : null,
    }))
    .filter((it) => it.productId);

  try {
    await updateRestockRequestAsHq({
      requestId,
      hqNote,
      expectedArrivalDate,
      items,
    });
    revalidatePath('/restock-requests');
    revalidatePath(`/restock-requests/${requestId}`);
    return { ok: '已儲存' };
  } catch (e) {
    return { error: e instanceof Error ? e.message : '儲存失敗' };
  }
}

export async function approveRestockRequestAction(
  _prev: HqRestockActionState,
  formData: FormData,
): Promise<HqRestockActionState> {
  const user = await requireHqUser();
  const requestId = String(formData.get('requestId') ?? '');
  const hqNote = String(formData.get('hqNote') ?? '');
  const arrivalRaw = String(formData.get('expectedArrivalDate') ?? '').trim();
  if (!arrivalRaw) return { error: '請填寫預計到貨日' };
  const expectedArrivalDate = new Date(arrivalRaw);

  // Persist item edits before approve if present
  const productIds = formData.getAll('productId').map(String);
  if (productIds.length > 0) {
    const approvedQtys = formData.getAll('approvedQuantity').map(String);
    const requestedQtys = formData.getAll('requestedQuantity').map(String);
    try {
      await updateRestockRequestAsHq({
        requestId,
        hqNote,
        expectedArrivalDate,
        items: productIds.map((productId, i) => ({
          productId,
          approvedQuantity: Number(approvedQtys[i] ?? 0),
          requestedQuantity: requestedQtys[i] ? Number(requestedQtys[i]) : null,
        })),
      });
    } catch (e) {
      return { error: e instanceof Error ? e.message : '儲存品項失敗' };
    }
  }

  try {
    const result = await approveAndConvertRestockRequest({
      requestId,
      hqUserId: user.userId,
      expectedArrivalDate,
      hqNote,
    });
    revalidatePath('/restock-requests');
    revalidatePath(`/restock-requests/${requestId}`);
    revalidatePath('/shipments');
    revalidatePath('/orders');
    redirect(`/shipments?s=${result.shipmentId}`);
  } catch (e) {
    if (isNextRedirect(e)) throw e;
    return { error: e instanceof Error ? e.message : '核准失敗' };
  }
}

export async function rejectRestockRequestAction(
  _prev: HqRestockActionState,
  formData: FormData,
): Promise<HqRestockActionState> {
  const user = await requireHqUser();
  const requestId = String(formData.get('requestId') ?? '');
  const hqNote = String(formData.get('hqNote') ?? '');
  try {
    await rejectRestockRequest({
      requestId,
      hqUserId: user.userId,
      hqNote,
    });
    revalidatePath('/restock-requests');
    revalidatePath(`/restock-requests/${requestId}`);
    return { ok: '已拒絕此申請' };
  } catch (e) {
    return { error: e instanceof Error ? e.message : '拒絕失敗' };
  }
}
