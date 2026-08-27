'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isNextRedirect } from '@/lib/is-next-redirect';
import {
  getAuthenticatedMerchantId,
  requireMerchantSession,
} from '@/lib/merchant-auth';
import {
  cancelAppointment,
  confirmAppointment,
  createMerchantAppointment,
  proposeAndApplyReschedule,
  updateMerchantBookingSchedule,
} from '@/lib/booking/service';

export type BookingActionState = { error?: string; ok?: boolean };

function parseStartsAt(raw: string): Date {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) throw new Error('時間不正確');
  return d;
}

export async function confirmAppointmentAction(
  _prev: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  await requireMerchantSession();
  const merchantId = await getAuthenticatedMerchantId();
  const id = String(formData.get('appointmentId') ?? '');
  try {
    await confirmAppointment({ appointmentId: id, merchantId });
    revalidatePath('/pos');
    revalidatePath('/pos/today');
    revalidatePath('/pos/appointments');
    redirect(`/pos/appointments/${id}`);
  } catch (e) {
    if (isNextRedirect(e)) throw e;
    return { error: e instanceof Error ? e.message : '操作失敗，請再試一次。' };
  }
}

export async function rescheduleAppointmentAction(
  _prev: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  await requireMerchantSession();
  const merchantId = await getAuthenticatedMerchantId();
  const id = String(formData.get('appointmentId') ?? '');
  try {
    const startsAt = parseStartsAt(String(formData.get('startsAt') ?? ''));
    await proposeAndApplyReschedule({
      appointmentId: id,
      merchantId,
      newStartsAt: startsAt,
    });
    revalidatePath('/pos');
    revalidatePath('/pos/today');
    revalidatePath('/pos/appointments');
    redirect(`/pos/appointments/${id}`);
  } catch (e) {
    if (isNextRedirect(e)) throw e;
    return { error: e instanceof Error ? e.message : '改期失敗，請再試一次。' };
  }
}

export async function cancelAppointmentAction(
  _prev: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  await requireMerchantSession();
  const merchantId = await getAuthenticatedMerchantId();
  const id = String(formData.get('appointmentId') ?? '');
  try {
    await cancelAppointment({ appointmentId: id, merchantId });
    revalidatePath('/pos');
    revalidatePath('/pos/today');
    revalidatePath('/pos/appointments');
    redirect('/pos/appointments');
  } catch (e) {
    if (isNextRedirect(e)) throw e;
    return { error: e instanceof Error ? e.message : '取消失敗，請再試一次。' };
  }
}

export async function createManualAppointmentAction(
  _prev: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  await requireMerchantSession();
  const merchantId = await getAuthenticatedMerchantId();
  try {
    const startsAt = parseStartsAt(String(formData.get('startsAt') ?? ''));
    const row = await createMerchantAppointment({
      merchantId,
      startsAt,
      customerName: String(formData.get('customerName') ?? ''),
      customerPhone: String(formData.get('customerPhone') ?? ''),
      petName: String(formData.get('petName') ?? '') || null,
      customerNote: String(formData.get('customerNote') ?? '') || null,
      merchantNote: String(formData.get('merchantNote') ?? '') || null,
      serviceProductId: String(formData.get('serviceProductId') ?? '') || null,
      serviceName: String(formData.get('serviceName') ?? '') || null,
      allowOverbook: true,
      createdBy: 'merchant',
    });
    revalidatePath('/pos');
    revalidatePath('/pos/today');
    revalidatePath('/pos/appointments');
    redirect(`/pos/appointments/${row.id}`);
  } catch (e) {
    if (isNextRedirect(e)) throw e;
    return { error: e instanceof Error ? e.message : '新增失敗，請再試一次。' };
  }
}

export async function saveBookingScheduleAction(
  _prev: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  await requireMerchantSession();
  const merchantId = await getAuthenticatedMerchantId();
  try {
    await updateMerchantBookingSchedule({
      merchantId,
      openTime: String(formData.get('openTime') ?? '09:00'),
      closeTime: String(formData.get('closeTime') ?? '18:00'),
      slotMinutes: Number(formData.get('slotMinutes') ?? 60),
      capacityPerSlot: Number(formData.get('capacityPerSlot') ?? 1),
      weekdays: String(formData.get('weekdays') ?? '1,2,3,4,5,6'),
      appointmentEnabled: true,
      bookingNotifyLineUserId: String(formData.get('bookingNotifyLineUserId') ?? ''),
    });
    revalidatePath('/pos/appointments');
    revalidatePath('/pos/appointments/schedule');
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : '儲存失敗，請再試一次。' };
  }
}
