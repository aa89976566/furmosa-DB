import type { Prisma } from '@prisma/client';
import type { LedgerSourceType } from '@/lib/jar-exchange/constants';

type Db = Prisma.TransactionClient;

export async function getPointsBalance(db: Db, customerId: string): Promise<number> {
  const last = await db.memberPointsLedger.findFirst({
    where: { customerId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { balanceAfter: true },
  });
  return last?.balanceAfter ?? 0;
}

export async function appendPointsLedger(
  db: Db,
  input: {
    customerId: string;
    sourceType: LedgerSourceType;
    sourceRefId?: string | null;
    pointsChange: number;
    note?: string | null;
    createdByUserId?: string | null;
  },
) {
  // A LINE user can submit multiple serials in quick succession. Serialize
  // balance reads/writes per customer so concurrent transactions cannot both
  // calculate the same balanceAfter value.
  await db.$queryRaw`
    SELECT 1
    FROM (
      SELECT pg_advisory_xact_lock(hashtextextended(${`member-points:${input.customerId}`}, 0))
    ) AS member_points_lock
  `;

  const balance = await getPointsBalance(db, input.customerId);
  const balanceAfter = balance + input.pointsChange;
  if (balanceAfter < 0) {
    throw new Error('點數不足');
  }

  return db.memberPointsLedger.create({
    data: {
      customerId: input.customerId,
      sourceType: input.sourceType,
      sourceRefId: input.sourceRefId ?? null,
      pointsChange: input.pointsChange,
      balanceAfter,
      note: input.note ?? null,
      createdByUserId: input.createdByUserId ?? null,
    },
  });
}
