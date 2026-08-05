'use server';

import { redirect } from 'next/navigation';
import { isNextRedirect } from '@/lib/is-next-redirect';
import {
  CUSTOMER_BOOKING_LOGIN_REQUIRED_MESSAGE,
  isCustomerBookingIdentityPresent,
} from '@/lib/booking/auth-gate';
import { submitCustomerBooking } from '@/lib/booking/service';
import { verifyLineIdToken } from '@/lib/line/verify-id-token';

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

    let lineUserId: string | null = null;
    const idToken = String(formData.get('lineIdToken') ?? '').trim();
    if (idToken) {
      try {
        const payload = await verifyLineIdToken(idToken);
        lineUserId = payload.sub;
      } catch {
        return { error: 'LINE 登入已失效，請重新開啟頁面後再送出。' };
      }
    }
    if (!isCustomerBookingIdentityPresent(lineUserId)) {
      return { error: CUSTOMER_BOOKING_LOGIN_REQUIRED_MESSAGE };
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
      lineUserId,
    });
    redirect(`/book/${merchantId}/done?id=${row.id}`);
  } catch (e) {
    if (isNextRedirect(e)) throw e;
    return { error: e instanceof Error ? e.message : '送出失敗，請再試一次。' };
  }
}
