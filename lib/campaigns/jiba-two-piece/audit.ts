import { prisma } from '@/lib/prisma';

export async function recordStatusTransition(opts: {
  entityType: string;
  entityId: string;
  previousStatus?: string | null;
  newStatus: string;
  actorType: string;
  actorId?: string | null;
  applicationId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await prisma.statusAuditLog.create({
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
