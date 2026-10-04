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

export function managementJarCodeWhere(available: Prisma.JarCodeWhereInput, filters: { status: string; batch: string; q: string }): Prisma.JarCodeWhereInput {
  return { AND: [
    filters.status === 'available' ? available : filters.status ? { status: filters.status } : {},
    filters.batch ? { batchNo: filters.batch } : {},
    filters.q ? { code: { contains: filters.q, mode: 'insensitive' } } : {},
  ] };
}

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

/** Caller owns the transaction so the status change and audit commit together. */
export async function voidAvailableJarCode(tx: Prisma.TransactionClient, input: { id: string; actorId: string; reason: string }) {
  const reason = input.reason.trim();
  if (reason.length < 2 || reason.length > 500) throw new Error('請填寫作廢原因（2–500 字）');
  const row = await tx.jarCode.findUnique({ where: { id: input.id }, select: { code: true } });
  if (!row) throw new Error('找不到序號');
  const where = await safeAvailableJarCodeWhere(tx);
  const changed = await tx.jarCode.updateMany({ where: { AND: [where, { id: input.id }] }, data: { status: 'expired' } });
  if (changed.count !== 1) throw new Error('此序號已使用、持有、占用或被排除，不能作廢');
  await tx.statusAuditLog.create({ data: { entityType: 'jar_code', entityId: input.id, previousStatus: 'unused', newStatus: 'expired', actorType: 'supervisor', actorId: input.actorId, metadataJson: JSON.stringify({ reason, code: row.code }) } });
}
