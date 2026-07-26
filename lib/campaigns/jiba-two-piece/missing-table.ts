/** Prisma：關聯／資料表不存在（migrate 未套用） */
export function isMissingCampaignTableError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const code = (error as { code?: string }).code;
    if (code === 'P2021' || code === 'P2010') return true;
  }
  const msg = error instanceof Error ? error.message : String(error);
  return (
    /relation ["']?campaigns["']? does not exist/i.test(msg) ||
    /relation ["']?campaign_applications["']? does not exist/i.test(msg) ||
    /relation ["']?conversation_sessions["']? does not exist/i.test(msg) ||
    /relation ["']?conversation_messages["']? does not exist/i.test(msg) ||
    /relation ["']?order_reviews["']? does not exist/i.test(msg) ||
    /relation ["']?status_audit_logs["']? does not exist/i.test(msg) ||
    /table .*campaigns.* does not exist/i.test(msg) ||
    msg.includes('does not exist in the current database')
  );
}
