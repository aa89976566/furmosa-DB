export type NotificationIdentity = {
  id: string;
  occurredAt: string | Date;
};

export function notificationReadKey(event: NotificationIdentity): string {
  const occurredAt =
    event.occurredAt instanceof Date ? event.occurredAt.toISOString() : event.occurredAt;
  return `${event.id}:${occurredAt}`;
}

export function unreadNotificationKeys(
  events: readonly NotificationIdentity[],
  seenKeys: readonly string[],
): string[] {
  const seen = new Set(seenKeys);
  return events.map(notificationReadKey).filter((key) => !seen.has(key));
}

export function mergeSeenNotificationKeys(
  seenKeys: readonly string[],
  events: readonly NotificationIdentity[],
  limit = 100,
): string[] {
  const merged = [...events.map(notificationReadKey), ...seenKeys];
  return [...new Set(merged)].slice(0, limit);
}
