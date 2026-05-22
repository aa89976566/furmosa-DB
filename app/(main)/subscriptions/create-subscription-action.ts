'use server';

import { createSubscriptionRecord } from '@/lib/subscription-create';
import { isRedirectError } from '@/lib/redirect-error';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export type CreateSubscriptionState = { error: string | null };

function toNullable(value: FormDataEntryValue | null) {
  const trimmed = String(value ?? '').trim();
  return trimmed || null;
}

export async function createSubscriptionAction(
  _prev: CreateSubscriptionState,
  formData: FormData,
): Promise<CreateSubscriptionState> {
  try {
    const customerId = String(formData.get('customerId') ?? '').trim();
    const planId = String(formData.get('planId') ?? '').trim();
    const billingCycle = String(formData.get('billingCycle') ?? 'monthly');
    const startDateRaw = String(formData.get('startDate') ?? '').trim();
    const unlimited = formData.get('unlimitedEnd') === 'on';
    const endDateRaw = String(formData.get('endDate') ?? '').trim();
    const recipientName = String(formData.get('recipientName') ?? '').trim();
    const recipientPhone = String(formData.get('recipientPhone') ?? '').trim();
    const shippingAddress = String(formData.get('shippingAddress') ?? '').trim();
    const paymentType = String(formData.get('paymentType') ?? 'monthly');
    const paymentNoteRaw = toNullable(formData.get('paymentNote'));
    const notes = toNullable(formData.get('notes'));

    if (!customerId) return { error: '請選擇客戶' };
    if (!planId) return { error: '請選擇訂閱方案' };
    if (!recipientName) return { error: '請填寫收件人' };
    if (!recipientPhone) return { error: '請填寫收件電話' };
    if (!shippingAddress) return { error: '請填寫收件地址或門市' };

    if (!['monthly', 'halfyear'].includes(billingCycle)) {
      return { error: '付款週期錯誤' };
    }

    const paymentAllowed = ['full', 'monthly', 'other'] as const;
    if (!paymentAllowed.includes(paymentType as (typeof paymentAllowed)[number])) {
      return { error: '付款方式錯誤' };
    }

    if (!startDateRaw) return { error: '請選擇開始日期' };
    const startDate = new Date(startDateRaw);
    if (!Number.isFinite(startDate.getTime())) return { error: '開始日期格式不正確' };

    let endDate: Date | null = null;
    if (billingCycle === 'halfyear') {
      if (!unlimited) {
        if (!endDateRaw) return { error: '半年方案請選擇到期日，或勾選依方案自動計算' };
        const parsed = new Date(endDateRaw);
        if (!Number.isFinite(parsed.getTime())) return { error: '到期日格式不正確' };
        endDate = parsed;
      }
    } else if (!unlimited) {
      if (endDateRaw) {
        const parsed = new Date(endDateRaw);
        if (!Number.isFinite(parsed.getTime())) return { error: '到期日格式不正確' };
        endDate = parsed;
      }
    }

    const sub = await createSubscriptionRecord({
      customerId,
      planId,
      billingCycle: billingCycle as 'monthly' | 'halfyear',
      startDate,
      endDate,
      recipientName,
      recipientPhone,
      shippingAddress,
      paymentType: paymentType as 'full' | 'monthly' | 'other',
      paymentNote: paymentType === 'other' ? paymentNoteRaw : null,
      notes,
    });

    revalidatePath('/subscriptions');
    revalidatePath('/subscriptions/shipments');
    revalidatePath('/shipments');
    revalidatePath(`/customers/${customerId}`);
    redirect(`/subscriptions/${sub.id}`);
  } catch (e) {
    if (isRedirectError(e)) throw e;
    return { error: e instanceof Error ? e.message : '建立失敗' };
  }
}
