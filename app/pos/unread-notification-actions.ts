'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireMerchantSession } from '@/lib/merchant-auth';
import {
  loadMerchantNotificationInbox,
  markMerchantNotificationRead,
} from '@/lib/pos/merchant-notification-inbox';

export async function loadUnreadNotifications() {
  const session = await requireMerchantSession();
  const inbox = await loadMerchantNotificationInbox(session);
  return {
    ...inbox,
    // Used only to suppress repeated non-modal hints during this signed-in session.
    sessionKey: `${session.merchantUserId}:${session.issuedAt}`,
  };
}

export async function readMerchantNotification(notificationId: string) {
  const session = await requireMerchantSession();
  await markMerchantNotificationRead(session, notificationId);
  revalidatePath('/pos/notifications');
}

/** The destination is resolved from this store's database row, never from a form URL. */
export async function openMerchantNotification(notificationId: string) {
  const session = await requireMerchantSession();
  const destination = await markMerchantNotificationRead(session, notificationId);
  revalidatePath('/pos/notifications');
  redirect(destination);
}
