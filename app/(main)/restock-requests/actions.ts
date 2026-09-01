'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { canAccessHqRestockInbox } from '@/lib/restock-request/hq-inbox';
import { revalidateAfterHqRestockReview } from '@/lib/restock-request/hq-inbox-cache';
import {
  approveAndConvertRestockRequest,
  rejectRestockRequest,
  updateRestockRequestAsHq,
} from '@/lib/restock-request/service';
import {
  hqReviewActionStateFromError,
  parseHqExpectedArrivalDate,
  readHqReviewFormFields,
  requireHqReviewActor,
} from '@/lib/restock-request/review-policy';

async function requireHqReviewer() {
  const user = await getCurrentUser();
  if (
    !canAccessHqRestockInbox({
      hasHqSession: Boolean(user),
      hasMerchantSession: false,
    })
  ) {
    redirect('/login');
  }
  return user!;
}

function revalidateHqReviewSurfaces(requestId: string, extra: string[] = []) {
  revalidateAfterHqRestockReview(requestId);
  revalidatePath('/reviews');
  for (const path of extra) {
    revalidatePath(path);
  }
}

export type HqRestockActionState = {
  error?: string;
  ok?: string;
  conflict?: boolean;
  redirectTo?: string;
};

function approvalActionState(error: unknown): HqRestockActionState {
  if (error instanceof Error) {
    const message = error.message;
    if (
      message.includes('Transaction already closed') ||
      message.includes('expired transaction') ||
      message.includes('P2028')
    ) {
      return {
        error: '建立出貨單的處理時間過長，尚未完成核准，請再試一次。',
      };
    }
  }
  return hqReviewActionStateFromError(error);
}

export async function saveRestockRequestHqAction(
  _prev: HqRestockActionState,
  formData: FormData,
): Promise<HqRestockActionState> {
  await requireHqReviewer();
  const fields = readHqReviewFormFields(formData);
  if (!fields.requestId) return { error: '申請不存在' };

  try {
    const expectedArrivalDate = parseHqExpectedArrivalDate(
      fields.expectedArrivalDateRaw,
      false,
    );
    await updateRestockRequestAsHq({
      requestId: fields.requestId,
      hqNote: fields.hqNote,
      expectedArrivalDate,
      items: fields.items,
    });
    revalidateHqReviewSurfaces(fields.requestId);
    return { ok: '已儲存' };
  } catch (e) {
    return hqReviewActionStateFromError(e);
  }
}

export async function approveRestockRequestAction(
  _prev: HqRestockActionState,
  formData: FormData,
): Promise<HqRestockActionState> {
  const user = await requireHqReviewer();
  const fields = readHqReviewFormFields(formData);
  if (!fields.requestId) return { error: '申請不存在' };

  try {
    const expectedArrivalDate = parseHqExpectedArrivalDate(
      fields.expectedArrivalDateRaw,
      true,
    );
    if (!expectedArrivalDate) return { error: '請填寫預計到貨日' };
    const result = await approveAndConvertRestockRequest({
      requestId: fields.requestId,
      hqUserId: requireHqReviewActor(user),
      expectedArrivalDate,
      hqNote: fields.hqNote,
      items: fields.items,
    });
    revalidateHqReviewSurfaces(fields.requestId, ['/shipments', '/orders']);
    return {
      ok: '已核准並建立出貨單',
      redirectTo: `/shipments?s=${result.shipmentId}`,
    };
  } catch (e) {
    return approvalActionState(e);
  }
}

export async function rejectRestockRequestAction(
  _prev: HqRestockActionState,
  formData: FormData,
): Promise<HqRestockActionState> {
  const user = await requireHqReviewer();
  const fields = readHqReviewFormFields(formData);
  if (!fields.requestId) return { error: '申請不存在' };

  try {
    await rejectRestockRequest({
      requestId: fields.requestId,
      hqUserId: requireHqReviewActor(user),
      hqNote: fields.hqNote,
    });
    revalidateHqReviewSurfaces(fields.requestId);
    return { ok: '已拒絕此申請' };
  } catch (e) {
    return hqReviewActionStateFromError(e);
  }
}
