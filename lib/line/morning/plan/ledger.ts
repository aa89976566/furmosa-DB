/**
 * LineMorningPlanLedger repository
 * - @@unique([runDate, lineUserId])
 * - create + P2002 → 回讀既有列（禁 find-then-create 弱競態）
 * - 不存正文／姓名／token
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type {
  MorningPlanLedgerRow,
  MorningPlanReason,
  MorningPlanStatus,
} from '@/lib/line/morning/plan/types';

function mapRow(row: {
  id: string;
  lineUserId: string;
  runDate: string;
  contentId: string | null;
  contentType: string | null;
  decisionReason: string;
  planStatus: string;
  createdAt: Date;
}): MorningPlanLedgerRow {
  return {
    id: row.id,
    lineUserId: row.lineUserId,
    runDate: row.runDate,
    contentId: row.contentId,
    contentType: row.contentType,
    decisionReason: row.decisionReason,
    planStatus: row.planStatus as MorningPlanStatus,
    createdAt: row.createdAt,
  };
}

export async function findPlanLedger(
  runDate: string,
  lineUserId: string,
): Promise<MorningPlanLedgerRow | null> {
  const row = await prisma.lineMorningPlanLedger.findUnique({
    where: { runDate_lineUserId: { runDate, lineUserId } },
  });
  return row ? mapRow(row) : null;
}

export async function listPlanLedgersForRunDate(
  runDate: string,
): Promise<MorningPlanLedgerRow[]> {
  const rows = await prisma.lineMorningPlanLedger.findMany({
    where: { runDate },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map(mapRow);
}

export type InsertPlanLedgerInput = {
  lineUserId: string;
  runDate: string;
  contentId?: string | null;
  contentType?: string | null;
  decisionReason: MorningPlanReason | string;
  planStatus: MorningPlanStatus;
};

/**
 * 冪等寫入：成功建立或 P2002 回讀既有列。
 * 同一人同一台北曆日永遠最多一筆。
 */
export async function insertPlanLedgerIdempotent(
  input: InsertPlanLedgerInput,
): Promise<{ row: MorningPlanLedgerRow; created: boolean }> {
  try {
    const row = await prisma.lineMorningPlanLedger.create({
      data: {
        lineUserId: input.lineUserId,
        runDate: input.runDate,
        contentId: input.contentId ?? null,
        contentType: input.contentType ?? null,
        decisionReason: input.decisionReason,
        planStatus: input.planStatus,
      },
    });
    return { row: mapRow(row), created: true };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      const existing = await findPlanLedger(input.runDate, input.lineUserId);
      if (existing) return { row: existing, created: false };
    }
    throw err;
  }
}
