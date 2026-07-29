import type { Prisma } from '@prisma/client';

type Db = Prisma.TransactionClient | {
  refillAuditLog: {
    create: (args: {
      data: {
        refillOrderId?: string | null;
        paymentOrderId?: string | null;
        action: string;
        actorType: string;
        actorId?: string | null;
        merchantId?: string | null;
        serial?: string | null;
        success?: boolean;
        detail?: Prisma.InputJsonValue;
      };
    }) => Promise<unknown>;
  };
};

export async function writeRefillAudit(
  db: Db,
  input: {
    refillOrderId?: string | null;
    paymentOrderId?: string | null;
    action: string;
    actorType: 'customer' | 'merchant' | 'system' | 'ecpay';
    actorId?: string | null;
    merchantId?: string | null;
    serial?: string | null;
    success?: boolean;
    detail?: Record<string, unknown> | null;
  },
) {
  return db.refillAuditLog.create({
    data: {
      refillOrderId: input.refillOrderId ?? null,
      paymentOrderId: input.paymentOrderId ?? null,
      action: input.action,
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      merchantId: input.merchantId ?? null,
      serial: input.serial ?? null,
      success: input.success ?? true,
      detail: (input.detail ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}
