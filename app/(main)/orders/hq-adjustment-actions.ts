'use server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { saveHqAdjustment } from '@/lib/orders/hq-adjustment-service';
import { revalidatePath } from 'next/cache';

export async function hqAdjustmentAction(_state: { message: string; ok: boolean }, form: FormData) {
  const actor = await getCurrentUser();
  if (!actor) return { message: '請先登入 HQ', ok: false };
  const orderId = String(form.get('orderId') ?? '');
  let message: string;
  try {
    message = await saveHqAdjustment(prisma, { actorId: actor.userId, orderId,
      sourceHash: String(form.get('sourceHash') ?? ''), revision: String(form.get('revision') ?? ''),
      reason: String(form.get('reason') ?? ''), shippingFee: String(form.get('shippingFee') ?? ''),
      lines: JSON.parse(String(form.get('lines') ?? '[]')) });
  } catch (error) {
    return { message: error instanceof Error && !('code' in error) ? error.message : '修改未完成，請重新載入核對', ok: false };
  }
  try { revalidatePath(`/orders/${orderId}`); revalidatePath('/orders'); revalidatePath('/reviews'); } catch { /* Mutation already committed. */ }
  return { message, ok: true };
}
