import type { PrismaClient } from '@prisma/client';
import { ORDER_WORK_FILTERS, orderListVisibleWhere, orderWorkWhere, workbenchVisibleWhere } from './oms-workbench';

/** Seven counts share one connection instead of competing with order review requests. */
export async function loadOrderWorkSummary(db: Pick<PrismaClient, '$transaction'>) {
  try {
    return await db.$transaction(async tx => {
      const stages = [];
      for (const stage of ORDER_WORK_FILTERS) {
        const count = await tx.order.count({
          where: { AND: [stage.key === 'all' || stage.key === 'cancelled' ? orderListVisibleWhere : workbenchVisibleWhere, orderWorkWhere(stage.key)] },
        });
        stages.push({ ...stage, count });
      }
      return stages;
    }, { maxWait: 2000, timeout: 10000 });
  } catch {
    // Counts are optional navigation metadata. Never report unavailable counts as zero.
    console.error('[orders.summary]', 'COUNTS_UNAVAILABLE');
    return ORDER_WORK_FILTERS.map(stage => ({ ...stage, count: null }));
  }
}
