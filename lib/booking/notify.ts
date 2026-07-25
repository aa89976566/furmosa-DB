import { prisma } from '@/lib/prisma';
import { pushLineText } from '@/lib/line/push';
import {
  copyCustomerConfirmed,
  copyCustomerReceived,
  copyCustomerRescheduled,
  copyMerchantNewRequest,
  type BookingNotifyContext,
} from '@/lib/booking/notify-copy';

async function loadNotifyContext(appointmentId: string): Promise<{
  appointment: {
    id: string;
    status: string;
    startsAt: Date;
    serviceName: string;
    petName: string | null;
    lineNotifyReceivedAt: Date | null;
    lineNotifyMerchantNewAt: Date | null;
    lineNotifyConfirmedAt: Date | null;
    customer: { name: string; lineUserId: string | null };
    merchant: {
      name: string;
      settings: {
        lineNotificationEnabled: boolean;
        bookingNotifyLineUserId: string | null;
      } | null;
    };
  };
  ctx: BookingNotifyContext;
} | null> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      status: true,
      startsAt: true,
      serviceName: true,
      petName: true,
      lineNotifyReceivedAt: true,
      lineNotifyMerchantNewAt: true,
      lineNotifyConfirmedAt: true,
      customer: { select: { name: true, lineUserId: true } },
      merchant: {
        select: {
          name: true,
          settings: {
            select: {
              lineNotificationEnabled: true,
              bookingNotifyLineUserId: true,
            },
          },
        },
      },
    },
  });
  if (!appointment) return null;
  return {
    appointment,
    ctx: {
      merchantName: appointment.merchant.name,
      serviceName: appointment.serviceName,
      startsAt: appointment.startsAt,
      petName: appointment.petName,
      customerName: appointment.customer.name,
    },
  };
}

async function markField(
  appointmentId: string,
  field:
    | 'lineNotifyReceivedAt'
    | 'lineNotifyMerchantNewAt'
    | 'lineNotifyConfirmedAt',
) {
  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { [field]: new Date() },
  });
}

/**
 * 顧客送出後：顧客「已收到」＋店家「有新預約」。
 * 推播失敗不回滾預約；無收件人亦標記已處理避免重試洗版。
 */
export async function notifyAppointmentRequested(appointmentId: string): Promise<void> {
  const loaded = await loadNotifyContext(appointmentId);
  if (!loaded) return;
  const { appointment, ctx } = loaded;
  if (appointment.status !== 'requested') return;

  if (!appointment.lineNotifyReceivedAt) {
    const lineUserId = appointment.customer.lineUserId;
    if (lineUserId) {
      const r = await pushLineText(lineUserId, copyCustomerReceived(ctx));
      if (!r.ok && !r.skipped) {
        console.error('[booking/notify] customer received', appointmentId, r.error);
      } else {
        await markField(appointmentId, 'lineNotifyReceivedAt');
      }
    } else {
      await markField(appointmentId, 'lineNotifyReceivedAt');
    }
  }

  if (!appointment.lineNotifyMerchantNewAt) {
    const settings = appointment.merchant.settings;
    const merchantLine = settings?.bookingNotifyLineUserId?.trim() || null;
    if (settings?.lineNotificationEnabled !== false && merchantLine) {
      const r = await pushLineText(merchantLine, copyMerchantNewRequest(ctx));
      if (!r.ok && !r.skipped) {
        console.error('[booking/notify] merchant new', appointmentId, r.error);
      } else {
        await markField(appointmentId, 'lineNotifyMerchantNewAt');
      }
    } else {
      await markField(appointmentId, 'lineNotifyMerchantNewAt');
    }
  }
}

/** 店家確認後：顧客「預約已確認」 */
export async function notifyAppointmentConfirmed(appointmentId: string): Promise<void> {
  const loaded = await loadNotifyContext(appointmentId);
  if (!loaded) return;
  const { appointment, ctx } = loaded;
  if (appointment.status !== 'confirmed') return;
  if (appointment.lineNotifyConfirmedAt) return;

  const lineUserId = appointment.customer.lineUserId;
  if (lineUserId) {
    const r = await pushLineText(lineUserId, copyCustomerConfirmed(ctx));
    if (!r.ok && !r.skipped) {
      console.error('[booking/notify] customer confirmed', appointmentId, r.error);
      return;
    }
  }
  await markField(appointmentId, 'lineNotifyConfirmedAt');
}

/** 店家改期並確認：重送確認文案（含新時間）；重置確認冪等後再送 */
export async function notifyAppointmentRescheduled(appointmentId: string): Promise<void> {
  const loaded = await loadNotifyContext(appointmentId);
  if (!loaded) return;
  const { appointment, ctx } = loaded;
  if (appointment.status !== 'confirmed') return;

  const lineUserId = appointment.customer.lineUserId;
  if (lineUserId) {
    const r = await pushLineText(lineUserId, copyCustomerRescheduled(ctx));
    if (!r.ok && !r.skipped) {
      console.error('[booking/notify] customer reschedule', appointmentId, r.error);
      return;
    }
  }
  await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      lineNotifyConfirmedAt: new Date(),
      // 改期後提醒視窗重算
      lineReminder1dAt: null,
      lineReminder2hAt: null,
    },
  });
}

/** 不阻塞主流程 */
export function fireAndForget(task: () => Promise<void>) {
  void task().catch((e) => {
    console.error('[booking/notify] background', e);
  });
}
