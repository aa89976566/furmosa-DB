import { prisma } from '@/lib/prisma';
import type { WishStore } from './wishes';

export const wishStore: WishStore = {
  transaction: run => prisma.$transaction(async db => run({
    lock: async () => { await db.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(671904231)`; },
    find: taskId => db.task.findUnique({ where: { taskId }, select: { id: true, taskId: true, description: true, status: true } }),
    count: (since, reference) => db.task.count({ where: {
      type: 'customer_service', reference: reference ?? { startsWith: 'FMWISH:' }, createdAt: { gte: since },
    } }),
    create: data => db.task.create({ data, select: { id: true, taskId: true, description: true, status: true } }),
  })),
};
