import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

type Db = Prisma.TransactionClient | typeof prisma;

export async function recordStatusTransition(opts: {
  entityType: string;
  entityId: string;
  previousStatus?: string | null;
  newStatus: string;
  actorType: string;
  actorId?: string | null;
  applicationId?: string | null;
  metadata?: Record<string, unknown>;
  db?: Db;
}) {
  const db = opts.db ?? prisma;
  await db.statusAuditLog.create({
    data: {
      entityType: opts.entityType,
      entityId: opts.entityId,
      previousStatus: opts.previousStatus ?? null,
      newStatus: opts.newStatus,
      actorType: opts.actorType,
      actorId: opts.actorId ?? null,
      applicationId: opts.applicationId ?? null,
      metadataJson: opts.metadata ? JSON.stringify(opts.metadata) : null,
    },
  });
}
