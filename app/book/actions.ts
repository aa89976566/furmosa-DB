'use server';

import { redirect } from 'next/navigation';
import { isNextRedirect } from '@/lib/is-next-redirect';
import { submitCustomerBooking } from '@/lib/booking/service';

export type PublicBookState = { error?: string };

export async function publicBookAction(
  _prev: PublicBookState,
  formData: FormData,
): Promise<PublicBookState> {
  const merchantId = String(formData.get('merchantId') ?? '');
  try {
    const startsAt = new Date(String(formData.get('startsAt') ?? ''));
    if (Number.isNaN(startsAt.getTime())) {
      return { error: '請選擇時間。' };
    }
    const row = await submitCustomerBooking({
      merchantId,
      startsAt,
      customerName: String(formData.get('customerName') ?? ''),
      customerPhone: String(formData.get('customerPhone') ?? ''),
      petName: String(formData.get('petName') ?? '') || null,
      customerNote: String(formData.get('customerNote') ?? '') || null,
      serviceProductId: String(formData.get('serviceProductId') ?? '') || null,
      serviceName: String(formData.get('serviceName') ?? '') || null,
    });
    redirect(`/book/${merchantId}/done?id=${row.id}`);
  } catch (e) {
    if (isNextRedirect(e)) throw e;
    return { error: e instanceof Error ? e.message : '送出失敗，請再試一次。' };
  }
}
