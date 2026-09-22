'use server';

import { revalidatePath } from 'next/cache';
import { requireMerchantSession } from '@/lib/merchant-auth';
import { prisma } from '@/lib/prisma';
import { ensureMerchantSettings } from '@/lib/restock-request/service';
import { normalizeMerchantLineUserId } from '@/lib/pos/notification-settings';

export type NotificationSettingsActionState = {
  ok?: boolean;
  error?: string;
};

export async function saveNotificationSettingsAction(
  _previous: NotificationSettingsActionState,
  formData: FormData,
): Promise<NotificationSettingsActionState> {
  const session = await requireMerchantSession();

  try {
    const lineUserId = normalizeMerchantLineUserId(
      formData.get('bookingNotifyLineUserId'),
    );
    await ensureMerchantSettings(session.merchantId);
    await prisma.merchantSettings.update({
      where: { merchantId: session.merchantId },
      data: {
        lineNotificationEnabled: formData.get('lineNotificationEnabled') === 'on',
        bookingNotifyLineUserId: lineUserId,
      },
    });
    revalidatePath('/pos/account');
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : '儲存失敗，請再試一次。',
    };
  }
}

export async function unlinkMerchantLineAction(): Promise<void> {
  const session = await requireMerchantSession();
  await ensureMerchantSettings(session.merchantId);
  await prisma.merchantSettings.update({
    where: { merchantId: session.merchantId },
    data: {
      lineNotificationEnabled: false,
      bookingNotifyLineUserId: null,
    },
  });
  revalidatePath('/pos/account');
}
