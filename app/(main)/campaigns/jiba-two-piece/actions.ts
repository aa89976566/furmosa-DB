'use server';

import { revalidatePath } from 'next/cache';
import { JIBA_PAID } from '@/lib/campaigns/jiba-two-piece/copy';
import { markShippingPaid } from '@/lib/campaigns/jiba-two-piece/service';
import {
  notifyJibaApproved,
  notifyJibaRejected,
  notifyJibaReturn,
} from '@/lib/line/campaigns/jiba-unbox/flow';
import { pushLineMessages } from '@/lib/line/push';

function revalidateReview(id?: string) {
  revalidatePath('/campaigns/jiba-two-piece');
  revalidatePath('/reviews');
  revalidatePath('/dashboard');
  if (id) revalidatePath(`/campaigns/jiba-two-piece/${id}`);
}

export async function approveJibaApplicationAction(formData: FormData) {
  const id = String(formData.get('applicationId') ?? '').trim();
  const note = String(formData.get('note') ?? '').trim() || undefined;
  if (!id) throw new Error('缺少申請 ID');
  await notifyJibaApproved(id, note);
  revalidateReview(id);
}

/** 壽司匠確認轉帳入帳後標記已付並排入出貨 */
export async function markJibaTransferPaidAction(formData: FormData) {
  const id = String(formData.get('applicationId') ?? '').trim();
  if (!id) throw new Error('缺少申請 ID');
  const app = await markShippingPaid(id, 'supervisor');
  await pushLineMessages(app.lineUserId, [{ type: 'text', text: JIBA_PAID }]);
  revalidateReview(id);
}

export async function returnJibaApplicationAction(formData: FormData) {
  const id = String(formData.get('applicationId') ?? '').trim();
  const field = String(formData.get('field') ?? '').trim();
  const reasonCode = String(formData.get('reasonCode') ?? '').trim() || undefined;
  const note = String(formData.get('note') ?? '').trim();
  if (!id || !field) throw new Error('缺少退回欄位');
  if (!note) throw new Error('退回請填原因');
  await notifyJibaReturn(id, [field], reasonCode ?? field, note);
  revalidateReview(id);
}

export async function rejectJibaApplicationAction(formData: FormData) {
  const id = String(formData.get('applicationId') ?? '').trim();
  const note = String(formData.get('note') ?? '').trim();
  const notifyCustomer = String(formData.get('notifyCustomer') ?? '1') === '1';
  if (!id) throw new Error('缺少申請 ID');
  if (!note) throw new Error('拒絕請填內部原因');
  await notifyJibaRejected(id, note, notifyCustomer);
  revalidateReview(id);
}
