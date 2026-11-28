import type { PrismaClient } from '@prisma/client';
import { ORDER_WORK_FILTERS, orderListVisibleWhere, orderWorkWhere, workbenchVisibleWhere } from './oms-workbench';

/** Seven counts share one connection instead of competing with order review requests. */
export async function loadOrderWorkSummary(db: Pick<PrismaClient, '$transaction'>) {
  const startedAt = performance.now();
  let phase: 'transaction_start' | 'count' | 'transaction_finish' = 'transaction_start';
  let stageKey: string | null = null;
  try {
    return await db.$transaction(async tx => {
      const stages = [];
      for (const stage of ORDER_WORK_FILTERS) {
        phase = 'count';
        stageKey = stage.key;
        const count = await tx.order.count({
          where: { AND: [stage.key === 'all' || stage.key === 'cancelled' ? orderListVisibleWhere : workbenchVisibleWhere, orderWorkWhere(stage.key)] },
        });
        stages.push({ ...stage, count });
      }
      phase = 'transaction_finish';
      stageKey = null;
      return stages;
    }, { maxWait: 2000, timeout: 10000 });
  } catch (error) {
    // Counts are optional navigation metadata. Never report unavailable counts as zero.
    // Allowlisted codes only: never serialize messages, SQL, meta or connection URLs.
    const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
    const allowedCodes = ['P1001', 'P1002', 'P1008', 'P1017', 'P2010', 'P2021', 'P2022', 'P2024', 'P2028'];
    console.error('[orders.summary]', 'COUNTS_UNAVAILABLE', {
      phase,
      stage: stageKey,
      code: typeof code === 'string' && allowedCodes.includes(code) ? code : 'UNKNOWN',
      elapsedMs: Math.round(performance.now() - startedAt),
    });
    return ORDER_WORK_FILTERS.map(stage => ({ ...stage, count: null }));
  }
}
