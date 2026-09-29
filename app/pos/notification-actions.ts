'use server';

import { requireMerchantSession } from '@/lib/merchant-auth';
import { loadMerchantEventPreviews } from '@/lib/pos/load-merchant-events';
import { loadRecentNotificationsForSession } from '@/lib/pos/notification-action-service';

/** Read-only: opening notifications never acknowledges receipt or completes tasks. */
export async function loadRecentNotifications() {
  return loadRecentNotificationsForSession({
    requireMerchantSession,
    loadMerchantEventPreviews,
  });
}
