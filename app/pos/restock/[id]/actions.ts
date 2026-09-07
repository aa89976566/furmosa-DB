'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireMerchantSession } from '@/lib/merchant-auth';
import { confirmMerchantRestockReceipt } from '@/lib/merchant-restock-receipt';

export type ConfirmRestockReceiptState =
  | { status: 'idle' }
  | { status: 'just_received'; message: string }
  | { status: 'already_received'; message: string }
  | { status: 'failed'; message: string };

export async function confirmRestockReceiptAction(
  _previousState: ConfirmRestockReceiptState,
  formData: FormData,
): Promise<ConfirmRestockReceiptState> {
  const session = await requireMerchantSession();
  const { merchantId, merchantUserId } = session;
  const requestId = String(formData.get('requestId') ?? '').trim();
  if (!requestId) return { status: 'failed', message: '現在不能確認收貨，請再試一次。' };

  try {
    const request = await prisma.restockRequest.findFirst({
      where: { id: requestId, merchantId },
      select: {
        shipment: {
          select: { id: true },
        },
      },
    });
    const shipmentId = request?.shipment?.id;
    if (!shipmentId) {
      throw new Error('找不到這張補貨出貨單');
    }

    const result = await confirmMerchantRestockReceipt({
      shipmentId,
      merchantId,
      merchantUserId,
    });

    revalidatePath('/pos');
    revalidatePath('/pos/stock');
    revalidatePath('/pos/restock/progress');
    revalidatePath(`/pos/restock/${requestId}`);
    revalidatePath('/shipments');
    revalidatePath('/restock-requests');

    return result === 'just_received'
      ? { status: 'just_received', message: '已確認收貨，商品已加入店內庫存。' }
      : { status: 'already_received', message: '這筆補貨已完成收貨。' };
  } catch {
    return { status: 'failed', message: '現在不能確認收貨，請再試一次。' };
  }
}
