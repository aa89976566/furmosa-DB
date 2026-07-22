/**
 * Product settings (env-overridable). Do not hardcode in domain transaction logic.
 * Phase 1 only exposes the waiting_for_jar retention default for documentation / future use.
 */
export function getWaitingForJarReservationDays(): number {
  const raw = process.env.WAITING_FOR_JAR_RESERVATION_DAYS;
  const n = raw ? Number(raw) : 14;
  if (!Number.isFinite(n) || n < 1) return 14;
  return Math.floor(n);
}

/** Phase 2+ POS button copy (frozen product decision). */
export const POS_BUTTON_LABELS = {
  /** exchange order primary action */
  confirmEmptyJarAndDeliver: '確認收到空罐並交付',
  /** first jar / forgot-jar top-up paid path */
  confirmDeliverProduct: '確認交付商品',
} as const;
