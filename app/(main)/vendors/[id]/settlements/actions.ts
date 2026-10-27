'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import {
  assertVendorSettlementTransition,
  vendorSettlementPaymentReference,
} from '@/lib/vendor-settlement-status';

export type VendorSettlementStatusActionState = { ok: boolean; message: string };

export async function updateVendorSettlementStatus(
  _previous: VendorSettlementStatusActionState,
  formData: FormData,
): Promise<VendorSettlementStatusActionState> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, message: '請先登入 HQ' };
  const vendorId = String(formData.get('vendorId') ?? '').trim();
  const settlementId = String(formData.get('settlementId') ?? '').trim();
  const expectedStatus = String(formData.get('expectedStatus') ?? '').trim();
  const nextStatus = String(formData.get('nextStatus') ?? '').trim();
  const paymentReferenceInput = String(formData.get('paymentReference') ?? '');
  if (!vendorId || !settlementId) return { ok: false, message: '缺少供應商對帳資料' };

  try {
    const transition = assertVendorSettlementTransition({
      current: expectedStatus,
      next: nextStatus,
      actorRole: actor.role,
    });
    const paymentReference = vendorSettlementPaymentReference(
      transition.next,
      paymentReferenceInput,
    );
    await prisma.$transaction(async (tx) => {
      const current = await tx.vendorSettlement.findUnique({
        where: { id: settlementId },
        select: { id: true, vendorId: true, status: true },
      });
      if (!current || current.vendorId !== vendorId) throw new Error('找不到這張供應商對帳單');
      if (current.status !== transition.current) throw new Error('對帳狀態已被其他人更新，請重新整理');

      const updated = await tx.vendorSettlement.updateMany({
        where: { id: settlementId, vendorId, status: transition.current },
        data: {
          status: transition.next,
          paidAt: transition.next === 'paid' ? new Date() : null,
          note: paymentReference ?? undefined,
        },
      });
      if (updated.count !== 1) throw new Error('對帳狀態已被其他人更新，請重新整理');
      await tx.statusAuditLog.create({
        data: {
          entityType: 'vendor_settlement',
          entityId: settlementId,
          previousStatus: transition.current,
          newStatus: transition.next,
          actorType: 'user',
          actorId: actor.userId,
          metadataJson: paymentReference
            ? JSON.stringify({ paymentReference })
            : null,
        },
      });
    });
    revalidatePath(`/vendors/${vendorId}`);
    revalidatePath(`/vendors/${vendorId}/settlements/${settlementId}`);
    return { ok: true, message: '對帳狀態已更新' };
  } catch (error) {
    const raw = error instanceof Error ? error.message.trim() : '';
    const safe = raw && /[\u4e00-\u9fff]/.test(raw) && !/prisma|invocation|database|sql/i.test(raw)
      ? raw.slice(0, 300)
      : '更新失敗，請稍後重試';
    return { ok: false, message: safe };
  }
}
