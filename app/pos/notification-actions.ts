'use server';

import { requireMerchantSession } from '@/lib/merchant-auth';
import { loadMerchantEventPreviews } from '@/lib/pos/load-merchant-events';

/** Read-only: opening notifications never acknowledges receipt or completes tasks. */
export async function loadRecentNotifications() {
  const session = await requireMerchantSession();
  const events = await loadMerchantEventPreviews(session.merchantId, 5);
  return events.slice(0, 5).map(({ id, title, statusLabel, href, occurredAt }) => ({
    id, title, statusLabel, href, occurredAt: occurredAt.toISOString(),
  }));
}
