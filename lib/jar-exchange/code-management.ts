import type { Prisma } from '@prisma/client';

/** 客服明確指定不再發放的序號；保留號碼，避免被重新建立。 */
export const EXCLUDED_JAR_CODES = ['79984418'] as const;

export function availableJarCodeWhere() {
  return {
    status: 'unused',
    code: { notIn: [...EXCLUDED_JAR_CODES] },
    redeemedByCustomerId: null,
    redeemedAt: null,
    issuedAt: null,
    returnedAt: null,
    issuedMerchantId: null,
    returnedMerchantId: null,
    lockedByRefillOrderId: null,
  };
}

export const JAR_CODE_ORDER = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

export async function safeAvailableJarCodeWhere(db: Pick<Prisma.TransactionClient, 'memberPointsLedger' | 'statusAuditLog' | 'refillAuditLog'>): Promise<Prisma.JarCodeWhereInput> {
  const [ledger, history, refill] = await Promise.all([
    db.memberPointsLedger.findMany({ where: { sourceType: 'jar_code_redeem', sourceRefId: { not: null } }, select: { sourceRefId: true }, distinct: ['sourceRefId'] }),
    db.statusAuditLog.findMany({ where: { entityType: 'jar_code', newStatus: { in: ['used', 'issued', 'returned', 'expired'] } }, select: { entityId: true }, distinct: ['entityId'] }),
    db.refillAuditLog.findMany({ where: { success: true, serial: { not: null } }, select: { serial: true }, distinct: ['serial'] }),
  ]);
  const ids = [...new Set([...ledger.map(row => row.sourceRefId).filter((id): id is string => Boolean(id)), ...history.map(row => row.entityId)])];
  const excludedCodes = [...new Set([...EXCLUDED_JAR_CODES, ...refill.map(row => row.serial).filter((serial): serial is string => Boolean(serial))])];
  return { ...availableJarCodeWhere(), code: { notIn: excludedCodes }, ...(ids.length ? { id: { notIn: ids } } : {}) };
}
