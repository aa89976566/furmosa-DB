type NotificationEvent = {
  id: string;
  title: string;
  statusLabel: string;
  href: string;
  occurredAt: Date;
};

export async function loadRecentNotificationsForSession(deps: {
  requireMerchantSession: () => Promise<{ merchantId: string }>;
  loadMerchantEventPreviews: (merchantId: string, limit: number) => Promise<NotificationEvent[]>;
}) {
  const session = await deps.requireMerchantSession();
  const events = await deps.loadMerchantEventPreviews(session.merchantId, 5);
  return events.slice(0, 5).map(({ id, title, statusLabel, href, occurredAt }) => ({
    id,
    title,
    statusLabel,
    href,
    occurredAt: occurredAt.toISOString(),
  }));
}
